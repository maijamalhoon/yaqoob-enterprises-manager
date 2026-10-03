import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { Category, CategoryAlias } from '../../types/ledger';
import { formatPaisa, parseInputToPaisa } from '../../lib/money';
import { getKarachiBusinessDate } from '../../lib/dates';
import {
  Settings,
  Layers,
  Tag,
  AlertTriangle,
  Download,
  Upload,
  Plus,
  Edit2,
  Check,
  X,
  RefreshCw,
  GitMerge,
  PowerOff,
} from 'lucide-react';
import { PaperRegisterImportModal } from './PaperRegisterImportModal';

export const LedgerSettingsView: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [aliases, setAliases] = useState<CategoryAlias[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaperImport, setShowPaperImport] = useState(false);

  // Category Edit State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState('');

  // Merge Categories State
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  // Add Alias State
  const [newAliasText, setNewAliasText] = useState('');
  const [newAliasCatId, setNewAliasCatId] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    const supabase = getSupabaseClient();
    try {
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });
      setCategories(cats || []);

      const { data: aliasData } = await supabase
        .from('category_aliases')
        .select('*')
        .order('match_count', { ascending: false });
      setAliases(aliasData || []);
    } catch (err) {
      console.error('Error fetching settings data:', err);
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
      const limitPaisa = parsed.isValid ? parsed.paisa : 5000000;
      await supabase
        .from('categories')
        .update({
          name: editName.trim(),
          unusual_amount_limit_paisa: limitPaisa,
        })
        .eq('id', id);

      setEditingCatId(null);
      await loadData();
    } catch (err) {
      console.error('Error updating category:', err);
    }
  };

  const handleDeactivateCategory = async (cat: Category) => {
    const supabase = getSupabaseClient();
    try {
      await supabase
        .from('categories')
        .update({ is_active: !cat.is_active })
        .eq('id', cat.id);
      await loadData();
    } catch (err) {
      console.error('Error toggling category status:', err);
    }
  };

  const handleMergeCategories = async () => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    const supabase = getSupabaseClient();
    try {
      // 1. Move transactions from source to target
      await supabase
        .from('transactions')
        .update({ category_id: mergeTargetId })
        .eq('category_id', mergeSourceId);

      // 2. Move aliases from source to target
      await supabase
        .from('category_aliases')
        .update({ category_id: mergeTargetId })
        .eq('category_id', mergeSourceId);

      // 3. Deactivate source category (never delete)
      await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', mergeSourceId);

      setIsMerging(false);
      setMergeSourceId('');
      setMergeTargetId('');
      await loadData();
    } catch (err) {
      console.error('Error merging categories:', err);
    }
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasText.trim() || !newAliasCatId) return;

    const supabase = getSupabaseClient();
    try {
      await supabase.from('category_aliases').insert({
        id: crypto.randomUUID(),
        category_id: newAliasCatId,
        alias: newAliasText.trim().toUpperCase(),
        match_count: 0,
      });

      setNewAliasText('');
      setNewAliasCatId('');
      await loadData();
    } catch (err) {
      console.error('Error adding alias:', err);
    }
  };

  const exportEverything = async (format: 'csv' | 'json') => {
    const supabase = getSupabaseClient();
    try {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .order('device_entry_time', { ascending: true });

      const dateStr = getKarachiBusinessDate();

      if (format === 'json') {
        const jsonStr = JSON.stringify(txs, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `yaqoob_ledger_full_dump_${dateStr}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const headers = [
          'ID',
          'Business Date',
          'Device Time',
          'Type',
          'Category',
          'Amount (Paisa)',
          'Raw Text',
          'Status',
          'Void Reason',
          'Created By Name',
        ];

        const rows = (txs || []).map((t: any) => [
          t.id,
          t.business_date,
          t.device_entry_time,
          t.type,
          t.categories?.name || '',
          t.amount_paisa,
          `"${(t.raw_text || '').replace(/"/g, '""')}"`,
          t.status,
          `"${(t.void_reason || '').replace(/"/g, '""')}"`,
          `"${(t.created_by_name || '').replace(/"/g, '""')}"`,
        ]);

        const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `yaqoob_ledger_full_dump_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error exporting everything:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Ledger Settings & Rules</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage shop categories, aliases, unusual limits, and export complete audit archives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPaperImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Import Paper Register
          </button>
          <button
            onClick={() => exportEverything('csv')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => exportEverything('json')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
        </div>
      </div>

      {showPaperImport && (
        <PaperRegisterImportModal
          onClose={() => setShowPaperImport(false)}
          onImportComplete={() => {
            setShowPaperImport(false);
            loadData();
          }}
        />
      )}

      {/* Categories & Unusual Limits Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Categories & Unusual Limits</h3>
          </div>
          <button
            onClick={() => setIsMerging(!isMerging)}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            <GitMerge className="w-3.5 h-3.5" /> Merge Categories
          </button>
        </div>

        {/* Merge Tool */}
        {isMerging && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-indigo-900">
              Merge Source Category into Target Category:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={mergeSourceId}
                onChange={(e) => setMergeSourceId(e.target.value)}
                className="text-xs border border-gray-300 rounded-xl p-2 bg-white"
              >
                <option value="">Source Category (will be deactivated)...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.kind})
                  </option>
                ))}
              </select>

              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="text-xs border border-gray-300 rounded-xl p-2 bg-white"
              >
                <option value="">Target Category (receives transactions)...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.kind})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsMerging(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeCategories}
                disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        )}

        {/* Category Table */}
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {categories.map((cat) => {
            const isEditing = editingCatId === cat.id;

            return (
              <div
                key={cat.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                {isEditing ? (
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Category name"
                      className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      value={editLimit}
                      onChange={(e) => setEditLimit(e.target.value)}
                      placeholder="Unusual limit (Rs)"
                      className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      <span>{cat.name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          cat.kind === 'income'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {cat.kind}
                      </span>
                      {!cat.is_active && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px]">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Unusual amount limit: <span className="font-mono font-semibold">{formatPaisa(cat.unusual_amount_limit_paisa)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleSaveCategory(cat.id)}
                        className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingCatId(null)}
                        className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditName(cat.name);
                          setEditLimit((cat.unusual_amount_limit_paisa / 100).toString());
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900"
                        title="Edit name & limit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeactivateCategory(cat)}
                        className="p-1.5 hover:bg-amber-50 rounded-lg text-gray-400 hover:text-amber-600"
                        title={cat.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        <PowerOff className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aliases & Learned Vocabulary Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Learned Aliases & Keywords</h3>
        </div>

        {/* Add Manual Alias */}
        <form onSubmit={handleAddAlias} className="flex gap-2">
          <input
            type="text"
            value={newAliasText}
            onChange={(e) => setNewAliasText(e.target.value)}
            placeholder="Add alias keyword e.g. XEROX"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs uppercase"
          />
          <select
            value={newAliasCatId}
            onChange={(e) => setNewAliasCatId(e.target.value)}
            className="border border-gray-300 rounded-xl px-2 py-2 text-xs"
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
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
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
                className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-mono font-medium text-gray-700 flex items-center gap-1.5"
              >
                <span>{a.alias}</span>
                <span className="text-[10px] text-gray-400 font-sans">→ {cat?.name || 'Unknown'}</span>
                {a.match_count > 0 && (
                  <span className="text-[9px] bg-gray-200 text-gray-600 px-1 rounded-full">
                    {a.match_count}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
