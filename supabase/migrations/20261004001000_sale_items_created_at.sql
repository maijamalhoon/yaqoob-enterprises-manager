ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sale_items_organization_created_at
  ON public.sale_items (organization_id, created_at);