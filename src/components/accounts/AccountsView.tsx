import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { accountRepo } from '../../services';
import { PaymentAccount, AccountTransaction } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  Landmark,
  Plus,
  ArrowRightLeft,
  Wallet,
  Building2,
  Smartphone,
  ArrowDown,
  Check,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Layers,
} from 'lucide-react';

export const AccountsView: React.FC = () => {
  const { organization, user } = useAuth();
  const { dataVersion, refreshData, showToast } = useApp();

  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');

  // Transfer Form (both inline on right panel and accessible via quick transfer)
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // New Account Modal
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [accForm, setAccForm] = useState<{
    name: string;
    type: PaymentAccount['type'];
    account_number: string;
    opening_balance: number;
  }>({
    name: '',
    type: 'BANK',
    account_number: '',
    opening_balance: 0,
  });

  useEffect(() => {
    async function loadAccounts() {
      const [accList, txList] = await Promise.all([
        accountRepo.getAccounts(organization.id),
        accountRepo.getTransactions(organization.id),
      ]);
      setAccounts(accList);
      setTransactions(txList);
      if (accList.length >= 2) {
        setFromAccountId((prev) => prev || accList[0].id);
        setToAccountId((prev) => prev || accList[1].id);
      } else if (accList.length === 1) {
        setFromAccountId((prev) => prev || accList[0].id);
      }
    }
    loadAccounts();
  }, [organization.id, dataVersion]);

  // Total Liquidity
  const totalLiquidity = useMemo(() => {
    return accounts.reduce((acc, a) => acc + (a.current_balance || 0), 0);
  }, [accounts]);

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      showToast('error', 'Invalid Amount', 'Enter a positive transfer amount');
      return;
    }
    if (fromAccountId === toAccountId) {
      showToast('error', 'Same Account', 'Source and destination accounts must be different');
      return;
    }

    const sourceAcc = accounts.find((a) => a.id === fromAccountId);
    if (sourceAcc && sourceAcc.current_balance < amt) {
      showToast(
        'warning',
        'Insufficient Funds Warning',
        `Account balance is ${formatCurrency(sourceAcc.current_balance, organization.currency_symbol)}`
      );
    }

    setIsSubmitting(true);
    try {
      await accountRepo.transferFunds(organization.id, {
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: amt,
        notes: transferNotes.trim() || undefined,
        date: new Date().toISOString().split('T')[0],
        created_by: user?.full_name || 'Muhammad Yaqoob',
      });

      showToast(
        'success',
        'Funds Transferred',
        `${formatCurrency(amt, organization.currency_symbol)} transferred successfully.`
      );
      setTransferAmount('');
      setTransferNotes('');
      refreshData();
    } catch (err: any) {
      showToast('error', 'Transfer Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accForm.name.trim()) return;

    try {
      await accountRepo.saveAccount(organization.id, {
        name: accForm.name.trim(),
        type: accForm.type,
        account_number: accForm.account_number.trim() || undefined,
        opening_balance: Number(accForm.opening_balance) || 0,
        current_balance: Number(accForm.opening_balance) || 0,
      });

      showToast('success', 'Account Added', `${accForm.name} is now available in treasury`);
      setIsNewAccountModalOpen(false);
      setAccForm({ name: '', type: 'BANK', account_number: '', opening_balance: 0 });
      refreshData();
    } catch (err: any) {
      showToast('error', 'Failed to Add Account', err.message);
    }
  };

  const filteredTransactions =
    selectedAccountId === 'ALL'
      ? transactions
      : transactions.filter((t) => t.account_id === selectedAccountId);

  return (
    <div className="space-y-6 select-none text-[#14181f]">
      {/* Top Hero Bar / Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#667085] text-xs uppercase tracking-wider font-semibold">
            <span>Treasury Management</span>
            <span>•</span>
            <span className="text-[#16a34a] font-medium">Active Till Sync</span>
          </div>
          <h1 className="text-2xl font-bold text-[#14181f] tracking-tight">
            Accounts & Wallets
          </h1>
          <p className="text-xs text-[#667085] max-w-2xl">
            Multi-channel balance overview, liquidity status, and internal funds transfer for solo shop owner.
          </p>
        </div>

        {/* Actions & Aggregate Metric */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-[#e6e8ec] shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#667085] font-semibold uppercase leading-tight">
                Total Liquidity
              </span>
              <span className="text-lg font-mono font-bold text-[#14181f] tracking-tight">
                {formatCurrency(totalLiquidity, organization.currency_symbol)}
              </span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              amountInputRef.current?.focus();
              amountInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            <ArrowRightLeft className="h-4 w-4 text-[#4f46e5]" />
            <span>Quick Transfer</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsNewAccountModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </Button>
        </div>
      </div>

      {/* 4-Column Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => {
          const isCash = acc.type === 'CASH';
          const isBank = acc.type === 'BANK';
          const isSelected = selectedAccountId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccountId(isSelected ? 'ALL' : acc.id)}
              className={`bg-white rounded-xl p-5 border transition-all cursor-pointer shadow-sm flex flex-col justify-between hover:shadow-md ${
                isSelected
                  ? 'border-[#4f46e5] ring-2 ring-[#4f46e5]/20'
                  : 'border-[#e6e8ec] hover:border-[#d0d5dd]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#4f46e5]">
                    {isCash ? (
                      <Wallet className="h-5 w-5" />
                    ) : isBank ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <Smartphone className="h-5 w-5 text-[#4f46e5]" />
                    )}
                  </div>
                  <Badge
                    variant={isCash ? 'primary' : isBank ? 'neutral' : 'emerald'}
                    size="sm"
                  >
                    {isCash ? 'Cash Drawer' : isBank ? 'Main Clearing' : 'Digital QR'}
                  </Badge>
                </div>

                <div>
                  <span className="text-xs text-[#667085] font-medium block truncate">
                    {acc.name}
                  </span>
                  <div className="text-2xl font-mono font-bold text-[#14181f] tracking-tight mt-1">
                    {formatCurrency(acc.current_balance, organization.currency_symbol)}
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
                <span className="font-mono text-[11px] truncate">
                  {acc.account_number ? `#${acc.account_number}` : 'Till Register'}
                </span>
                <span className="text-[#16a34a] font-medium text-[11px]">Synced</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-Column Workspace (65% / 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Column: Ledger Table (8 cols / ~66%) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-[#e6e8ec] shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e6e8ec]">
            <div>
              <h2 className="text-base font-bold text-[#14181f]">
                Recent Account Transactions
              </h2>
              <p className="text-xs text-[#667085]">
                Combined multi-channel movements across registers and merchant wallets
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedAccountId('ALL')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedAccountId === 'ALL'
                    ? 'bg-[#f8f9fb] border border-[#e6e8ec] text-[#14181f] font-semibold'
                    : 'text-[#667085] hover:text-[#14181f]'
                }`}
              >
                All Accounts
              </button>
              <span className="text-xs text-[#667085] font-mono">
                ({filteredTransactions.length})
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fb] text-[#667085] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e6e8ec]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Account</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec] text-xs">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#667085]">
                      No transactions recorded for this account.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.slice(0, 15).map((tx) => {
                    const isPositive = ['INCOME', 'TRANSFER_IN', 'ADJUSTMENT'].includes(tx.type);
                    const acc = accounts.find((a) => a.id === tx.account_id);

                    return (
                      <tr key={tx.id} className="hover:bg-[#f8f9fb] transition-colors">
                        <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#14181f] whitespace-nowrap">
                          {acc?.name || 'Treasury'}
                        </td>
                        <td className="py-3 px-3 text-[#14181f]">
                          <div className="truncate max-w-[220px]">{tx.description}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[11px] text-[#667085] bg-[#f8f9fb] px-2 py-0.5 rounded border border-[#e6e8ec]">
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-right whitespace-nowrap">
                          <span className={isPositive ? 'text-[#16a34a]' : 'text-[#dc2626]'}>
                            {isPositive ? '+' : '-'}
                            {formatCurrency(tx.amount, organization.currency_symbol)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[#f0fdf4] text-[#16a34a] font-semibold">
                            Cleared
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 bg-[#f8f9fb] border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
            <span>Showing recent transaction ledger</span>
            {selectedAccountId !== 'ALL' && (
              <button
                onClick={() => setSelectedAccountId('ALL')}
                className="text-[#4f46e5] font-semibold hover:underline cursor-pointer"
              >
                Reset Account Filter
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Transfer Between Accounts (4 cols / ~34%) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#e6e8ec] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#eef2ff] text-[#4f46e5]">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-[#14181f]">
                  Transfer Between Accounts
                </h2>
              </div>
              <ShieldCheck className="h-4 w-4 text-[#16a34a]" />
            </div>

            <p className="text-xs text-[#667085]">
              Move funds instantly between cash drawer, company bank accounts, and merchant wallets.
            </p>

            <form onSubmit={handleExecuteTransfer} className="space-y-3 pt-1">
              {/* From Field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#14181f]">
                  From Account (Debit)
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f8f9fb] border border-[#e6e8ec] text-[#14181f] rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.current_balance, organization.currency_symbol)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Direction Indicator */}
              <div className="flex justify-center -my-1">
                <div className="w-7 h-7 rounded-full bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#667085]">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* To Field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#14181f]">
                  To Account (Credit)
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f8f9fb] border border-[#e6e8ec] text-[#14181f] rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.current_balance, organization.currency_symbol)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#14181f]">
                  Amount ({organization.currency_symbol})
                </label>
                <input
                  ref={amountInputRef}
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f8f9fb] border border-[#e6e8ec] text-[#14181f] rounded-lg text-xs font-mono font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                />
              </div>

              {/* Optional Note */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#14181f]">
                  Optional Reference / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Evening bank deposit"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f8f9fb] border border-[#e6e8ec] text-[#14181f] rounded-lg text-xs placeholder:text-[#667085] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                className="w-full mt-2"
              >
                <Check className="h-4 w-4" />
                <span>Transfer Funds</span>
              </Button>
            </form>
          </div>

          {/* Instant Notice Banner */}
          <div className="mt-5 p-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg flex items-start gap-2 text-[#667085] text-xs">
            <CheckCircle className="h-4 w-4 text-[#16a34a] shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Internal transfers update real-time liquidity and ledger immediately without settlement delay.
            </span>
          </div>
        </div>
      </div>

      {/* Add New Account Modal */}
      <Modal
        isOpen={isNewAccountModalOpen}
        onClose={() => setIsNewAccountModalOpen(false)}
        title="Add New Payment Account"
        description="Register a new cash drawer, merchant bank account, or digital wallet."
        maxWidth="md"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4 py-1">
          <Input
            label="Account Display Name"
            required
            autoFocus
            placeholder="e.g. Meezan Bank Current Account or Shop Cash Register 2"
            value={accForm.name}
            onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#14181f] mb-1.5">
                Account Type
              </label>
              <select
                value={accForm.type}
                onChange={(e) =>
                  setAccForm({ ...accForm, type: e.target.value as PaymentAccount['type'] })
                }
                className="w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none"
              >
                <option value="CASH">Cash Drawer</option>
                <option value="BANK">Commercial Bank</option>
                <option value="DIGITAL_WALLET">Digital Wallet (JazzCash/Easypaisa)</option>
                <option value="OTHER">Other Financial Account</option>
              </select>
            </div>

            <Input
              label="Account / IBAN Number"
              placeholder="e.g. 0234010098483"
              value={accForm.account_number}
              onChange={(e) => setAccForm({ ...accForm, account_number: e.target.value })}
            />
          </div>

          <Input
            label={`Opening Balance (${organization.currency_symbol})`}
            type="number"
            step="any"
            value={accForm.opening_balance}
            onChange={(e) =>
              setAccForm({ ...accForm, opening_balance: parseFloat(e.target.value) || 0 })
            }
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6e8ec]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsNewAccountModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Check className="h-4 w-4" />
              <span>Create Account</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
