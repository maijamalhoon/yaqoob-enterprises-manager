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
  Check,
  AlertTriangle,
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  Camera,
} from "lucide-react";
import { formatDateTime } from "../../lib/utils";
import { UserAvatar } from "../common/UserAvatar";

export const SettingsView: React.FC = () => {
  const {
    organization,
    updateOrganization,
    user,
    updateProfilePhoto,
    updatePassword,
    updatePin,
  } = useAuth();
  const { showToast, refreshData } = useApp();

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

  // User Profile Photo state
  const [photoUrl, setPhotoUrl] = useState(user?.avatar_url || "");
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  // Account Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleSavePhoto = async (urlToSave?: string) => {
    const targetUrl = urlToSave !== undefined ? urlToSave : photoUrl;
    setIsSavingPhoto(true);
    const res = await updateProfilePhoto(targetUrl);
    setIsSavingPhoto(false);
    if (res.success) {
      showToast(
        "success",
        "Profile Photo Updated",
        "Your profile image has been saved.",
      );
    } else {
      showToast(
        "error",
        "Photo Update Failed",
        res.error || "Could not update photo.",
      );
    }
  };

  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("error", "File Too Large", "Please select an image under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoUrl(dataUrl);
      void handleSavePhoto(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast(
        "error",
        "Password Too Short",
        "Password must be at least 8 characters long.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("error", "Password Mismatch", "Passwords do not match.");
      return;
    }
    setIsUpdatingPassword(true);
    const res = await updatePassword(newPassword);
    setIsUpdatingPassword(false);
    if (res.success) {
      showToast(
        "success",
        "Password Updated",
        "Your account password has been updated.",
      );
      setNewPassword("");
      setConfirmPassword("");
    } else {
      showToast(
        "error",
        "Password Update Failed",
        res.error || "Could not update password.",
      );
    }
  };

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
      showToast(
        "error",
        "PIN Mismatch",
        "New PIN and confirmation do not match.",
      );
      return;
    }
    setIsChangingPin(true);
    const res = await updatePin(currentPin, newPin);
    setIsChangingPin(false);
    if (!res.success) {
      showToast(
        "error",
        "Failed to Update PIN",
        res.error || "Please check your current PIN.",
      );
    } else {
      showToast(
        "success",
        "PIN Updated",
        "Counter screen lock PIN has been updated successfully.",
      );
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
            Shop Settings & Data
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Configure receipt header, currency symbols, and database backups.
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
                label="Business Name"
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

        {/* Right 5 cols: Profile, PIN Security, and Data Backups */}
        <div className="lg:col-span-5 space-y-5">
          {/* User Profile & Account Settings */}
          <Card className="p-5 space-y-4 bg-white border border-[#e6e8ec]">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#4f46e5]" />
              <CardTitle>Profile Photo & Account</CardTitle>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">
              Manage your personal avatar and sign-in credentials.
            </p>

            {/* Profile Avatar Management */}
            <div className="flex items-center gap-4 pt-1">
              <div className="relative">
                <UserAvatar
                  src={photoUrl || user?.avatar_url}
                  name={user?.full_name || organization.owner_name || "Owner"}
                  size="lg"
                />
              </div>

              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e6e8ec] bg-[#f8f9fb] hover:bg-[#f2f4f6] text-xs font-medium text-[#191c1e] cursor-pointer transition">
                  <Camera className="h-3.5 w-3.5 text-[#4f46e5]" />
                  <span>Upload Custom Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    placeholder="or paste image URL"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full h-8 rounded-md border border-[#dfe3e8] bg-white px-2.5 text-xs outline-none focus:border-[#4f46e5]"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2.5 text-xs shrink-0"
                    onClick={() => handleSavePhoto()}
                    isLoading={isSavingPhoto}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>

            {/* Change Account Password */}
            <div className="pt-3 border-t border-[#f2f4f6] space-y-3">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#4f46e5]" />
                <span className="text-xs font-semibold text-[#191c1e]">
                  Change Account Password
                </span>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-2.5">
                <Input
                  label="New Password"
                  type="password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  minLength={8}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={!newPassword || !confirmPassword}
                  isLoading={isUpdatingPassword}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  <span>Update Account Password</span>
                </Button>
              </form>
            </div>
          </Card>

          {/* Quick-Unlock Register PIN */}
          <Card className="p-5 space-y-4 bg-white border border-[#e6e8ec]">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#4f46e5]" />
              <CardTitle>Quick-Unlock Register PIN</CardTitle>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">
              Used to unlock the register quickly and secure the screen between
              transactions without retyping full account credentials.
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
                label="New 4-Digit PIN"
                type="password"
                required
                minLength={4}
                maxLength={4}
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <Input
                label="Confirm New PIN"
                type="password"
                required
                minLength={4}
                maxLength={4}
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                isLoading={isChangingPin}
              >
                <Check className="h-4 w-4 mr-1.5" />
                <span>Update Quick-Unlock PIN</span>
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

              <label className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors border-[#e6e8ec] bg-white text-[#14181f] hover:bg-[#f8f9fb] cursor-pointer">
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
