import React, { useState, useEffect, useCallback } from "react";
import { TodayStrip } from "./TodayStrip";
import { ChatFeed } from "./ChatFeed";
import { ChatComposer } from "./ChatComposer";
import { ConfirmationModal } from "./ConfirmationModal";
import { UndoToast } from "./UndoToast";
import { VoidModal } from "./VoidModal";
import { EditModal } from "./EditModal";
import { InstallHelpModal } from "./InstallHelpModal";
import {
  ledgerService,
  OFFLINE_SYNC_COMPLETE_EVENT,
} from "../../services/ledgerService";
import { parseMessage, ParseResult, ClarificationOption } from "../../parser";
import {
  LedgerAccount,
  Transaction,
  TransactionDraft,
  DailySummary,
} from "../../types/ledger";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { getKarachiBusinessDate } from "../../lib/dates";

interface UndoState {
  transactionId: string;
  categoryName: string;
  amountPaisa: number;
  type: string;
  updatedAt: string;
}

export const ChatView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useApp();
  const currentUserId = user?.id || "offline-user";
  const currentUserName =
    user?.full_name || user?.email?.split("@")[0] || "Shop Brother";

  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [drafts, setDrafts] = useState<TransactionDraft[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [summary, setSummary] = useState<DailySummary>({
    business_date: getKarachiBusinessDate(),
    income_paisa: 0,
    expense_paisa: 0,
    net_profit_paisa: 0,
    capital_in_paisa: 0,
    withdrawal_paisa: 0,
    adjustment_in_paisa: 0,
    adjustment_out_paisa: 0,
    transaction_count: 0,
  });

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queuedCount, setQueuedCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  // Modals & Popups
  const [activeClarification, setActiveClarification] =
    useState<ParseResult | null>(null);
  const [batchEntries, setBatchEntries] = useState<ParseResult[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [voidingTransaction, setVoidingTransaction] =
    useState<Transaction | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  // Load data
  const loadDayData = useCallback(async () => {
    try {
      const todayStr = getKarachiBusinessDate();
      const [txs, sum, rev, pendingDrafts] = await Promise.all([
        ledgerService.getTransactionsForDate(todayStr),
        ledgerService.getDailySummary(todayStr),
        ledgerService.getReviewQueue(),
        ledgerService.getTransactionDrafts(todayStr),
      ]);
      const availableAccounts = await ledgerService.getPaymentAccounts();
      setTransactions(txs);
      setDrafts(pendingDrafts);
      setAccounts(availableAccounts);
      setSummary(sum);
      setReviewCount(rev.length);

      setQueuedCount(await ledgerService.getPendingTransactionCount());
    } catch (err) {
      console.error("Error loading ledger data:", err);
    }
  }, []);

  // Sync / Online listener + Refetch on foreground
  useEffect(() => {
    loadDayData();

    const handleOnline = async () => {
      setIsOnline(true);
      loadDayData();
    };

    const handleOfflineSyncComplete = () => {
      loadDayData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadDayData();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleOfflineSyncComplete);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Supabase Realtime Subscription across all 3 brothers
    const unsubscribe = ledgerService.subscribeToLiveTransactions(() => {
      loadDayData();
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleOfflineSyncComplete);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribe();
    };
  }, [loadDayData]);

  // Execute Save Transaction
  const executeSave = async (
    entry: ParseResult,
    chosenOption?: ClarificationOption,
  ): Promise<boolean> => {
    const type = chosenOption ? chosenOption.type : entry.type;
    const categoryId =
      chosenOption ? chosenOption.categoryId || null : entry.categoryId;
    const categoryName =
      chosenOption ?
        chosenOption.categoryName || entry.categoryName || type
      : entry.categoryName || type;
    const amountPaisa =
      chosenOption ? chosenOption.amountPaisa : entry.amountPaisa!;

    try {
      await ledgerService.createTransactionDraft(
        {
          type,
          categoryId,
          categoryName,
          amountPaisa,
          businessDate: entry.businessDate,
          rawText: entry.raw,
          createdByName: currentUserName,
          note: entry.note,
        },
        currentUserId,
      );
      if (entry.isFuzzyOrPhonetic && categoryId && entry.suggestedAlias) {
        ledgerService
          .learnAlias(categoryId, entry.suggestedAlias)
          .catch(console.warn);
      }

      await loadDayData();
      showToast(
        "success",
        "Entry saved",
        "Choose an account from the entry when you are ready to update its balance.",
      );
      return true;
    } catch (err) {
      console.error("Failed to record transaction:", err);
      showToast("error", "Entry not saved", "Please check the entry and try again.");
      return false;
    }
  };

  // Handler for text sent from ChatComposer
  const handleSendMessage = async (rawInput: string) => {
    // Recent transactions for duplicate checking (< 3 min)
    const recent = transactions.map((t) => ({
      categoryId: t.category_id,
      amountPaisa: t.amount_paisa,
      entryTimeUtc: t.device_entry_time,
      type: t.type,
    }));

    const categories = await ledgerService.getParserCategories();
    if (categories.length === 0) {
      showToast(
        "error",
        "Categories unavailable",
        "Reconnect to load your shop categories before recording entries.",
      );
      return;
    }
    const parsed = parseMessage(rawInput, recent, new Date(), categories);

    if (parsed.isBatch) {
      setBatchError(null);
      setBatchEntries(parsed.entries);
      return;
    }

    if (parsed.entries.length === 1) {
      const entry = parsed.entries[0];
      if (entry.canAutoSave) {
        // Auto-save with 6-second undo toast
        executeSave(entry);
      } else {
        // Show confirmation or clarification card
        setActiveClarification(entry);
      }
    }
  };

  // Confirmation modal callbacks
  const handleConfirmSingle = (
    entry: ParseResult,
    chosenOption?: ClarificationOption,
  ) => {
    setActiveClarification(null);
    executeSave(entry, chosenOption);
  };

  const handleConfirmBatch = async (entries: ParseResult[]) => {
    setBatchError(null);
    setIsSavingBatch(true);
    const failedEntries: ParseResult[] = [];

    try {
      for (const entry of entries) {
        if (!(await executeSave(entry))) failedEntries.push(entry);
      }
    } finally {
      setIsSavingBatch(false);
    }

    if (failedEntries.length > 0) {
      const savedCount = entries.length - failedEntries.length;
      setBatchEntries(failedEntries);
      setBatchError(
        `${savedCount} saved; ${failedEntries.length} failed. Only failed entries are shown for retry.`,
      );
    } else {
      setBatchEntries(null);
    }
  };

  const handleAssignDraft = async (draft: TransactionDraft, accountId: string) => {
    try {
      const result = await ledgerService.postTransactionDraft(draft.id, accountId);
      await loadDayData();
      showToast(
        "success",
        result.isQueuedOffline ? "Posting queued" : "Balance updated",
        result.isQueuedOffline
          ? "This entry will post to the selected account when you reconnect."
          : `${draft.category_name || draft.type} was posted to the selected account.`,
      );
    } catch (error) {
      console.error("Could not post transaction draft:", error);
      showToast("error", "Could not update balance", "Check the account and try again.");
    }
  };

  const handleSkipToReview = async (rawText: string, reason: string) => {
    setActiveClarification(null);
    try {
      await ledgerService.parkInReviewQueue(rawText, reason, currentUserId);
      await loadDayData();
    } catch (err) {
      console.error("Failed to park in review queue:", err);
    }
  };

  // Undo Action
  const handleUndo = async (transactionId: string) => {
    if (!undoState) return;
    try {
      await ledgerService.voidTransaction(
        transactionId,
        "6-second immediate undo",
        undoState.updatedAt,
      );
      setUndoState(null);
      await loadDayData();
    } catch (err) {
      console.error("Failed to undo transaction:", err);
    }
  };

  // Void Action
  const handleConfirmVoid = async (
    id: string,
    reason: string,
    currentUpdatedAt: string,
  ) => {
    await ledgerService.voidTransaction(id, reason, currentUpdatedAt);
    await loadDayData();
  };

  // Restore Action
  const handleRestore = async (tx: Transaction) => {
    try {
      await ledgerService.restoreTransaction(tx.id, tx.updated_at);
      await loadDayData();
    } catch (err) {
      console.error("Failed to restore transaction:", err);
    }
  };

  // Edit Action
  const handleConfirmEdit = async (
    id: string,
    updates: { amount_paisa?: number; note?: string | null },
    currentUpdatedAt: string,
  ) => {
    await ledgerService.editTransaction(id, updates, currentUpdatedAt);
    await loadDayData();
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-surface">
      {/* 1. Today Strip with Income, Expense, Net */}
      <TodayStrip
        summary={summary}
        isOnline={isOnline}
        queuedCount={queuedCount}
        reviewCount={reviewCount}
        onOpenInstallHelp={() => setShowInstallHelp(true)}
      />

      {/* 2. Chat Feed (Bubbles) */}
      <ChatFeed
        transactions={transactions}
        drafts={drafts}
        accounts={accounts}
        onEdit={(tx) => setEditingTransaction(tx)}
        onVoid={(tx) => setVoidingTransaction(tx)}
        onRestore={handleRestore}
        onAssignDraft={handleAssignDraft}
      />

      {/* 3. Chat Composer (48px targets, chips, Enter-to-send) */}
      <ChatComposer
        onSend={handleSendMessage}
        disabled={isSavingBatch}
      />

      {/* 4. Undo Toast (6-Second countdown) */}
      {undoState && (
        <UndoToast
          transactionId={undoState.transactionId}
          categoryName={undoState.categoryName}
          amountPaisa={undoState.amountPaisa}
          type={undoState.type}
          onUndo={handleUndo}
          onDismiss={() => setUndoState(null)}
        />
      )}

      {/* 5. Confirmation / Clarification / Batch Modal */}
      {(activeClarification || batchEntries) && (
        <ConfirmationModal
          result={activeClarification}
          batchEntries={batchEntries || undefined}
          onConfirmSingle={handleConfirmSingle}
          onConfirmBatch={handleConfirmBatch}
          batchError={batchError}
          isSavingBatch={isSavingBatch}
          onSkipToReview={handleSkipToReview}
          onCancel={() => {
            setActiveClarification(null);
            setBatchEntries(null);
            setBatchError(null);
          }}
        />
      )}

      {/* 6. Void Modal */}
      {voidingTransaction && (
        <VoidModal
          transaction={voidingTransaction}
          onConfirmVoid={handleConfirmVoid}
          onClose={() => setVoidingTransaction(null)}
        />
      )}

      {/* 7. Edit Modal */}
      {editingTransaction && (
        <EditModal
          transaction={editingTransaction}
          onConfirmEdit={handleConfirmEdit}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* 8. Install Help Modal */}
      {showInstallHelp && (
        <InstallHelpModal onClose={() => setShowInstallHelp(false)} />
      )}
    </div>
  );
};
