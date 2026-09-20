import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader, CardTitle } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { StorageEngine } from '../../services/storageEngine';
import {
  Settings,
  Save,
  Download,
  Upload,
  RefreshCw,
  Database,
  Cloud,
  Check,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

export const SettingsView: React.FC = () => {
  const { organization, updateOrganization, role } = useAuth();
  const { showToast, setIsSupabaseConfigOpen, refreshData } = useApp();

  const [form, setForm] = useState({
    name: organization.name,
    phone: organization.phone || '',
    email: organization.email || '',
    address: organization.address || '',
    invoice_prefix: organization.invoice_prefix || 'YE-',
    currency: organization.currency || 'PKR',
    currency_symbol: organization.currency_symbol || 'Rs.',
    tax_rate: organization.tax_rate || 0,
    receipt_footer: organization.receipt_footer || 'Thank you for choosing Yaqoob Enterprises!',
  });

  // Backup restore validation modal state
  const [pendingRestore, setPendingRestore] = useState<{
    rawText: string;
    archive: {
      format: string;
      version: string;
      exported_at: string;
      organization_name: string;
      counts: Record<string, number>;
    };
  } | null>(null);

  const [isRestoring, setIsRestoring] = useState(false);

  const isOwner = role === 'OWNER';

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      showToast('error', 'Access Denied', 'Only OWNER role can modify business configuration');
      return;
    }
    updateOrganization(form);
    showToast('success', 'Settings Saved', 'Business profile and receipt formatting updated');
  };

  const handleExportBackup = () => {
    if (!isOwner) {
      showToast('error', 'Access Denied', 'Database export requires OWNER privileges');
      return;
    }
    const backupJson = StorageEngine.exportData();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yaqoob_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Database Exported', 'Downloaded verified business archive with checksum');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) {
      showToast('error', 'Access Denied', 'Database restore requires OWNER privileges');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const validation = StorageEngine.validateBackup(text);
        if (validation.valid && validation.archive) {
          setPendingRestore({
            rawText: text,
            archive: {
              format: validation.archive.format,
              version: validation.archive.version,
              exported_at: validation.archive.exported_at,
              organization_name: validation.archive.organization_name,
              counts: validation.archive.counts,
            },
          });
        } else {
          showToast('error', 'Invalid Backup File', validation.error || 'Corrupt or unreadable JSON file');
        }
      } catch (err: any) {
        showToast('error', 'Import Error', err.message);
      }
    };
    reader.readAsText(file);
    // Reset input value so same file can be chosen again
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    setIsRestoring(true);

    try {
      const success = StorageEngine.importData(pendingRestore.rawText);
      if (success) {
        showToast('success', 'Database Restored', 'Verified business archive restored successfully.');
        setPendingRestore(null);
        refreshData();
      } else {
        showToast('error', 'Restore Failed', 'Failed to parse and mount backup data.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetDemo = () => {
    if (!isOwner) {
      showToast('error', 'Access Denied', 'Factory reset requires OWNER privileges');
      return;
    }
    if (confirm('Reset entire system back to clean default starter inventory, sales, and accounts?')) {
      StorageEngine.resetToDefaults();
      showToast('info', 'Reset Complete', 'Loaded clean initial demo datasets');
      refreshData();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            System Settings & Enterprise Data
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure receipt header, currency symbols, database backups, and cloud synchronization.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Business Profile Settings */}
        <div className="lg:col-span-7">
          <Card className="p-5">
            <CardHeader className="p-0 pb-4 mb-4 border-b border-slate-800">
              <CardTitle>Business Profile & Invoicing</CardTitle>
            </CardHeader>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <Input
                label="Business / Enterprise Name"
                required
                disabled={!isOwner}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone Number"
                  disabled={!isOwner}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  disabled={!isOwner}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <Input
                label="Physical Shop / Office Address"
                disabled={!isOwner}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Invoice Prefix"
                  disabled={!isOwner}
                  value={form.invoice_prefix}
                  onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })}
                />
                <Input
                  label="Currency Code"
                  disabled={!isOwner}
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
                <Input
                  label="Currency Symbol"
                  disabled={!isOwner}
                  value={form.currency_symbol}
                  onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
                />
              </div>

              <Input
                label="Default Sales Tax / VAT (%)"
                type="number"
                step="any"
                disabled={!isOwner}
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              />

              <Input
                label="Receipt Thermal Print Footer Note"
                disabled={!isOwner}
                value={form.receipt_footer}
                onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
              />

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" disabled={!isOwner}>
                  <Check className="h-4 w-4" />
                  <span>Save Configuration</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right 5 cols: Database Backup, Restore, Supabase */}
        <div className="lg:col-span-5 space-y-5">
          {/* Cloud Database Integration */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-cyan-400" />
              <CardTitle>Cloud Supabase Connection</CardTitle>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect a hosted Supabase PostgreSQL backend with Row-Level Security for multi-device
              synchronization.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSupabaseConfigOpen(true)}
              className="w-full text-slate-200"
            >
              Configure Supabase Keys
            </Button>
          </Card>

          {/* Local Data Backup / Restore */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-teal-400" />
              <CardTitle>Local Database Backup & Restore</CardTitle>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export an archive of all tables or safely restore from a verified backup. Restricted to
              OWNER role.
            </p>

            {!isOwner && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800 text-[11px] text-amber-300 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Backup operations require OWNER role.</span>
              </div>
            )}

            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!isOwner}
                onClick={handleExportBackup}
                className="w-full text-slate-200"
              >
                <Download className="h-4 w-4 text-cyan-400" />
                <span>Export Verified Business Backup</span>
              </Button>

              <label
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  isOwner
                    ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                    : 'border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Upload className="h-4 w-4 text-teal-400" />
                <span>Restore Business Backup...</span>
                <input
                  type="file"
                  accept=".json"
                  disabled={!isOwner}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              <div className="pt-2 border-t border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!isOwner}
                  onClick={handleResetDemo}
                  className="w-full text-rose-400 hover:bg-rose-950/40"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset to Factory Sample Data</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation & Summary Modal for Backup Restore */}
      <Modal
        isOpen={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        title="Verify & Confirm Database Restore"
        description="Review the contents of this archive before replacing live local records."
        maxWidth="md"
      >
        {pendingRestore && (
          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Organization:</span>
                <span className="font-bold text-slate-200">
                  {pendingRestore.archive.organization_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Archive Version:</span>
                <span className="font-mono text-cyan-400">{pendingRestore.archive.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exported Timestamp:</span>
                <span className="font-mono text-slate-300">
                  {formatDateTime(pendingRestore.archive.exported_at)}
                </span>
              </div>
            </div>

            {/* Counts Summary */}
            <div className="space-y-1.5">
              <span className="font-semibold text-slate-300">Archive Collections Summary:</span>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Products:</span>
                  <span className="text-cyan-400 font-bold">
                    {pendingRestore.archive.counts.products || 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Services:</span>
                  <span className="text-cyan-400 font-bold">
                    {pendingRestore.archive.counts.services || 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Sales Invoices:</span>
                  <span className="text-emerald-400 font-bold">
                    {pendingRestore.archive.counts.sales || 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Expenses:</span>
                  <span className="text-rose-400 font-bold">
                    {pendingRestore.archive.counts.expenses || 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Accounts:</span>
                  <span className="text-teal-400 font-bold">
                    {pendingRestore.archive.counts.accounts || 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Customers:</span>
                  <span className="text-amber-400 font-bold">
                    {pendingRestore.archive.counts.customers || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Critical Warning Alert */}
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Irreversible Action</p>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  Restoring will overwrite your current active shop records with the data from this
                  backup file.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="ghost" onClick={() => setPendingRestore(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                <Check className="h-4 w-4" />
                <span>{isRestoring ? 'Restoring...' : 'Confirm & Restore Live Database'}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
