import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { customerRepo } from '../../services';
import { Customer } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { formatCurrency, formatDateTime, exportToCSV } from '../../lib/utils';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Phone,
  Mail,
  ShoppingCart,
  Check,
  Download,
  Clock,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { organization } = useAuth();
  const { dataVersion, refreshData, showToast, setCurrentView } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'UNSETTLED'>('ALL');

  // Customer Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custForm, setCustForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    async function loadCustomers() {
      const list = await customerRepo.getCustomers(organization.id);
      setCustomers(list);
    }
    loadCustomers();
  }, [organization.id, dataVersion]);

  // Derived Metrics
  const totalClients = customers.length;
  const unsettledCustomers = useMemo(() => {
    return customers.filter((c) => (c.outstanding_balance || 0) > 0);
  }, [customers]);

  const totalOutstanding = useMemo(() => {
    return unsettledCustomers.reduce((acc, c) => acc + c.outstanding_balance, 0);
  }, [unsettledCustomers]);

  const totalLifetimePurchases = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.total_purchases || 0), 0);
  }, [customers]);

  const handleOpenModal = (cust?: Customer) => {
    if (cust) {
      setEditingCustomer(cust);
      setCustForm({
        name: cust.name,
        phone: cust.phone || '',
        email: cust.email || '',
        address: cust.address || '',
        notes: cust.notes || '',
      });
    } else {
      setEditingCustomer(null);
      setCustForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name.trim()) return;

    try {
      await customerRepo.saveCustomer(organization.id, {
        id: editingCustomer ? editingCustomer.id : undefined,
        name: custForm.name.trim(),
        phone: custForm.phone.trim() || undefined,
        email: custForm.email.trim() || undefined,
        address: custForm.address.trim() || undefined,
        notes: custForm.notes.trim() || undefined,
      });

      showToast(
        'success',
        editingCustomer ? 'Customer Updated' : 'Customer Added',
        `${custForm.name} saved to directory`
      );
      setIsModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast('error', 'Failed to Save', err.message);
    }
  };

  const handleExportLedger = () => {
    const headers = ['Customer Name', 'Phone', 'Email', 'Address', 'Total Purchases', 'Khata Balance', 'Notes'];
    const rows = filteredCustomers.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.phone || '',
      c.email || '',
      `"${(c.address || '').replace(/"/g, '""')}"`,
      c.total_purchases || 0,
      c.outstanding_balance || 0,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);
    exportToCSV(`Customer_Directory_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    showToast('success', 'Ledger Exported', 'Customer ledger downloaded as CSV');
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const matchesQ =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      const matchesFilter = filterType === 'ALL' || (c.outstanding_balance || 0) > 0;
      return matchesQ && matchesFilter;
    });
  }, [customers, searchQuery, filterType]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 select-none text-[#14181f] min-h-0 bg-[#f8f9fb]">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#14181f] tracking-tight">Customer Directory</h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Manage customer contact details, purchase history, and Khata credit balances.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="secondary" size="md" onClick={handleExportLedger}>
            <Download className="h-4 w-4 text-[#667085]" />
            <span>Export Ledger</span>
          </Button>
          <Button variant="primary" size="md" onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4" />
            <span>+ Add Customer</span>
          </Button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Regular Clients */}
        <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#667085] block mb-1">
                Total Registered Clients
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#14181f] tracking-tight">
                  {totalClients}
                </span>
                <span className="text-xs text-[#667085]">clients</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#4f46e5]">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
            <span className="text-[#16a34a] font-medium flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Active Khata accounts
            </span>
            <span className="font-mono text-[11px]">Repeat buyers</span>
          </div>
        </div>

        {/* Card 2: Total Outstanding Balance */}
        <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
                  Outstanding Khata Receivables
                </span>
                {unsettledCustomers.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#fef2f2] text-[#dc2626] text-[10px] font-semibold">
                    {unsettledCustomers.length} Unsettled
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-[#dc2626] tracking-tight">
                  {formatCurrency(totalOutstanding, organization.currency_symbol)}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#fef2f2] border border-[#fee2e2] flex items-center justify-center text-[#dc2626]">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
            <span>Institutional khata credit</span>
            <span className="font-medium text-[#dc2626]">Pending Clearance</span>
          </div>
        </div>

        {/* Card 3: Lifetime Volume */}
        <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#667085] block mb-1">
                Lifetime Customer Purchases
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-[#16a34a] tracking-tight">
                  {formatCurrency(totalLifetimePurchases, organization.currency_symbol)}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#f0fdf4] border border-[#dcfce7] flex items-center justify-center text-[#16a34a]">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
            <span>Recorded client volume</span>
            <span className="text-[#16a34a] font-medium">Reconciled</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="bg-white p-4 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 text-[#667085] h-4 w-4" />
          <input
            type="text"
            id="customerSearchInput"
            placeholder="Search customer by name, phone, or company... (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg text-xs text-[#14181f] placeholder:text-[#667085] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`h-8 px-3 rounded-full transition-all whitespace-nowrap cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-[#4f46e5] text-white font-semibold'
                : 'bg-[#f8f9fb] border border-[#e6e8ec] text-[#667085] hover:text-[#14181f]'
            }`}
          >
            All Customers ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('UNSETTLED')}
            className={`h-8 px-3 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              filterType === 'UNSETTLED'
                ? 'bg-[#dc2626] text-white font-semibold'
                : 'bg-[#f8f9fb] border border-[#e6e8ec] text-[#667085] hover:text-[#14181f]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#dc2626]"></span>
            Outstanding Khata ({unsettledCustomers.length})
          </button>
        </div>
      </div>

      {/* Customers Master Table */}
      <div className="bg-white rounded-xl border border-[#e6e8ec] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fb] text-[#667085] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e6e8ec]">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Address</th>
                <th className="py-3 px-3 text-right">Lifetime Purchases</th>
                <th className="py-3 px-3 text-right">Khata Balance</th>
                <th className="py-3 px-3">Last Visit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8ec] text-xs">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#667085]">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const hasDue = (cust.outstanding_balance || 0) > 0;

                  return (
                    <tr key={cust.id} className="hover:bg-[#f8f9fb] transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center font-bold text-xs text-[#4f46e5] shrink-0">
                            {getInitials(cust.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-[#14181f] block leading-tight truncate">
                              {cust.name}
                            </span>
                            {cust.notes && (
                              <span className="text-[11px] text-[#667085] truncate block">
                                {cust.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {cust.phone ? (
                          <div className="flex items-center gap-1 font-mono text-[#14181f]">
                            <Phone className="h-3 w-3 text-[#667085]" />
                            <span>{cust.phone}</span>
                          </div>
                        ) : (
                          <span className="text-[#667085]">-</span>
                        )}
                        {cust.email && (
                          <div className="flex items-center gap-1 text-[11px] text-[#667085] mt-0.5">
                            <Mail className="h-3 w-3 text-[#667085]" />
                            <span>{cust.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-[#667085] max-w-xs truncate">
                        {cust.address || '-'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-[#14181f]">
                        {formatCurrency(cust.total_purchases || 0, organization.currency_symbol)}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {hasDue ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono font-bold text-[#dc2626]">
                              {formatCurrency(cust.outstanding_balance, organization.currency_symbol)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fef2f2] text-[#dc2626]">
                              Due
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f0fdf4] text-[#16a34a]">
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[#667085] text-[11px]">
                        {cust.last_purchase_date
                          ? formatDateTime(cust.last_purchase_date)
                          : 'Never'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setCurrentView('pos');
                            }}
                            title="Start POS Order"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Sale</span>
                          </Button>
                          <button
                            onClick={() => handleOpenModal(cust)}
                            className="w-8 h-8 rounded-lg hover:bg-[#f8f9fb] border border-transparent hover:border-[#e6e8ec] flex items-center justify-center text-[#667085] hover:text-[#14181f] transition-colors cursor-pointer"
                            title="Edit Customer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-[#f8f9fb] border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
          <span>
            Showing {filteredCustomers.length} of {customers.length} total customers
          </span>
          <span className="font-mono font-medium text-[#14181f]">
            Khata Outstanding: {formatCurrency(totalOutstanding, organization.currency_symbol)}
          </span>
        </div>
      </div>

      {/* Customer Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer Profile' : 'Add New Customer'}
        description="Save contact info, address, and credit account preferences."
        maxWidth="md"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4 py-1">
          <Input
            label="Full Name / Organization"
            required
            autoFocus
            value={custForm.name}
            onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
            placeholder="e.g. Tariq Mehmood (Al-Noor Architects)"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              value={custForm.phone}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
              placeholder="0300-1234567"
            />

            <Input
              label="Email Address"
              type="email"
              value={custForm.email}
              onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
              placeholder="client@company.com"
            />
          </div>

          <Input
            label="Physical Address / Shop Location"
            value={custForm.address}
            onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
            placeholder="e.g. Office 402, Commercial Hub, Main Market"
          />

          <Input
            label="Internal Notes / Account Category"
            value={custForm.notes}
            onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
            placeholder="e.g. Commercial Print Account, Net 15 days credit"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6e8ec]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Check className="h-4 w-4" />
              <span>Save Customer</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
