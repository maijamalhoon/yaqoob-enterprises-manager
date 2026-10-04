import React, { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Building2,
  Check,
  Landmark,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { ledgerService } from "../../services/ledgerService";
import { formatPaisa, parseInputToPaisa } from "../../lib/money";
import { AccountLedgerEntry, LedgerAccount } from "../../types/ledger";

type AccountKind = LedgerAccount["type"];

const accountIcon = (type: AccountKind) => {
  if (type === "BANK") return Landmark;
  if (type === "DIGITAL_WALLET") return Building2;
  return Wallet;
};

export const AccountsView: React.FC = () => {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<AccountLedgerEntry[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountKind>("CASH");
  const [openingAmount, setOpeningAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAccounts = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await ledgerService.getPaymentAccounts();
      setAccounts(result);
      setSelectedAccountId((current) =>
        result.some((account) => account.id === current) ? current : (
          result[0]?.id || ""
        ),
      );
    } catch (loadError) {
      console.error("Could not load accounts:", loadError);
      setError("Accounts could not be loaded. Please refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  useEffect(() => {
    if (!selectedAccountId) {
      setEntries([]);
      return;
    }
    ledgerService
      .getAccountLedger(selectedAccountId)
      .then(setEntries)
      .catch((loadError) => {
        console.error("Could not load account history:", loadError);
        setEntries([]);
      });
  }, [selectedAccountId]);

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const parsed =
      openingAmount.trim() ?
        parseInputToPaisa(openingAmount)
      : { isValid: true, paisa: 0 };
    if (!parsed.isValid || parsed.paisa < 0) {
      setError("Enter a valid opening balance.");
      return;
    }

    setIsCreating(true);
    try {
      const account = await ledgerService.createPaymentAccount({
        name: accountName,
        type: accountType,
        openingBalancePaisa: parsed.paisa,
      });
      setAccountName("");
      setOpeningAmount("");
      setSelectedAccountId(account.id);
      setMessage("Account created.");
      await loadAccounts();
    } catch (createError) {
      console.error("Could not create account:", createError);
      setError(
        "Account could not be created. Check your details and try again.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveName = async (accountId: string) => {
    try {
      await ledgerService.updatePaymentAccount(accountId, {
        name: editingName,
      });
      setEditingAccountId("");
      setMessage("Account name updated.");
      await loadAccounts();
    } catch (updateError) {
      console.error("Could not update account:", updateError);
      setError("Account could not be updated. Please try again.");
    }
  };

  const handleDeactivate = async (account: LedgerAccount) => {
    try {
      await ledgerService.updatePaymentAccount(account.id, {
        is_active: !account.is_active,
      });
      setMessage(
        account.is_active ? "Account deactivated." : "Account reactivated.",
      );
      await loadAccounts();
    } catch (updateError) {
      console.error("Could not change account status:", updateError);
      setError("Account status could not be changed. Please try again.");
    }
  };

  const handleTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const parsed = parseInputToPaisa(transferAmount);
    if (!parsed.isValid || parsed.paisa <= 0) {
      setError("Enter a transfer amount greater than zero.");
      return;
    }

    setIsTransferring(true);
    try {
      await ledgerService.transferBetweenAccounts({
        fromAccountId: sourceAccountId,
        toAccountId: destinationAccountId,
        amountPaisa: parsed.paisa,
      });
      setTransferAmount("");
      setMessage("Transfer recorded.");
      await loadAccounts();
    } catch (transferError) {
      console.error("Could not transfer account funds:", transferError);
      setError(
        (
          transferError instanceof Error &&
            transferError.message === "Insufficient account balance"
        ) ?
          "This account does not have enough funds for that transfer."
        : "Transfer could not be completed. Check the accounts and try again.",
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const activeAccounts = accounts.filter((account) => account.is_active);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-on-surface">Accounts</h1>
            <p className="mt-1 text-sm text-text-muted">
              Wallets and bank balances for this shop.
            </p>
          </div>
          <p className="font-mono text-lg font-semibold tabular-nums text-on-surface">
            {formatPaisa(
              activeAccounts.reduce(
                (total, account) => total + account.balance_paisa,
                0,
              ),
            )}{" "}
            total
          </p>
        </header>

        {(error || message) && (
          <p
            role={error ? "alert" : "status"}
            className={`rounded-md border px-3 py-2 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-success-border bg-success-bg text-primary"}`}
          >
            {error || message}
          </p>
        )}

        <section className="overflow-hidden rounded-lg border border-border-standard bg-white">
          <div className="border-b border-border-standard px-4 py-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Your accounts
            </h2>
          </div>
          {isLoading ?
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              Loading accounts…
            </p>
          : accounts.length === 0 ?
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              No accounts yet. Add an account to start tracking money.
            </p>
          : <div className="divide-y divide-border-standard">
              {accounts.map((account) => {
                const Icon = accountIcon(account.type);
                const isEditing = editingAccountId === account.id;
                const canDeactivate =
                  account.balance_paisa === 0 && activeAccounts.length > 1;
                return (
                  <article
                    key={account.id}
                    className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${selectedAccountId === account.id ? "bg-surface-container-low/50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(account.id)}
                      className="flex min-w-0 items-center gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        {isEditing ?
                          <input
                            aria-label="Account name"
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            className="h-9 w-full rounded-md border border-border-standard px-2 text-sm focus:border-primary focus:outline-none"
                          />
                        : <span className="block truncate text-sm font-semibold text-on-surface">
                            {account.name}
                          </span>
                        }
                        <span className="mt-0.5 block text-xs text-text-muted">
                          {account.type.replace("_", " ")}
                          {account.is_default ? " · Default" : ""}
                          {!account.is_active ? " · Inactive" : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="font-mono text-sm font-semibold tabular-nums text-on-surface">
                        {formatPaisa(account.balance_paisa)}
                      </span>
                      {isEditing ?
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleSaveName(account.id)}
                            aria-label="Save account name"
                            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white hover:bg-primary-hover"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAccountId("")}
                            aria-label="Cancel edit"
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-border-standard text-secondary hover:bg-surface-container-low"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      : <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAccountId(account.id);
                              setEditingName(account.name);
                            }}
                            className="min-h-9 rounded-md border border-border-standard px-2.5 text-xs text-secondary hover:bg-surface-container-low"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(account)}
                            disabled={account.is_active && !canDeactivate}
                            title={
                              account.is_active && !canDeactivate ?
                                "Move the balance and keep at least one active account"
                              : undefined
                            }
                            className="min-h-9 rounded-md border border-border-standard px-2.5 text-xs text-secondary hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {account.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      }
                    </div>
                  </article>
                );
              })}
            </div>
          }
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-border-standard bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-on-surface">
                Add account
              </h2>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <label className="block space-y-1 text-xs font-semibold text-secondary">
                <span>Account name</span>
                <input
                  required
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="e.g. HBL Business"
                  className="h-10 w-full rounded-md border border-border-standard px-3 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs font-semibold text-secondary">
                  <span>Type</span>
                  <select
                    value={accountType}
                    onChange={(event) =>
                      setAccountType(event.target.value as AccountKind)
                    }
                    className="h-10 w-full rounded-md border border-border-standard bg-white px-2.5 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                  >
                    <option value="CASH">Cash wallet</option>
                    <option value="BANK">Bank account</option>
                    <option value="DIGITAL_WALLET">Digital wallet</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="block space-y-1 text-xs font-semibold text-secondary">
                  <span>Opening balance (Rs.)</span>
                  <input
                    inputMode="decimal"
                    value={openingAmount}
                    onChange={(event) => setOpeningAmount(event.target.value)}
                    placeholder="0"
                    className="h-10 w-full rounded-md border border-border-standard px-3 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />{" "}
                {isCreating ? "Adding…" : "Add account"}
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-border-standard bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <ArrowLeftRight
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold text-on-surface">
                Transfer between accounts
              </h2>
            </div>
            <form onSubmit={handleTransfer} className="space-y-3">
              <label className="block space-y-1 text-xs font-semibold text-secondary">
                <span>From</span>
                <select
                  required
                  value={sourceAccountId}
                  onChange={(event) => setSourceAccountId(event.target.value)}
                  className="h-10 w-full rounded-md border border-border-standard bg-white px-2.5 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="">Select source account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {formatPaisa(account.balance_paisa)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold text-secondary">
                <span>To</span>
                <select
                  required
                  value={destinationAccountId}
                  onChange={(event) =>
                    setDestinationAccountId(event.target.value)
                  }
                  className="h-10 w-full rounded-md border border-border-standard bg-white px-2.5 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="">Select destination account</option>
                  {activeAccounts
                    .filter((account) => account.id !== sourceAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold text-secondary">
                <span>Amount (Rs.)</span>
                <input
                  required
                  inputMode="decimal"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-md border border-border-standard px-3 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={
                  isTransferring || !sourceAccountId || !destinationAccountId
                }
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-border-standard bg-white px-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-low disabled:opacity-50"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />{" "}
                {isTransferring ? "Transferring…" : "Transfer funds"}
              </button>
            </form>
          </section>
        </div>

        {selectedAccount && (
          <section className="overflow-hidden rounded-lg border border-border-standard bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-border-standard px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">
                  {selectedAccount.name}
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  Recent account activity
                </p>
              </div>
              <p className="font-mono text-sm font-semibold tabular-nums text-on-surface">
                {formatPaisa(selectedAccount.balance_paisa)}
              </p>
            </div>
            {entries.length === 0 ?
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                No account activity yet.
              </p>
            : <div className="divide-y divide-border-standard">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {entry.entry_type.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {entry.business_date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-mono text-sm font-semibold tabular-nums ${entry.amount_paisa > 0 ? "text-primary" : "text-rose-700"}`}
                      >
                        {entry.amount_paisa > 0 ? "+" : "-"}
                        {formatPaisa(Math.abs(entry.amount_paisa))}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        Balance {formatPaisa(entry.balance_after_paisa)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            }
          </section>
        )}
      </div>
    </div>
  );
};
