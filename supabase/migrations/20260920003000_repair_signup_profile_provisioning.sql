-- Repair signup provisioning for projects where the original auth trigger was not applied.
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name_val TEXT;
  full_name_val TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  org_name_val := COALESCE(NULLIF(NEW.raw_user_meta_data->>'organization_name', ''), 'Yaqoob Enterprises');
  full_name_val := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  INSERT INTO public.organizations (name, owner_name, currency, currency_symbol)
  VALUES (org_name_val, full_name_val, 'PKR', 'Rs.')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id, is_active)
  VALUES (NEW.id, NEW.email, full_name_val, 'OWNER', new_org_id, TRUE);

  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'OWNER', TRUE)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  INSERT INTO public.payment_accounts (organization_id, name, type, current_balance, opening_balance, is_default)
  VALUES
    (new_org_id, 'Cash Drawer (Shop Till)', 'CASH', 10000.00, 10000.00, TRUE),
    (new_org_id, 'Business Bank Account', 'BANK', 0.00, 0.00, FALSE),
    (new_org_id, 'JazzCash Merchant Wallet', 'DIGITAL_WALLET', 0.00, 0.00, FALSE),
    (new_org_id, 'Easypaisa Business Wallet', 'DIGITAL_WALLET', 0.00, 0.00, FALSE);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_registration();

-- This operation is callable only by the currently authenticated user and never
-- accepts a user ID, organization ID, role, or ownership value from the client.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  auth_email TEXT;
  metadata JSONB;
  new_org_id UUID;
  full_name_val TEXT;
  org_name_val TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email, raw_user_meta_data
  INTO auth_email, metadata
  FROM auth.users
  WHERE id = current_user_id;

  IF auth_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user does not exist';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = current_user_id) THEN
    RETURN;
  END IF;

  full_name_val := COALESCE(NULLIF(metadata->>'full_name', ''), auth_email);
  org_name_val := COALESCE(NULLIF(metadata->>'organization_name', ''), 'Yaqoob Enterprises');

  INSERT INTO public.organizations (name, owner_name, currency, currency_symbol)
  VALUES (org_name_val, full_name_val, 'PKR', 'Rs.')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id, is_active)
  VALUES (current_user_id, auth_email, full_name_val, 'OWNER', new_org_id, TRUE);

  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  VALUES (new_org_id, current_user_id, 'OWNER', TRUE);

  INSERT INTO public.payment_accounts (organization_id, name, type, current_balance, opening_balance, is_default)
  VALUES (new_org_id, 'Cash Drawer (Shop Till)', 'CASH', 10000.00, 10000.00, TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
