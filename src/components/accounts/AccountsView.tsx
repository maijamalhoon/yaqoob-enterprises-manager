import React, { useState, useEffect } from 'react';
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
  ArrowDownRight,
  ArrowUpRight,
  Check,
} from 'lucide-react';

export const AccountsView: React.FC = () => {
  const { organization, user } = useAuth();
  const { dataVersion, refreshData, showToast } = useApp();

  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setFromAccountId(accList[0].id);
        setToAccountId(accList[1].id);
      }
    }
    loadAccounts();
  }, [organization.id, dataVersion]);

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      showToast('error', 'Invalid Amount', 'Enter positive transfer amount');
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
        created_by: user?.full_name || 'Staff Cashier',
      });

      showToast(
        'success',
        'Funds Transferred',
        `${formatCurrency(amt, organization.currency_symbol)} transferred successfully.`
      );
      setIsTransferModalOpen(false);
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

      showToast('success', 'Account Added', `${accForm.name} is now available`);
      setIsNewAccountModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast('error', 'Failed', err.message);
    }
  };

  const filteredTransactions =
    selectedAccountId === 'ALL'
      ? transactions
      : transactions.filter((t) => t.account_id === selectedAccountId);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#f5f7fa] select-none text-[#102a43]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#d9e2ec]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#102a43]">
            Payment Accounts & Cash Drawer
          </h1>
          <p className="text-xs text-[#627d98] mt-0.5">
            Liquid balances, cash box auditing, bank deposits, and inter-account transfers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsTransferModalOpen(true)}
          >
            <ArrowRightLeft className="h-4 w-4 text-teal-700" />
            <span>Transfer Funds</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewAccountModalOpen(true)}
            className="font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </Button>
        </div>
      </div>

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {accounts.map((acc) => {
          const isCash = acc.type === 'CASH';
          const isBank = acc.type === 'BANK';

          return (
            <Card
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`p-4 cursor-pointer transition-all border ${
                selectedAccountId === acc.id
                  ? 'border-teal-700 bg-teal-50/40 shadow-sm'
                  : 'border-[#d9e2ec] bg-white hover:border-[#bcccdc]'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-[8px] bg-[#f5f7fa] border border-[#d9e2ec] text-teal-800">
                  {isCash ? (
                    <Wallet className="h-4 w-4" />
                  ) : isBank ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <Smartphone className="h-4 w-4 text-teal-700" />
                  )}
                </div>
                <Badge variant={isCash ? 'teal' : isBank ? 'slate' : 'emerald'} size="sm">
                  {acc.type}
                </Badge>
              </div>

              <h3 className="text-sm font-semibold text-[#102a43] truncate">{acc.name}</h3>
              {acc.account_number && (
                <p className="text-[10px] font-mono text-[#627d98] truncate mt-0.5">
                  #{acc.account_number}
                </p>
              )}

              <div className="mt-3 pt-2 border-t border-[#d9e2ec] flex items-baseline justify-between">
                <span className="text-[10px] text-[#627d98] font-mono">Current Balance</span>
                <span className="text-base font-mono font-bold text-[#102a43]">
                  {formatCurrency(acc.current_balance, organization.currency_symbol)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Transactions Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#102a43]">Account Movement Ledger</h2>
            {selectedAccountId !== 'ALL' && (
              <button
                onClick={() => setSelectedAccountId('ALL')}
                className="text-[11px] text-teal-700 hover:underline cursor-pointer"
              >
                (View All Accounts)
              </button>
            )}
          </div>
          <span className="text-xs text-[#627d98] font-mono">
            {filteredTransactions.length} records
          </span>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Account</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {filteredTransactions.map((tx) => {
                  const isPositive = ['INCOME', 'TRANSFER_IN', 'ADJUSTMENT'].includes(tx.type);

                  return (
                    <tr key={tx.id} className="hover:bg-[#f5f7fa] transition-colors">
                      <td className="py-3 px-4 font-mono text-[#627d98]">{tx.date}</td>
                      <td className="py-3 px-3 font-semibold text-[#102a43]">
                        {accounts.find((a) => a.id === tx.account_id)?.name || 'Account'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            tx.type === 'INCOME'
                              ? 'emerald'
                              : tx.type === 'EXPENSE'
                              ? 'amber'
                              : 'teal'
                          }
                          size="sm"
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-[#243b53]">{tx.description}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-700' : 'text-amber-700'}>
                          {isPositive ? `+` : `-`}
                          {formatCurrency(tx.amount, organization.currency_symbol)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#243b53]">
                        {formatCurrency(tx.balance_after, organization.currency_symbol)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Transfer Funds Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Inter-Account Funds Transfer"
        description="Transfer liquid money between cash drawer, banks, or digital wallets."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#102a43] mb-1.5">
                From Account (Debit)
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full rounded-[8px] bg-white border border-[#d9e2ec] px-3 py-2 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.current_balance, organization.currency_symbol)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#102a43] mb-1.5">
                To Account (Credit)
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full rounded-[8px] bg-white border border-[#d9e2ec] px-3 py-2 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.current_balance, organization.currency_symbol)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label={`Transfer Amount (${organization.currency_symbol})`}
            type="number"
            step="any"
            required
            autoFocus
            placeholder="0.00"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            className="font-mono text-base font-bold text-teal-800"
          />

          <Input
            label="Transfer Reason / Deposit Slip Ref"
            placeholder="e.g. End of day cash deposit to HBL Main Branch"
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d9e2ec]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsTransferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              <Check className="h-4 w-4" />
              <span>Confirm Transfer</span>
            </Button>
          </div>
        </form>
      </Modal>

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
              <label className="block text-xs font-semibold text-[#102a43] mb-1.5">
                Account Type
              </label>
              <select
                value={accForm.type}
                onChange={(e) =>
                  setAccForm({ ...accForm, type: e.target.value as PaymentAccount['type'] })
                }
                className="w-full rounded-[8px] bg-white border border-[#d9e2ec] px-3 py-2 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d9e2ec]">
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
