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

DO $$
BEGIN
  ALTER TABLE public.category_aliases
    DROP CONSTRAINT IF EXISTS ux_category_alias;
  ALTER TABLE public.category_aliases
    ADD CONSTRAINT category_aliases_category_shop_fk
    FOREIGN KEY (category_id, organization_id)
    REFERENCES public.categories (id, organization_id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_category_aliases_org_alias
  ON public.category_aliases (organization_id, alias);

CREATE INDEX IF NOT EXISTS idx_category_aliases_organization
  ON public.category_aliases (organization_id);

DROP POLICY IF EXISTS "Members can read aliases" ON public.category_aliases;
DROP POLICY IF EXISTS "Members can manage aliases" ON public.category_aliases;
CREATE POLICY "Members can manage aliases" ON public.category_aliases
  FOR ALL TO authenticated
  USING (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
  )
  WITH CHECK (
    public.is_active_shop_member()
    AND organization_id = public.get_auth_org_id()
  );

CREATE OR REPLACE FUNCTION public.seed_shop_defaults(target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (
    organization_id, name, kind, unusual_amount_limit_paisa, is_default, display_order
  ) VALUES
    (target_org_id, 'Printing & Photocopy', 'income', 5000000, TRUE, 1),
    (target_org_id, 'Legal Stamp Paper', 'income', 30000000, FALSE, 2),
    (target_org_id, 'Lamination', 'income', 2000000, FALSE, 3),
    (target_org_id, 'Paper Stock Purchase', 'expense', 10000000, TRUE, 4),
    (target_org_id, 'Shop Supplies & Bills', 'expense', 5000000, FALSE, 5),
    (target_org_id, 'Stamp Paper Purchase', 'expense', 30000000, FALSE, 6)
  ON CONFLICT (organization_id, name) DO NOTHING;

  INSERT INTO public.category_aliases (organization_id, category_id, alias)
  SELECT target_org_id, categories.id, seeds.alias
  FROM (VALUES
    ('Printing & Photocopy', 'PRINT'),
    ('Printing & Photocopy', 'PRNT'),
    ('Printing & Photocopy', 'PRINTING'),
    ('Printing & Photocopy', 'PHOTOCOPY'),
    ('Printing & Photocopy', 'FOTOCOPY'),
    ('Printing & Photocopy', 'COPY'),
    ('Printing & Photocopy', 'PHOTOSTATE'),
    ('Printing & Photocopy', 'XEROX'),
    ('Legal Stamp Paper', 'STAMP'),
    ('Legal Stamp Paper', 'STMP'),
    ('Legal Stamp Paper', 'STAMPS'),
    ('Legal Stamp Paper', 'LEGAL STAMP'),
    ('Legal Stamp Paper', 'STAMP PAPER'),
    ('Legal Stamp Paper', 'AFFIDAVIT'),
    ('Legal Stamp Paper', 'BAYAN'),
    ('Lamination', 'LAMINATION'),
    ('Lamination', 'LMNYON'),
    ('Lamination', 'LMNATION'),
    ('Lamination', 'LAM'),
    ('Lamination', 'LAMNATION'),
    ('Paper Stock Purchase', 'PAPER'),
    ('Paper Stock Purchase', 'PAPR'),
    ('Paper Stock Purchase', 'A4 PAPER'),
    ('Paper Stock Purchase', 'RIM'),
    ('Paper Stock Purchase', 'REAMS'),
    ('Paper Stock Purchase', 'PAPER STOCK'),
    ('Shop Supplies & Bills', 'BILL'),
    ('Shop Supplies & Bills', 'SUPPLIES'),
    ('Shop Supplies & Bills', 'ELECTRICITY'),
    ('Shop Supplies & Bills', 'BIJLI'),
    ('Shop Supplies & Bills', 'CHAI'),
    ('Shop Supplies & Bills', 'TEA'),
    ('Shop Supplies & Bills', 'CLEANING'),
    ('Shop Supplies & Bills', 'SNACKS'),
    ('Stamp Paper Purchase', 'STAMP PURCHASE'),
    ('Stamp Paper Purchase', 'STAMP BUY'),
    ('Stamp Paper Purchase', 'BUY STAMP'),
    ('Stamp Paper Purchase', 'PURCHASE STAMP')
  ) AS seeds(category_name, alias)
  JOIN public.categories AS categories
    ON categories.organization_id = target_org_id
    AND categories.name = seeds.category_name
  ON CONFLICT (organization_id, alias) DO NOTHING;

  INSERT INTO public.payment_accounts (
    organization_id, name, type, current_balance, opening_balance, is_default, is_active
  )
  SELECT target_org_id, 'Cash Wallet', 'CASH', 0, 0, TRUE, TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_accounts
    WHERE organization_id = target_org_id
      AND is_default = TRUE
      AND is_active = TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_shop_defaults(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_shop_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shop_members (
    user_id, organization_id, full_name, email, role, created_at
  ) VALUES (
    NEW.id,
    NEW.organization_id,
    COALESCE(NULLIF(NEW.full_name, ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.role::TEXT, 'OWNER'),
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

  PERFORM public.seed_shop_defaults(NEW.organization_id);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_shop_membership() FROM PUBLIC, anon, authenticated;

INSERT INTO public.shop_members (
  user_id, organization_id, full_name, email, role, created_at
)
SELECT
  id,
  organization_id,
  COALESCE(NULLIF(full_name, ''), split_part(email, '@', 1)),
  email,
  COALESCE(role::TEXT, 'OWNER'),
  COALESCE(created_at, NOW())
FROM public.profiles
WHERE organization_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

DO $$
DECLARE
  shop RECORD;
BEGIN
  FOR shop IN
    SELECT DISTINCT organization_id
    FROM public.shop_members
  LOOP
    PERFORM public.seed_shop_defaults(shop.organization_id);
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_shop_membership ON public.profiles;
CREATE TRIGGER trg_sync_profile_shop_membership
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_shop_membership();

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  auth_email TEXT;
  metadata JSONB;
  new_org_id UUID;
  full_name_val TEXT;
  shop_name_val TEXT;
  profile_org_id UUID;
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

  SELECT organization_id, full_name
  INTO profile_org_id, full_name_val
  FROM public.profiles
  WHERE id = current_user_id;

  IF profile_org_id IS NULL THEN
    full_name_val := COALESCE(
      NULLIF(full_name_val, ''),
      NULLIF(metadata->>'full_name', ''),
      NULLIF(metadata->>'name', ''),
      split_part(auth_email, '@', 1)
    );
    shop_name_val := COALESCE(
      NULLIF(metadata->>'shop_name', ''),
      NULLIF(metadata->>'organization_name', ''),
      full_name_val || '''s Shop'
    );

    INSERT INTO public.organizations (name, owner_name, currency, currency_symbol)
    VALUES (shop_name_val, full_name_val, 'PKR', 'Rs.')
    RETURNING id INTO new_org_id;

    INSERT INTO public.profiles (id, email, full_name, role, organization_id, is_active)
    VALUES (current_user_id, auth_email, full_name_val, 'OWNER', new_org_id, TRUE)
    ON CONFLICT (id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      full_name = EXCLUDED.full_name,
      is_active = TRUE;

    profile_org_id := new_org_id;
  END IF;

  INSERT INTO public.shop_members (user_id, organization_id, full_name, email, role)
  SELECT id, organization_id, COALESCE(NULLIF(full_name, ''), split_part(email, '@', 1)), email, role::TEXT
  FROM public.profiles
  WHERE id = current_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  SELECT organization_id, id, role, TRUE
  FROM public.profiles
  WHERE id = current_user_id
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = TRUE;

  PERFORM public.seed_shop_defaults(profile_org_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT organization_id, id, role, TRUE
FROM public.profiles
WHERE organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = TRUE;

CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  shop_name TEXT;
  owner_name TEXT;
BEGIN
  SELECT organization_id INTO new_org_id
  FROM public.profiles
  WHERE id = NEW.id;

  IF new_org_id IS NOT NULL THEN
    PERFORM public.seed_shop_defaults(new_org_id);
    RETURN NEW;
  END IF;

  owner_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );
  shop_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'shop_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'organization_name', ''),
    owner_name || '''s Shop'
  );

  INSERT INTO public.organizations (name, owner_name, currency, currency_symbol)
  VALUES (shop_name, owner_name, 'PKR', 'Rs.')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id, is_active)
  VALUES (NEW.id, NEW.email, owner_name, 'OWNER', new_org_id, TRUE);

  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'OWNER', TRUE)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  PERFORM public.seed_shop_defaults(new_org_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_profile_for_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_org_id UUID;
BEGIN
  SELECT organization_id INTO target_org_id
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'Existing profile has no shop organization';
  END IF;

  INSERT INTO public.shop_members (user_id, organization_id, full_name, email, role)
  SELECT id, organization_id, COALESCE(NULLIF(full_name, ''), split_part(email, '@', 1)), email, role::TEXT
  FROM public.profiles
  WHERE id = target_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  SELECT organization_id, id, role, TRUE
  FROM public.profiles
  WHERE id = target_user_id
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = TRUE;

  PERFORM public.seed_shop_defaults(target_org_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile_for_user(UUID) FROM PUBLIC, anon, authenticated;