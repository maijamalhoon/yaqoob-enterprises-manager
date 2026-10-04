ALTER TABLE public.category_aliases
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE public.category_aliases AS aliases
SET organization_id = categories.organization_id
FROM public.categories AS categories
WHERE aliases.category_id = categories.id
  AND aliases.organization_id IS NULL;

ALTER TABLE public.category_aliases
  ALTER COLUMN organization_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_id_organization
  ON public.categories (id, organization_id);

ALTER TABLE public.category_aliases
  DROP CONSTRAINT IF EXISTS ux_category_alias;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'category_aliases_category_shop_fk'
      AND conrelid = 'public.category_aliases'::regclass
  ) THEN
    ALTER TABLE public.category_aliases
      ADD CONSTRAINT category_aliases_category_shop_fk
      FOREIGN KEY (category_id, organization_id)
      REFERENCES public.categories (id, organization_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_category_aliases_org_alias
  ON public.category_aliases (organization_id, alias);
CREATE INDEX IF NOT EXISTS idx_category_aliases_organization
  ON public.category_aliases (organization_id);

DROP POLICY IF EXISTS "Members can read aliases" ON public.category_aliases;
DROP POLICY IF EXISTS "Members can manage aliases" ON public.category_aliases;
DROP POLICY IF EXISTS category_aliases_tenant_access ON public.category_aliases;
CREATE POLICY category_aliases_tenant_access
  ON public.category_aliases FOR ALL TO authenticated
  USING (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
  )
  WITH CHECK (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
  );
