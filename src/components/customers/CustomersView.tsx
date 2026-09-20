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
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Users, Plus, Search, Edit2, Phone, Mail, ShoppingCart, Check } from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { organization } = useAuth();
  const { dataVersion, refreshData, showToast, setCurrentView } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
      showToast('error', 'Failed', err.message);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      return (
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-950 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Customer Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Client contacts, purchase histories, credit receivables, and direct sale links.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => handleOpenModal()}
          className="font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>Add Customer</span>
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, mobile phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <span className="text-xs font-mono text-slate-400">
          Total Customers: {filteredCustomers.length}
        </span>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Address</th>
                <th className="py-3 px-3 text-right">Total Lifetime Purchases</th>
                <th className="py-3 px-3">Last Active</th>
                <th className="py-3 px-3 text-right">Receivables / Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-slate-900/70 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-200">{cust.name}</p>
                    {cust.notes && (
                      <p className="text-[10px] text-slate-500 truncate max-w-xs">{cust.notes}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 space-y-0.5">
                    {cust.phone && (
                      <div className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
                        <Phone className="h-3 w-3 text-slate-500" />
                        <span>{cust.phone}</span>
                      </div>
                    )}
                    {cust.email && (
                      <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                        <Mail className="h-3 w-3 text-slate-500" />
                        <span>{cust.email}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-400 truncate max-w-xs">
                    {cust.address || '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                    {formatCurrency(cust.total_purchases || 0, organization.currency_symbol)}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                    {cust.last_purchase_date
                      ? formatDateTime(cust.last_purchase_date)
                      : 'No purchases yet'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {cust.outstanding_balance > 0 ? (
                      <span className="text-amber-400 font-bold">
                        {formatCurrency(cust.outstanding_balance, organization.currency_symbol)}
                      </span>
                    ) : (
                      <span className="text-slate-500">Nil</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setCurrentView('pos');
                        }}
                        title="Start New Sale for Customer"
                        className="p-1.5 rounded text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(cust)}
                        title="Edit Customer"
                        className="p-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        description="Save client contact information and notes."
        maxWidth="md"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4 py-1">
          <Input
            label="Full Name / Company Name"
            required
            autoFocus
            placeholder="e.g. Tariq Mehmood Advocate or Allied Bank Branch"
            value={custForm.name}
            onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              placeholder="e.g. 0300-1234567"
              value={custForm.phone}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
            />

            <Input
              label="Email Address (Optional)"
              type="email"
              placeholder="customer@example.com"
              value={custForm.email}
              onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
            />
          </div>

          <Input
            label="Office / Delivery Address"
            placeholder="e.g. Chamber #14, District Courts, Gujranwala"
            value={custForm.address}
            onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
          />

          <Input
            label="Special Notes"
            placeholder="e.g. Standard 5% volume discount for legal document sets"
            value={custForm.notes}
            onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
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
