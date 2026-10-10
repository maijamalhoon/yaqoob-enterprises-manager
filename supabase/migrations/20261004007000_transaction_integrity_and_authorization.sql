CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_id_organization
  ON public.categories (id, organization_id);

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_category_organization_fk
  FOREIGN KEY (category_id, organization_id)
  REFERENCES public.categories (id, organization_id);

ALTER TABLE public.transaction_drafts
  ADD CONSTRAINT transaction_drafts_category_organization_fk
  FOREIGN KEY (category_id, organization_id)
  REFERENCES public.categories (id, organization_id);

CREATE OR REPLACE FUNCTION private.enforce_transaction_void_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private, auth
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'voided' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'An authenticated shop member is required to void a transaction';
    END IF;
    IF COALESCE(NULLIF(BTRIM(NEW.void_reason), ''), '') = '' THEN
      RAISE EXCEPTION 'A non-empty void reason is required';
    END IF;
    NEW.voided_by := auth.uid();
    NEW.voided_at := NOW();
  ELSIF OLD.status = 'voided' AND NEW.status = 'active' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'An authenticated shop member is required to restore a transaction';
    END IF;
    NEW.void_reason := NULL;
    NEW.voided_by := NULL;
    NEW.voided_at := NULL;
  ELSIF OLD.status = 'voided' THEN
    NEW.void_reason := OLD.void_reason;
    NEW.voided_by := OLD.voided_by;
    NEW.voided_at := OLD.voided_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_a_enforce_transaction_void_attribution ON public.transactions;
CREATE TRIGGER trg_a_enforce_transaction_void_attribution
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION private.enforce_transaction_void_attribution();

DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
CREATE POLICY "Members can update transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
    AND EXISTS (
      SELECT 1 FROM public.shop_members AS member
      WHERE member.user_id = auth.uid()
        AND member.organization_id = transactions.organization_id
        AND member.role IN ('OWNER', 'MANAGER')
    )
  )
  WITH CHECK (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
    AND EXISTS (
      SELECT 1 FROM public.shop_members AS member
      WHERE member.user_id = auth.uid()
        AND member.organization_id = transactions.organization_id
        AND member.role IN ('OWNER', 'MANAGER')
    )
  );
