import React, { useState, useEffect } from 'react';
import { ledgerService } from '../../services/ledgerService';
import { ReviewQueueItem, Category } from '../../types/ledger';
import { formatPaisa } from '../../lib/money';
import { Inbox, CheckCircle, Trash2, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ReviewQueueView: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id || 'offline-user';
  const currentUserName = user?.full_name || user?.email?.split('@')[0] || 'Shop Brother';

  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Resolution selection state: itemId -> categoryId
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [queueItems, cats] = await Promise.all([
        ledgerService.getReviewQueue(),
        ledgerService.getCategories(),
      ]);
      setItems(queueItems);
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolve = async (item: ReviewQueueItem, categoryId: string) => {
    const targetCat = categories.find((c) => c.id === categoryId);
    if (!targetCat) return;

    try {
      // 1. Record the transaction
      await ledgerService.recordTransaction(
        {
          type: targetCat.kind,
          categoryId: targetCat.id,
          categoryName: targetCat.name,
          amountPaisa: item.suggested_amount_paisa || 0,
          rawText: item.raw_text,
          createdByName: currentUserName,
          note: `Resolved from Review Queue: ${item.reason}`,
        },
        currentUserId
      );

      // 2. Mark queue item as resolved
      await ledgerService.updateReviewQueueStatus(item.id, 'resolved');
      setResolvingId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to resolve queue item:', err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await ledgerService.updateReviewQueueStatus(id, 'dismissed');
      await loadData();
    } catch (err) {
      console.error('Failed to dismiss queue item:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Review Queue</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Messages parked with &ldquo;Skip for now&rdquo; or unhandled entries. These are strictly excluded from all shop totals until resolved.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 self-end sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-700 text-sm">Review Queue is Empty</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
            All typed entries have been processed and confirmed into the ledger.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="font-mono text-sm font-bold text-gray-900">&ldquo;{item.raw_text}&rdquo;</div>
                <div className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block border border-amber-200">
                  Reason: {item.reason}
                </div>
                {item.suggested_amount_paisa && (
                  <div className="text-xs text-gray-600 font-mono">
                    Suggested Amount: {formatPaisa(item.suggested_amount_paisa)}
                  </div>
                )}
                <div className="text-[11px] text-gray-400">
                  Parked on {new Date(item.created_at).toLocaleString()}
                </div>
              </div>

              {/* Action Area */}
              <div className="flex items-center gap-2">
                {resolvingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="text-xs border border-gray-300 rounded-xl px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.kind})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleResolve(item, selectedCategory)}
                      disabled={!selectedCategory}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setResolvingId(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setResolvingId(item.id);
                        setSelectedCategory(item.suggested_category_id || '');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors border border-indigo-200"
                    >
                      <ArrowRight className="w-3.5 h-3.5" /> Resolve & Save
                    </button>
                    <button
                      onClick={() => handleDismiss(item.id)}
                      className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl transition-colors"
                      title="Dismiss from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
