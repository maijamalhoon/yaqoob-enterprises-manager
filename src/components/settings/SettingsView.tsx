import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { Card, CardHeader, CardTitle } from "../common/Card";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { StorageEngine } from "../../services/storageEngine";
import { isTauriEnvironment } from "../../services/sqliteEngine";
import { sqliteRepository } from "../../services/sqliteRepository";
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
  ShieldCheck,
  Lock,
} from "lucide-react";
import { formatDateTime } from "../../lib/utils";

export const SettingsView: React.FC = () => {
  const { organization, updateOrganization, updatePin } = useAuth();
  const { showToast, setIsSupabaseConfigOpen, refreshData } = useApp();

  const [form, setForm] = useState({
    name: organization.name,
    phone: organization.phone || "",
    email: organization.email || "",
    address: organization.address || "",
    invoice_prefix: organization.invoice_prefix || "YE-",
    currency: organization.currency || "PKR",
    currency_symbol: organization.currency_symbol || "Rs.",
    tax_rate: organization.tax_rate || 0,
    receipt_footer:
      organization.receipt_footer ||
      "Thank you for choosing Yaqoob Enterprises!",
  });

  // Counter Screen Lock PIN state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);

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

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization(form);
    showToast(
      "success",
      "Settings Saved",
      "Business profile and receipt formatting updated",
    );
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      showToast("error", "PIN Mismatch", "New PIN and confirmation do not match.");
      return;
    }
    setIsChangingPin(true);
    const res = await updatePin(currentPin, newPin);
    setIsChangingPin(false);
    if (!res.success) {
      showToast("error", "Failed to Update PIN", res.error || "Please check your current PIN.");
    } else {
      showToast("success", "PIN Updated", "Counter screen lock PIN has been updated successfully.");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    }
  };

  const handleExportBackup = async () => {
    const backupJson =
      isTauriEnvironment() ?
        await sqliteRepository.exportDatabaseBackup(organization.id)
      : StorageEngine.exportData();
    const blob = new Blob([backupJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yaqoob_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      "success",
      "Database Exported",
      "Downloaded verified business archive with checksum",
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const validation =
          isTauriEnvironment() ?
            sqliteRepository.validateDatabaseBackup(text, organization.id)
          : StorageEngine.validateBackup(text);
        if (validation.valid && validation.archive) {
          setPendingRestore({
            rawText: text,
            archive: {
              format: validation.archive.format,
              version: String(
                validation.archive.version || validation.archive.schema_version,
              ),
              exported_at: validation.archive.exported_at,
              organization_name:
                validation.archive.organization_name || organization.name,
              counts: validation.archive.counts || {},
            },
          });
        } else {
          showToast(
            "error",
            "Invalid Backup File",
            validation.error || "Corrupt or unreadable JSON file",
          );
        }
      } catch (err: any) {
        showToast("error", "Import Error", err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);

    try {
      if (isTauriEnvironment()) {
        await sqliteRepository.restoreDatabaseBackup(
          pendingRestore.rawText,
          organization.id,
        );
        showToast(
          "success",
          "Database Restored",
          "Verified SQLite archive restored transactionally.",
        );
        setPendingRestore(null);
        refreshData();
      } else {
        const success = StorageEngine.importData(pendingRestore.rawText);
        if (success) {
          showToast(
            "success",
            "Database Restored",
            "Verified business archive restored successfully.",
          );
          setPendingRestore(null);
          refreshData();
        } else {
          showToast(
            "error",
            "Restore Failed",
            "Failed to parse and mount backup data.",
          );
        }
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetDemo = () => {
    if (
      confirm(
        "Reset entire system back to clean default starter inventory, sales, and accounts?",
      )
    ) {
      if (isTauriEnvironment()) {
        showToast(
          "error",
          "Unavailable on Desktop",
          "Use a verified SQLite backup restore instead of deleting the production database.",
        );
        return;
      }
      StorageEngine.resetToDefaults();
      showToast("info", "Reset Complete", "Loaded clean initial demo datasets");
      refreshData();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#f8f9fb] select-none text-[#191c1e]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e6e8ec]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#191c1e]">
            System Settings & Enterprise Data
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Configure receipt header, currency symbols, database backups, and
            cloud synchronization.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Business Profile Settings */}
        <div className="lg:col-span-7">
          <Card className="p-5 bg-white border border-[#e6e8ec]">
            <CardHeader className="p-0 pb-4 mb-4 border-b border-[#e6e8ec]">
              <CardTitle>Business Profile & Invoicing</CardTitle>
            </CardHeader>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <Input
                label="Business / Enterprise Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone Number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <Input
                label="Physical Shop / Office Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Invoice Prefix"
                  value={form.invoice_prefix}
                  onChange={(e) =>
                    setForm({ ...form, invoice_prefix: e.target.value })
                  }
                />
                <Input
                  label="Currency Code"
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                />
                <Input
                  label="Currency Symbol"
                  value={form.currency_symbol}
                  onChange={(e) =>
                    setForm({ ...form, currency_symbol: e.target.value })
                  }
                />
              </div>

              <Input
                label="Default Sales Tax / VAT (%)"
                type="number"
                step="any"
                value={form.tax_rate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tax_rate: parseFloat(e.target.value) || 0,
                  })
                }
              />

              <Input
                label="Receipt Thermal Print Footer Note"
                value={form.receipt_footer}
                onChange={(e) =>
                  setForm({ ...form, receipt_footer: e.target.value })
                }
              />

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary">
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
          <Card className="p-5 space-y-3 bg-white border border-[#e6e8ec]">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-[#4f46e5]" />
              <CardTitle>Cloud Supabase Connection</CardTitle>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">
              Connect a hosted Supabase PostgreSQL backend with Row-Level
              Security for multi-device synchronization.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSupabaseConfigOpen(true)}
              className="w-full text-[#14181f]"
            >
              Configure Supabase Keys
            </Button>
          </Card>

          {/* Counter Screen Lock PIN Security */}
          <Card className="p-5 space-y-4 bg-white border border-[#e6e8ec]">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#4f46e5]" />
              <CardTitle>Counter Screen Lock PIN</CardTitle>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">
              Set or update your counter terminal PIN. This physical security gate prevents unauthorized counter access when stepping away.
            </p>

            <form onSubmit={handleChangePin} className="space-y-3">
              <Input
                label="Current PIN"
                type="password"
                required
                placeholder="Default is 1234"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
              />
              <Input
                label="New PIN / Password (min 4 digits)"
                type="password"
                required
                minLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
              <Input
                label="Confirm New PIN"
                type="password"
                required
                minLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                isLoading={isChangingPin}
              >
                <Check className="h-4 w-4 mr-1.5" />
                <span>Update Counter PIN</span>
              </Button>
            </form>
          </Card>

          {/* Local Data Backup / Restore */}
          <Card className="p-5 space-y-4 bg-white border border-[#e6e8ec]">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[#4f46e5]" />
              <CardTitle>Local Database Backup & Restore</CardTitle>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">
              Export an archive of all tables or safely restore from a verified
              backup archive.
            </p>

            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportBackup}
                className="w-full"
              >
                <Download className="h-4 w-4 text-[#4f46e5]" />
                <span>Export Verified Business Backup</span>
              </Button>

              <label
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors border-[#e6e8ec] bg-white text-[#14181f] hover:bg-[#f8f9fb] cursor-pointer"
              >
                <Upload className="h-4 w-4 text-[#4f46e5]" />
                <span>Restore Business Backup...</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              <div className="pt-2 border-t border-[#e6e8ec]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetDemo}
                  className="w-full text-[#dc2626] hover:bg-[#fef2f2]"
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
            <div className="p-3 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#667085]">Organization:</span>
                <span className="font-bold text-[#14181f]">
                  {pendingRestore.archive.organization_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Archive Version:</span>
                <span className="font-mono text-[#4f46e5] font-semibold">
                  {pendingRestore.archive.version}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Exported Timestamp:</span>
                <span className="font-mono text-[#14181f]">
                  {formatDateTime(pendingRestore.archive.exported_at)}
                </span>
              </div>
            </div>

            {/* Counts Summary */}
            <div className="space-y-1.5">
              <span className="font-semibold text-[#14181f]">
                Archive Collections Summary:
              </span>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded-md bg-white border border-[#e6e8ec] flex justify-between">
                  <span className="text-[#667085]">Products:</span>
                  <span className="text-[#4f46e5] font-bold">
                    {pendingRestore.archive.counts.products || 0}
                  </span>
                </div>
                <div className="p-2 rounded-md bg-white border border-[#e6e8ec] flex justify-between">
                  <span className="text-[#667085]">Services:</span>
                  <span className="text-[#4f46e5] font-bold">
                    {pendingRestore.archive.counts.services || 0}
                  </span>
                </div>
                <div className="p-2 rounded-md bg-white border border-[#e6e8ec] flex justify-between">
                  <span className="text-[#667085]">Sales Invoices:</span>
                  <span className="text-[#16a34a] font-bold">
                    {pendingRestore.archive.counts.sales || 0}
                  </span>
                </div>
                <div className="p-2 rounded-md bg-white border border-[#e6e8ec] flex justify-between">
                  <span className="text-[#667085]">Expenses:</span>
                  <span className="text-[#dc2626] font-bold">
                    {pendingRestore.archive.counts.expenses || 0}
                  </span>
                </div>
                <div className="p-2 rounded-md bg-white border border-[#e6e8ec] flex justify-between">
                  <span className="text-[#667085]">Accounts:</span>
                  <span className="text-[#4f46e5] font-bold">
                    {pendingRestore.archive.counts.accounts || 0}
                  </span>
                </div>
                <div className="p-2 rounded-md bg-white border border-[#e6e8ec] flex justify-between">
                  <span className="text-[#667085]">Customers:</span>
                  <span className="text-[#d97706] font-bold">
                    {pendingRestore.archive.counts.customers || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Critical Warning Alert */}
            <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fee2e2] text-[#dc2626] flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-[#dc2626] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-[#991b1b]">Irreversible Action</p>
                <p className="text-[11px] text-[#dc2626] leading-relaxed">
                  Restoring will overwrite your current active shop records with
                  the data from this backup file.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e6e8ec]">
              <Button variant="ghost" onClick={() => setPendingRestore(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
              >
                <Check className="h-4 w-4" />
                <span>
                  {isRestoring ?
                    "Restoring..."
                  : "Confirm & Restore Live Database"}
                </span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
