ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'investment';

ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS balance_paisa BIGINT;
UPDATE public.payment_accounts
SET balance_paisa = ROUND(COALESCE(current_balance, opening_balance, 0) * 100)::BIGINT
WHERE balance_paisa IS NULL;
ALTER TABLE public.payment_accounts
  ALTER COLUMN balance_paisa SET DEFAULT 0,
  ALTER COLUMN balance_paisa SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_accounts_id_org
  ON public.payment_accounts (id, organization_id);

CREATE OR REPLACE FUNCTION public.sync_payment_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.balance_paisa = 0 AND (COALESCE(NEW.current_balance, 0) <> 0 OR COALESCE(NEW.opening_balance, 0) <> 0) THEN
      NEW.balance_paisa := ROUND(COALESCE(NULLIF(NEW.current_balance, 0), NEW.opening_balance, 0) * 100)::BIGINT;
    END IF;
    NEW.current_balance := NEW.balance_paisa::NUMERIC / 100;
  ELSIF NEW.balance_paisa IS DISTINCT FROM OLD.balance_paisa THEN
    NEW.current_balance := NEW.balance_paisa::NUMERIC / 100;
  ELSIF NEW.current_balance IS DISTINCT FROM OLD.current_balance THEN
    NEW.balance_paisa := ROUND(NEW.current_balance * 100)::BIGINT;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_account_balance ON public.payment_accounts;
CREATE TRIGGER trg_sync_payment_account_balance
BEFORE INSERT OR UPDATE OF balance_paisa, current_balance ON public.payment_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_account_balance();

INSERT INTO public.payment_accounts (organization_id, name, type, current_balance, opening_balance, is_default, is_active)
SELECT shops.id, 'Cash Wallet', 'CASH', 0, 0, TRUE, TRUE
FROM public.organizations AS shops
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_accounts AS accounts
  WHERE accounts.organization_id = shops.id AND accounts.is_default AND accounts.is_active
);

INSERT INTO public.payment_accounts (organization_id, name, type, current_balance, opening_balance, is_default, is_active)
SELECT DISTINCT transactions.organization_id, 'Cash Wallet', 'CASH', 0, 0, TRUE, TRUE
FROM public.transactions AS transactions
WHERE transactions.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_accounts AS accounts
    WHERE accounts.organization_id = transactions.organization_id AND accounts.is_default AND accounts.is_active
  )
ON CONFLICT DO NOTHING;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS account_posted BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.transactions AS transactions
SET account_id = (
  SELECT payment_accounts.id
  FROM public.payment_accounts AS payment_accounts
  WHERE payment_accounts.organization_id = transactions.organization_id
    AND payment_accounts.is_default AND payment_accounts.is_active
  ORDER BY payment_accounts.created_at, payment_accounts.id
  LIMIT 1
)
WHERE transactions.account_id IS NULL;

