import React, { useState, useEffect } from "react";
import { getSupabaseClient } from "../../lib/supabase";
import { Category, CategoryAlias } from "../../types/ledger";
import { formatPaisa, parseInputToPaisa } from "../../lib/money";
import { getKarachiBusinessDate } from "../../lib/dates";
import { getSecurityPrincipal } from "../../lib/security";
import {
  Layers,
  Tag,
  Sun,
  Moon,
  ShieldCheck,
  Download,
  Upload,
  Plus,
  Edit2,
  Check,
  X,
  Trash2,
  KeyRound,
} from "lucide-react";
import { PaperRegisterImportModal } from "./PaperRegisterImportModal";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";

export const LedgerSettingsView: React.FC = () => {
  const { user, changePassword } = useAuth();
  const { showToast } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [aliases, setAliases] = useState<CategoryAlias[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaperImport, setShowPaperImport] = useState(false);
  const [appearance, setAppearance] = useState<"light" | "dark">(
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] =
    useState<Category["kind"]>("income");
  const [newCategoryLimit, setNewCategoryLimit] = useState("50000");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Category Edit State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLimit, setEditLimit] = useState("");

  // Add Alias State
  const [newAliasText, setNewAliasText] = useState("");
  const [newAliasCatId, setNewAliasCatId] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const supabase = getSupabaseClient();
    try {
      const { data: cats, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });
      if (categoriesError) throw categoriesError;
      setCategories(cats || []);

      const { data: aliasData, error: aliasesError } = await supabase
        .from("category_aliases")
        .select("*")
        .order("match_count", { ascending: false });
      if (aliasesError) throw aliasesError;
      setAliases(aliasData || []);
    } catch (err) {
      console.error("Error fetching settings data:", err);
      showToast("error", "Settings could not be loaded", "Refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCategory = async (id: string) => {
    const supabase = getSupabaseClient();
    try {
      const parsed = parseInputToPaisa(editLimit);
      if (!editName.trim() || !parsed.isValid || parsed.paisa <= 0) {
        showToast("error", "Check category details", "Enter a name and a valid amount limit.");
        return;
      }
      const { error } = await supabase
        .from("categories")
        .update({
          name: editName.trim(),
          unusual_amount_limit_paisa: parsed.paisa,
        })
        .eq("id", id);
      if (error) throw error;

      setEditingCatId(null);
      await loadData();
      showToast("success", "Category updated");
    } catch (err) {
      console.error("Error updating category:", err);
      showToast("error", "Category not updated", "Check the name and try again.");
    }
  };

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    const limit = parseInputToPaisa(newCategoryLimit);
    const principal = getSecurityPrincipal();
    if (!name || !limit.isValid || limit.paisa <= 0 || !principal) {
      showToast("error", "Check category details", "Enter a name and a valid amount limit.");
      return;
    }

    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase.from("categories").insert({
        id: crypto.randomUUID(),
        organization_id: principal.organizationId,
        name,
        kind: newCategoryKind,
        unusual_amount_limit_paisa: limit.paisa,
        is_default: false,
        is_active: true,
        display_order: categories.length + 1,
      });
      if (error) throw error;
      setNewCategoryName("");
      setNewCategoryLimit("50000");
      setIsAddingCategory(false);
      await loadData();
      showToast("success", "Category added");
    } catch (err) {
      console.error("Error adding category:", err);
      showToast("error", "Category not added", "A category with this name may already exist.");
    }
  };

  const handleRemoveCategory = async (category: Category) => {
    if (
      !window.confirm(
        `Remove “${category.name}”? Categories with ledger history will be archived to preserve reports.`,
      )
    ) {
      return;
    }
    const supabase = getSupabaseClient();
    try {
      const [transactions, drafts] = await Promise.all([
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("category_id", category.id),
        supabase
          .from("transaction_drafts")
          .select("id", { count: "exact", head: true })
          .eq("category_id", category.id),
      ]);
      if (transactions.error) throw transactions.error;
      if (drafts.error) throw drafts.error;
      const hasHistory = (transactions.count || 0) + (drafts.count || 0) > 0;

      if (hasHistory) {
        const { error } = await supabase
          .from("categories")
          .update({ is_active: false })
          .eq("id", category.id);
        if (error) throw error;
        showToast("success", "Category archived", "Its existing transactions and reports are unchanged.");
      } else {
        const { error } = await supabase
          .from("categories")
          .delete()
          .eq("id", category.id);
        if (error) throw error;
        showToast("success", "Category removed");
      }
      await loadData();
    } catch (err) {
      console.error("Error removing category:", err);
      showToast("error", "Category not removed", "It may still be used by a saved entry.");
    }
  };

  const handleRestoreCategory = async (category: Category) => {
    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: true })
        .eq("id", category.id);
      if (error) throw error;
      await loadData();
      showToast("success", "Category restored");
    } catch (err) {
      console.error("Error restoring category:", err);
      showToast("error", "Category not restored", "Please try again.");
    }
  };

  const handleToggleAppearance = (theme: "light" | "dark") => {
    try {
      localStorage.setItem("yaqoob-theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
      setAppearance(theme);
    } catch (err) {
      console.error("Could not save appearance preference:", err);
      showToast("error", "Appearance not saved", "Check browser storage permissions.");
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      showToast("error", "Password is too short", "Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("error", "Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.success) {
        showToast("error", "Password not changed", result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("success", "Password changed");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasText.trim() || !newAliasCatId) return;

    const supabase = getSupabaseClient();
    const principal = getSecurityPrincipal();
    if (!principal) return;
    try {
      await supabase.from("category_aliases").insert({
        id: crypto.randomUUID(),
        organization_id: principal.organizationId,
        category_id: newAliasCatId,
        alias: newAliasText.trim().toUpperCase(),
        match_count: 0,
      });

      setNewAliasText("");
      setNewAliasCatId("");
      await loadData();
    } catch (err) {
      console.error("Error adding alias:", err);
    }
  };

  const exportEverything = async (format: "csv" | "json") => {
    const supabase = getSupabaseClient();
    try {
      const { data: txs } = await supabase
        .from("transactions")
        .select("*, categories(name)")
        .order("device_entry_time", { ascending: true });

      const dateStr = getKarachiBusinessDate();

      if (format === "json") {
        const jsonStr = JSON.stringify(txs, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `yaqoob_ledger_full_dump_${dateStr}.json`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const headers = [
          "ID",
          "Business Date",
          "Device Time",
          "Type",
          "Category",
          "Amount (Paisa)",
          "Raw Text",
          "Status",
          "Void Reason",
          "Created By Name",
        ];

        const rows = (txs || []).map((t: any) => [
          t.id,
          t.business_date,
          t.device_entry_time,
          t.type,
          t.categories?.name || "",
          t.amount_paisa,
          `"${(t.raw_text || "").replace(/"/g, '""')}"`,
          t.status,
          `"${(t.void_reason || "").replace(/"/g, '""')}"`,
          `"${(t.created_by_name || "").replace(/"/g, '""')}"`,
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((r: any) => r.join(",")),
        ].join("\n");
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `yaqoob_ledger_full_dump_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Error exporting everything:", err);
    }
  };

  return (
    <div className="workspace-page flex-1 overflow-y-auto space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="workspace-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">
            Settings
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage your preferences, security, and categories.
          </p>
        </div>
      </div>

      <nav aria-label="Settings sections" className="settings-nav no-scrollbar flex gap-1 overflow-x-auto border-b border-border-standard pb-2">
        {[
          ["#appearance", "Appearance"],
          ["#security", "Security"],
          ["#categories", "Categories"],
          ["#data-tools", "Data & tools"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            {label}
          </a>
        ))}
      </nav>

      {showPaperImport && (
        <PaperRegisterImportModal
          onClose={() => setShowPaperImport(false)}
          onImportComplete={() => {
            setShowPaperImport(false);
            loadData();
          }}
        />
      )}

      <section id="appearance" className="workspace-panel settings-section p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="settings-icon"><Sun className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Appearance</h2>
            <p className="mt-0.5 text-xs text-text-muted">Choose a theme for this device.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {([
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
          ] as const).map(([theme, label, Icon]) => (
            <button
              key={theme}
              type="button"
              aria-pressed={appearance === theme}
              onClick={() => handleToggleAppearance(theme)}
              className={`flex min-h-12 items-center gap-2.5 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                appearance === theme
                  ? "border-primary/30 bg-primary/[0.07] text-primary"
                  : "border-border-standard bg-white text-secondary hover:bg-surface-container-low"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {appearance === theme && <Check className="ml-auto h-4 w-4" />}
            </button>
          ))}
        </div>
      </section>

      <section id="security" className="workspace-panel settings-section p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="settings-icon"><ShieldCheck className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Security</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Change the password for {user?.email || "your account"}.
            </p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
          <label className="settings-field sm:col-span-2">
            <span>Current password</span>
            <input
              required
              autoComplete="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Enter current password"
            />
          </label>
          <label className="settings-field">
            <span>New password</span>
            <input
              required
              minLength={8}
              autoComplete="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          <label className="settings-field">
            <span>Confirm new password</span>
            <input
              required
              minLength={8}
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {isChangingPassword ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>

      <section id="categories" className="workspace-panel settings-section space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="settings-icon"><Layers className="h-4 w-4" /></div>
            <div>
              <h2 className="text-sm font-semibold text-on-surface">Categories</h2>
              <p className="mt-0.5 text-xs text-text-muted">Create, edit, and remove ledger categories.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingCategory((open) => !open)}
            className="inline-flex min-h-9 self-start items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Add category
          </button>
        </div>

        {isAddingCategory && (
          <form onSubmit={handleAddCategory} className="settings-create-category grid gap-2 rounded-xl border border-border-standard p-3 sm:grid-cols-[minmax(0,1fr)_9rem_12rem_auto_auto]">
            <input
              required
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Category name"
              aria-label="New category name"
            />
            <select
              value={newCategoryKind}
              onChange={(event) => setNewCategoryKind(event.target.value as Category["kind"])}
              aria-label="Category type"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <input
              required
              inputMode="decimal"
              value={newCategoryLimit}
              onChange={(event) => setNewCategoryLimit(event.target.value)}
              placeholder="Unusual amount limit"
              aria-label="Unusual amount limit in rupees"
            />
            <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover">
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button type="button" onClick={() => setIsAddingCategory(false)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border-standard px-3 text-xs font-semibold text-secondary hover:bg-surface-container-low">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </form>
        )}

        <div className="settings-category-list divide-y divide-border-standard overflow-hidden rounded-xl border border-border-standard">
          {isLoading ?
            <p className="p-6 text-center text-sm text-text-muted">Loading categories…</p>
          : categories.map((cat) => {
            const isEditing = editingCatId === cat.id;

            return (
              <div
                key={cat.id}
                className="flex flex-col justify-between gap-3 p-3.5 text-xs sm:flex-row sm:items-center"
              >
                {isEditing ?
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Category name"
                      className="workspace-control px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={editLimit}
                      onChange={(e) => setEditLimit(e.target.value)}
                      placeholder="Unusual limit (Rs)"
                      className="workspace-control px-2.5 py-1.5 text-xs"
                    />
                  </div>
                : <div>
                    <div className="flex items-center gap-2 font-semibold text-on-surface">
                      <span>{cat.name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          cat.kind === "income" ?
                            "bg-success-bg text-success"
                          : "bg-danger-bg text-danger"
                        }`}
                      >
                        {cat.kind}
                      </span>
                      {!cat.is_active && (
                        <span className="rounded bg-surface-container-low px-1.5 py-0.5 text-[10px] text-text-muted">
                          Archived
                        </span>
                      )}
                      {cat.is_default && (
                        <span className="rounded bg-surface-container-low px-1.5 py-0.5 text-[10px] text-text-muted">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-muted">
                      Alert limit:{" "}
                      <span className="font-mono font-semibold">
                        {formatPaisa(cat.unusual_amount_limit_paisa)}
                      </span>
                    </div>
                  </div>
                }

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isEditing ?
                    <>
                      <button
                        onClick={() => handleSaveCategory(cat.id)}
                        className="flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white hover:bg-primary-hover"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        onClick={() => setEditingCatId(null)}
                        className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border-standard px-2.5 text-xs font-semibold text-secondary hover:bg-surface-container-low"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </>
                  : <>
                      <button
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditName(cat.name);
                          setEditLimit(
                            (cat.unusual_amount_limit_paisa / 100).toString(),
                          );
                        }}
                        className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border-standard px-2.5 text-xs font-semibold text-secondary hover:bg-surface-container-low"
                        title="Edit name & limit"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      {cat.is_active ?
                        <button
                          onClick={() => handleRemoveCategory(cat)}
                          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-danger-border px-2.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-bg"
                          title="Remove category"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      : <button
                          onClick={() => handleRestoreCategory(cat)}
                          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border-standard px-2.5 text-xs font-semibold text-secondary hover:bg-surface-container-low"
                        >
                          Restore
                        </button>
                      }
                    </>
                  }
                </div>
              </div>
            );
          })}
          {!isLoading && categories.length === 0 && (
            <p className="p-6 text-center text-sm text-text-muted">No categories yet.</p>
          )}
        </div>
      </section>

      <section id="data-tools" className="workspace-panel settings-section space-y-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="settings-icon"><Download className="h-4 w-4" /></div>
            <div>
              <h2 className="text-sm font-semibold text-on-surface">Data & tools</h2>
              <p className="mt-0.5 text-xs text-text-muted">Import records or export a ledger archive.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPaperImport(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-standard px-3 text-xs font-semibold text-secondary hover:bg-surface-container-low"
            >
              <Upload className="h-3.5 w-3.5" /> Import register
            </button>
            <button
              type="button"
              onClick={() => exportEverything("csv")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-standard px-3 text-xs font-semibold text-secondary hover:bg-surface-container-low"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => exportEverything("json")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              <Download className="h-3.5 w-3.5" /> JSON
            </button>
          </div>
        </div>
        <div className="space-y-4 border-t border-border-standard pt-5">
        <div className="flex items-center gap-2">
          <div className="settings-icon"><Tag className="h-4 w-4" /></div>
          <h3 className="text-sm font-semibold text-on-surface">Aliases & keywords</h3>
        </div>

        {/* Add Manual Alias */}
        <form
          onSubmit={handleAddAlias}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            value={newAliasText}
            onChange={(e) => setNewAliasText(e.target.value)}
            placeholder="Add alias keyword e.g. XEROX"
            className="min-h-10 w-full min-w-0 flex-1 rounded-md border border-border-standard px-3 py-2 text-xs uppercase focus:border-primary focus:outline-none sm:w-auto"
          />
          <select
            value={newAliasCatId}
            onChange={(e) => setNewAliasCatId(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-md border border-border-standard px-2 py-2 text-xs focus:border-primary focus:outline-none sm:w-auto"
          >
            <option value="">Map to Category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newAliasText.trim() || !newAliasCatId}
            className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-md bg-primary px-3.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-40 sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>

        {/* Alias Cloud */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {aliases.map((a) => {
            const cat = categories.find((c) => c.id === a.category_id);
            return (
              <span
                key={a.id}
                className="flex items-center gap-1.5 rounded-lg border border-border-standard bg-surface-container-low px-2.5 py-1 font-mono text-xs font-medium text-on-surface"
              >
                <span>{a.alias}</span>
                <span className="font-sans text-[10px] text-text-muted">
                  → {cat?.name || "Unknown"}
                </span>
                {a.match_count > 0 && (
                  <span className="rounded-full bg-surface-container-high px-1 text-[9px] text-secondary">
                    {a.match_count}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        </div>
      </section>
    </div>
  );
};
