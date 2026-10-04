import React, { useEffect, useState } from "react";
import { parseInputToPaisa, formatPaisa } from "../../lib/money";
import { getKarachiBusinessDate } from "../../lib/dates";
import { ledgerService } from "../../services/ledgerService";
import { useAuth } from "../../context/AuthContext";
import { LedgerAccount } from "../../types/ledger";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";

interface ParsedRegisterRow {
  date: string;
  categoryName: string;
  type: "income" | "expense";
  amountPaisa: number;
  rawText: string;
  isValid: boolean;
  error?: string;
}

interface PaperRegisterImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export const PaperRegisterImportModal: React.FC<
  PaperRegisterImportModalProps
> = ({ onClose, onImportComplete }) => {
  const { user } = useAuth();
  const currentUserId = user?.id || "offline-user";
  const currentUserName = user?.full_name || "Shop Brother";

  const [csvText, setCsvText] = useState("");
  const [previewRows, setPreviewRows] = useState<ParsedRegisterRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  useEffect(() => {
    ledgerService
      .getPaymentAccounts()
      .then(setAccounts)
      .catch((err) => console.error("Could not load import accounts:", err));
  }, []);

  const parseCSV = () => {
    if (!csvText.trim()) return;

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed: ParsedRegisterRow[] = [];

    // Format expected: Date, Category/Note, Amount, Type (optional: income/expense or minus sign)
    // Example: 2026-09-15, PRINTING, 300, income
    // Example: 2026-09-15, PAPER STOCK, -2000, expense
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header if line starts with date or "Date"
      if (i === 0 && line.toLowerCase().startsWith("date")) continue;

      const cols = line
        .split(",")
        .map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (cols.length < 3) continue;

      const dateStr = cols[0] || getKarachiBusinessDate();
      const catOrNote = cols[1];
      const rawAmt = cols[2];
      const explicitType = cols[3]?.toLowerCase();

      const isMinus = rawAmt.startsWith("-") || explicitType === "expense";
      const parsedAmt = parseInputToPaisa(rawAmt.replace("-", ""));

      parsed.push({
        date: dateStr,
        categoryName: catOrNote,
        type: isMinus ? "expense" : "income",
        amountPaisa: parsedAmt.paisa,
        rawText: line,
        isValid: parsedAmt.isValid && parsedAmt.paisa > 0,
        error: parsedAmt.isValid ? undefined : "Invalid amount",
      });
    }

    setPreviewRows(parsed);
  };

  const handleCommitImport = async () => {
    const validRows = previewRows.filter((r) => r.isValid);
    if (validRows.length === 0 || !selectedAccountId) return;

    setIsImporting(true);
    let imported = 0;

    try {
      for (const row of validRows) {
        await ledgerService.recordTransaction(
          {
            type: row.type,
            categoryId: null,
            categoryName: row.categoryName,
            accountId: selectedAccountId,
            amountPaisa: row.amountPaisa,
            businessDate: row.date,
            rawText: `[Paper Register] ${row.rawText}`,
            createdByName: currentUserName,
            note: "Imported from historical paper register CSV",
          },
          currentUserId,
        );
        imported++;
      }

      setImportSummary(
        `Successfully imported ${imported} entries into the ledger!`,
      );
      onImportComplete();
    } catch (err: any) {
      setImportSummary(
        `Import error: ${err?.message || "Failed to import all records"}`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            <Upload className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-base">
              Paper Register CSV Import
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-gray-700">
          <p className="text-gray-500">
            Paste your historical paper register CSV below to preview before
            committing. Format:{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded">
              YYYY-MM-DD, Category/Details, Amount
            </code>
            .
          </p>

          <label className="block space-y-1.5 text-xs font-semibold text-secondary">
            <span>Account for imported entries</span>
            <select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="min-h-10 w-full rounded-md border border-border-standard bg-white px-2.5 text-xs font-normal focus:border-primary focus:outline-none"
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`2026-09-01, PRINTING, 450
2026-09-01, PAPER STOCK, -1500
2026-09-02, LAMINATION, 200`}
            className="w-full p-3 font-mono text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />

          <button
            onClick={parseCSV}
            disabled={!csvText.trim()}
            className="px-3.5 py-1.5 bg-gray-800 hover:bg-black disabled:opacity-40 text-white rounded-xl font-semibold"
          >
            Preview Entries ({previewRows.length} ready)
          </button>

          {/* Preview Table */}
          {previewRows.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-[11px] text-gray-500 uppercase">
                Preview Before Commit (
                {previewRows.filter((r) => r.isValid).length} valid,{" "}
                {previewRows.filter((r) => !r.isValid).length} invalid)
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {previewRows.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between font-mono text-xs"
                  >
                    <div>
                      <span className="font-semibold text-gray-800">
                        {r.date}
                      </span>{" "}
                      • {r.categoryName} ({r.type})
                    </div>
                    <div className="font-bold">
                      {r.isValid ?
                        formatPaisa(r.amountPaisa)
                      : <span className="text-rose-600">{r.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importSummary && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium">
              {importSummary}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            Close
          </button>
          <button
            onClick={handleCommitImport}
            disabled={
              isImporting ||
              !selectedAccountId ||
              previewRows.filter((r) => r.isValid).length === 0
            }
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs"
          >
            {isImporting ? "Importing..." : "Commit Import"}
          </button>
        </div>
      </div>
    </div>
  );
};
