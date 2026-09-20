-- Local SQLite mirrors these uniqueness guarantees in its migration layer.
CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_closings_org_date
  ON public.daily_closings(organization_id, closing_date);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_org_invoice
  ON public.sales(organization_id, invoice_number);
