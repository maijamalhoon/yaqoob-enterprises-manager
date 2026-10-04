CREATE TABLE public.transaction_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  category_id UUID REFERENCES public.categories(id),
  adjustment_dir public.adjustment_direction,
  business_date DATE NOT NULL,
  device_entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  raw_text TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_draft_adjustment_requires_note CHECK (
    type != 'adjustment' OR (
      note IS NOT NULL AND length(trim(note)) > 0 AND adjustment_dir IS NOT NULL
    )
  )
);

CREATE INDEX idx_transaction_drafts_org_date
  ON public.transaction_drafts (organization_id, business_date, device_entry_time);

ALTER TABLE public.transaction_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_drafts FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.transaction_drafts TO authenticated;
REVOKE DELETE, TRUNCATE ON public.transaction_drafts FROM authenticated, anon, public;

CREATE POLICY transaction_drafts_select
  ON public.transaction_drafts FOR SELECT TO authenticated
  USING (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
  );
CREATE POLICY transaction_drafts_insert
  ON public.transaction_drafts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
    AND created_by = auth.uid()
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories
        WHERE id = category_id AND organization_id = transaction_drafts.organization_id
      )
    )
  );
CREATE POLICY transaction_drafts_update
  ON public.transaction_drafts FOR UPDATE TO authenticated
  USING (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
    AND created_by = auth.uid()
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories
        WHERE id = category_id AND organization_id = transaction_drafts.organization_id
      )
    )
  );
CREATE POLICY transaction_drafts_delete
  ON public.transaction_drafts FOR DELETE TO authenticated
  USING (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
  );

CREATE OR REPLACE FUNCTION public.post_transaction_draft(
  draft_id UUID,
  selected_account_id UUID
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  draft public.transaction_drafts%ROWTYPE;
  posted_transaction public.transactions%ROWTYPE;
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to post a transaction draft';
  END IF;

  SELECT * INTO draft
  FROM public.transaction_drafts
  WHERE id = draft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO posted_transaction
    FROM public.transactions
    WHERE idempotency_key = 'draft-' || draft_id::TEXT;
    IF FOUND THEN
      RETURN posted_transaction;
    END IF;
    RAISE EXCEPTION 'Transaction draft was not found';
  END IF;

  IF NOT public.is_active_shop_member()
     OR draft.organization_id <> public.get_auth_org_id() THEN
    RAISE EXCEPTION 'Transaction draft does not belong to an active shop';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_accounts
    WHERE id = selected_account_id
      AND organization_id = draft.organization_id
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Selected account does not belong to this shop or is inactive';
  END IF;

  IF draft.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = draft.category_id AND organization_id = draft.organization_id
  ) THEN
    RAISE EXCEPTION 'Transaction category does not belong to this shop';
  END IF;

  INSERT INTO public.transactions (
    organization_id, type, amount_paisa, category_id, account_id,
    adjustment_dir, business_date, device_entry_time, note, raw_text,
    status, idempotency_key, created_by, created_by_name
  ) VALUES (
    draft.organization_id, draft.type, draft.amount_paisa, draft.category_id,
    selected_account_id, draft.adjustment_dir, draft.business_date,
    draft.device_entry_time, draft.note, draft.raw_text, 'active',
    'draft-' || draft.id::TEXT, current_user_id, draft.created_by_name
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO posted_transaction;

  IF NOT FOUND THEN
    SELECT * INTO posted_transaction
    FROM public.transactions
    WHERE idempotency_key = 'draft-' || draft.id::TEXT
      AND organization_id = draft.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction draft could not be posted';
    END IF;
  END IF;

  DELETE FROM public.transaction_drafts WHERE id = draft.id;
  RETURN posted_transaction;
END;
$$;

REVOKE ALL ON FUNCTION public.post_transaction_draft(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_transaction_draft(UUID, UUID) TO authenticated;