ALTER TABLE public.transactions ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_account_org_fk
  FOREIGN KEY (account_id, organization_id)
  REFERENCES public.payment_accounts (id, organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_account_date
  ON public.transactions (organization_id, account_id, business_date);

CREATE TABLE IF NOT EXISTS public.account_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  transfer_id UUID REFERENCES public.account_transfers(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'OPENING_BALANCE', 'INCOME', 'EXPENSE', 'CAPITAL', 'INVESTMENT',
    'WITHDRAWAL', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'REVERSAL'
  )),
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa <> 0),
  balance_after_paisa BIGINT NOT NULL,
  business_date DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (account_id, organization_id) REFERENCES public.payment_accounts (id, organization_id),
  CHECK (transaction_id IS NULL OR transfer_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_account_ledger_org_account_date
  ON public.account_ledger_entries (organization_id, account_id, business_date, created_at);
ALTER TABLE public.account_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_ledger_entries FORCE ROW LEVEL SECURITY;
GRANT SELECT ON public.account_ledger_entries TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.account_ledger_entries FROM authenticated, anon, public;
CREATE POLICY account_ledger_entries_select ON public.account_ledger_entries
  FOR SELECT TO authenticated
  USING (public.is_active_shop_member() AND organization_id = public.get_auth_org_id());

CREATE OR REPLACE FUNCTION private.record_account_opening_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.balance_paisa > 0 THEN
    INSERT INTO public.account_ledger_entries (
      organization_id, account_id, entry_type, amount_paisa,
      balance_after_paisa, business_date, created_by
    ) VALUES (
      NEW.organization_id, NEW.id, 'OPENING_BALANCE', NEW.balance_paisa,
      NEW.balance_paisa, (NOW() AT TIME ZONE 'Asia/Karachi')::DATE, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_record_account_opening_balance ON public.payment_accounts;
CREATE TRIGGER trg_record_account_opening_balance
AFTER INSERT ON public.payment_accounts
FOR EACH ROW EXECUTE FUNCTION private.record_account_opening_balance();

REVOKE UPDATE (current_balance, balance_paisa, opening_balance)
  ON public.payment_accounts FROM authenticated;

CREATE OR REPLACE FUNCTION private.apply_account_delta(
  target_account_id UUID, target_org_id UUID, delta_paisa BIGINT,
  target_entry_type TEXT, target_date DATE, target_user_id UUID,
  target_transaction_id UUID DEFAULT NULL, target_transfer_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  new_balance BIGINT;
BEGIN
  IF delta_paisa = 0 THEN RETURN; END IF;
  UPDATE public.payment_accounts
  SET balance_paisa = balance_paisa + delta_paisa,
      current_balance = (balance_paisa + delta_paisa)::NUMERIC / 100
  WHERE id = target_account_id AND organization_id = target_org_id
    AND is_active AND balance_paisa + delta_paisa >= 0
  RETURNING balance_paisa INTO new_balance;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.payment_accounts WHERE id = target_account_id AND organization_id = target_org_id) THEN
      RAISE EXCEPTION 'Insufficient account balance';
    END IF;
    RAISE EXCEPTION 'Account does not belong to this shop or is inactive';
  END IF;
  INSERT INTO public.account_ledger_entries (
    organization_id, account_id, transaction_id, transfer_id, entry_type,
    amount_paisa, balance_after_paisa, business_date, created_by
  ) VALUES (
    target_org_id, target_account_id, target_transaction_id, target_transfer_id,
    target_entry_type, delta_paisa, new_balance, target_date, target_user_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.apply_account_delta(UUID, UUID, BIGINT, TEXT, DATE, UUID, UUID, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.ledger_transaction_delta(
  transaction_type public.transaction_type, amount_paisa BIGINT,
  adjustment_dir public.adjustment_direction
)
RETURNS BIGINT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE transaction_type
    WHEN 'income' THEN RETURN amount_paisa;
    WHEN 'capital_in' THEN RETURN amount_paisa;
    WHEN 'investment' THEN RETURN amount_paisa;
    WHEN 'expense' THEN RETURN -amount_paisa;
    WHEN 'withdrawal' THEN RETURN -amount_paisa;
    WHEN 'adjustment' THEN
      IF adjustment_dir = 'in' THEN RETURN amount_paisa; END IF;
      IF adjustment_dir = 'out' THEN RETURN -amount_paisa; END IF;
      RAISE EXCEPTION 'Adjustment direction is required';
    ELSE RAISE EXCEPTION 'Unsupported account transaction type';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_transaction_account_posting()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.account_posted := TRUE;
  ELSE NEW.account_posted := OLD.account_posted;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_transaction_account_posting ON public.transactions;
CREATE TRIGGER trg_protect_transaction_account_posting
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION private.protect_transaction_account_posting();

CREATE OR REPLACE FUNCTION private.post_ledger_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  old_delta BIGINT;
  new_delta BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      new_delta := private.ledger_transaction_delta(NEW.type, NEW.amount_paisa, NEW.adjustment_dir);
      PERFORM private.apply_account_delta(
        NEW.account_id, NEW.organization_id, new_delta,
        CASE NEW.type WHEN 'capital_in' THEN 'CAPITAL' WHEN 'investment' THEN 'INVESTMENT'
          WHEN 'withdrawal' THEN 'WITHDRAWAL' WHEN 'adjustment' THEN 'ADJUSTMENT' ELSE UPPER(NEW.type::TEXT) END,
        NEW.business_date, NEW.created_by, NEW.id, NULL
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NOT OLD.account_posted THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status AND NEW.account_id = OLD.account_id
     AND NEW.amount_paisa = OLD.amount_paisa AND NEW.type = OLD.type
     AND NEW.adjustment_dir IS NOT DISTINCT FROM OLD.adjustment_dir THEN RETURN NEW; END IF;

  IF OLD.status = 'active' THEN
    old_delta := private.ledger_transaction_delta(OLD.type, OLD.amount_paisa, OLD.adjustment_dir);
    PERFORM private.apply_account_delta(
      OLD.account_id, OLD.organization_id, -old_delta, 'REVERSAL',
      OLD.business_date, COALESCE(auth.uid(), OLD.created_by), OLD.id, NULL
    );
  END IF;
  IF NEW.status = 'active' THEN
    new_delta := private.ledger_transaction_delta(NEW.type, NEW.amount_paisa, NEW.adjustment_dir);
    PERFORM private.apply_account_delta(
      NEW.account_id, NEW.organization_id, new_delta,
      CASE NEW.type WHEN 'capital_in' THEN 'CAPITAL' WHEN 'investment' THEN 'INVESTMENT'
        WHEN 'withdrawal' THEN 'WITHDRAWAL' WHEN 'adjustment' THEN 'ADJUSTMENT' ELSE UPPER(NEW.type::TEXT) END,
      NEW.business_date, COALESCE(auth.uid(), NEW.created_by), NEW.id, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_ledger_transaction ON public.transactions;
CREATE TRIGGER trg_post_ledger_transaction
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION private.post_ledger_transaction();

ALTER TABLE public.account_transfers
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS account_posted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.account_transfers ADD CONSTRAINT account_transfers_status_check
  CHECK (status IN ('ACTIVE', 'VOIDED'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_account_transfers_idempotency
  ON public.account_transfers (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION private.protect_account_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.from_account_id = NEW.to_account_id THEN RAISE EXCEPTION 'Source and destination accounts must be different'; END IF;
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Transfer amount must be greater than zero'; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.account_posted := TRUE;
    NEW.date := (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
  ELSE
    NEW.account_posted := OLD.account_posted;
    IF NEW.status = 'VOIDED' AND COALESCE(NULLIF(BTRIM(NEW.void_reason), ''), '') = '' THEN
      RAISE EXCEPTION 'A reason is required to void a transfer';
    END IF;
    IF NEW.status = 'VOIDED' AND NEW.voided_at IS NULL THEN
      NEW.voided_at := NOW(); NEW.voided_by := COALESCE(auth.uid(), OLD.voided_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_account_transfer ON public.account_transfers;
CREATE TRIGGER trg_protect_account_transfer
BEFORE INSERT OR UPDATE ON public.account_transfers
FOR EACH ROW EXECUTE FUNCTION private.protect_account_transfer();

CREATE OR REPLACE FUNCTION private.post_account_transfer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  transfer_paisa BIGINT := ROUND(NEW.amount * 100)::BIGINT;
  old_transfer_paisa BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status
     AND NEW.from_account_id = OLD.from_account_id AND NEW.to_account_id = OLD.to_account_id
     AND NEW.amount = OLD.amount THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT OLD.account_posted THEN RETURN NEW; END IF;

  PERFORM id FROM public.payment_accounts
  WHERE id IN (NEW.from_account_id, NEW.to_account_id)
  ORDER BY id FOR UPDATE;

  IF TG_OP = 'UPDATE' AND OLD.account_posted AND OLD.status = 'ACTIVE' THEN
    old_transfer_paisa := ROUND(OLD.amount * 100)::BIGINT;
    PERFORM private.apply_account_delta(OLD.from_account_id, OLD.organization_id, old_transfer_paisa,
      'REVERSAL', OLD.date, COALESCE(auth.uid(), OLD.created_by::UUID), NULL, OLD.id);
    PERFORM private.apply_account_delta(OLD.to_account_id, OLD.organization_id, -old_transfer_paisa,
      'REVERSAL', OLD.date, COALESCE(auth.uid(), OLD.created_by::UUID), NULL, OLD.id);
  END IF;

  IF NEW.status = 'ACTIVE' THEN
    PERFORM private.apply_account_delta(NEW.from_account_id, NEW.organization_id, -transfer_paisa,
      'TRANSFER_OUT', NEW.date, COALESCE(auth.uid(), NEW.created_by::UUID), NULL, NEW.id);
    PERFORM private.apply_account_delta(NEW.to_account_id, NEW.organization_id, transfer_paisa,
      'TRANSFER_IN', NEW.date, COALESCE(auth.uid(), NEW.created_by::UUID), NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_account_transfer ON public.account_transfers;
CREATE TRIGGER trg_post_account_transfer
AFTER INSERT OR UPDATE ON public.account_transfers
FOR EACH ROW EXECUTE FUNCTION private.post_account_transfer();

INSERT INTO public.account_ledger_entries (
  organization_id, account_id, entry_type, amount_paisa,
  balance_after_paisa, business_date, created_by
)
SELECT organization_id, id, 'OPENING_BALANCE', balance_paisa, balance_paisa,
  (NOW() AT TIME ZONE 'Asia/Karachi')::DATE, NULL
FROM public.payment_accounts
WHERE balance_paisa <> 0;