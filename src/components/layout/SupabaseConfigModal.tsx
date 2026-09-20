import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { getSupabaseConfig, updateSupabaseConfig } from "../../lib/supabase";
import {
  syncEngine,
  SyncStatus,
  SyncLogEntry,
} from "../../services/syncEngine";
import {
  Cloud,
  Database,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Layers,
  Activity,
} from "lucide-react";
import { formatDateTime } from "../../lib/utils";

export const SupabaseConfigModal: React.FC = () => {
  const { isSupabaseConfigOpen, setIsSupabaseConfigOpen, showToast } = useApp();
  const { isSupabaseReady } = useAuth();

  const [activeTab, setActiveTab] = useState<"CONFIG" | "SYNC">("CONFIG");

  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [key, setKey] = useState(currentConfig.anonKey);
  const [saved, setSaved] = useState(false);

  // Sync Diagnostics State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    syncEngine.getStatus(),
  );
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (!isSupabaseConfigOpen) return;

    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status);
    });

    syncEngine.getDiagnostics().then((diag) => {
      setSyncLogs(diag.logs);
      setSyncStatus((prev) => ({ ...prev, pendingCount: diag.pendingCount }));
    });

    return () => unsubscribe();
  }, [isSupabaseConfigOpen]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      updateSupabaseConfig(url, key.trim());
      setSaved(true);
      showToast(
        "success",
        "Supabase Configuration Updated",
        "Cloud keys saved.",
      );
    } catch (error) {
      showToast(
        "error",
        "Invalid Supabase URL",
        error instanceof Error ? error.message : "Enter the project API URL.",
      );
      return;
    }
    setTimeout(() => {
      setIsSupabaseConfigOpen(false);
      window.location.reload();
    }, 800);
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const res = await syncEngine.syncNow();
      if (res.error) {
        showToast("error", "Sync Failed", res.error);
      } else {
        showToast(
          "success",
          "Sync Completed",
          `Pushed ${res.pushed} pending record(s) to cloud database.`,
        );
      }
      const diag = await syncEngine.getDiagnostics();
      setSyncLogs(diag.logs);
      setSyncStatus((prev) => ({ ...prev, pendingCount: diag.pendingCount }));
    } finally {
      setIsManualSyncing(false);
    }
  };

  return (
    <Modal
      isOpen={isSupabaseConfigOpen}
      onClose={() => setIsSupabaseConfigOpen(false)}
      title="Cloud & SQLite Sync Center"
      description="Configure remote PostgreSQL connectivity and inspect real-time synchronization queue."
      maxWidth="lg"
    >
      <div className="space-y-4 py-2">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#d9e2ec] text-xs">
          <button
            onClick={() => setActiveTab("CONFIG")}
            className={`pb-2 px-3 font-medium transition-colors cursor-pointer ${
              activeTab === "CONFIG" ?
                "border-b-2 border-teal-700 text-teal-800 font-semibold"
              : "text-[#627d98] hover:text-[#102a43]"
            }`}
          >
            Cloud Credentials
          </button>
          <button
            onClick={() => setActiveTab("SYNC")}
            className={`pb-2 px-3 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "SYNC" ?
                "border-b-2 border-teal-700 text-teal-800 font-semibold"
              : "text-[#627d98] hover:text-[#102a43]"
            }`}
          >
            <span>Sync Queue & Diagnostics</span>
            {syncStatus.pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                {syncStatus.pendingCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === "CONFIG" && (
          <div className="space-y-4">
            {/* Connection status banner */}
            <div className="flex items-start gap-3 p-3.5 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec]">
              {isSupabaseReady ?
                <Cloud className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              : <Database className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />}
              <div className="text-xs space-y-1 text-left">
                <p className="font-semibold text-[#102a43]">
                  Current Storage Mode:{" "}
                  <span
                    className={
                      isSupabaseReady ? "text-emerald-700" : "text-teal-700"
                    }
                  >
                    {isSupabaseReady ?
                      "Cloud Synced (Local Offline Store + Remote PostgreSQL)"
                    : "Offline-First Local Store (Active)"}
                  </span>
                </p>
                <p className="text-[#627d98] leading-relaxed">
                  {isSupabaseReady ?
                    "Completed business operations are queued locally and synchronized to Supabase when the authenticated workspace is cloud-compatible."
                  : "The application operates offline. Configure a Supabase project to enable authenticated cloud synchronization."
                  }
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <Input
                label="Supabase Project URL"
                placeholder="https://your-project.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />

              <Input
                label="Supabase Publishable / Anon Key"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />

              <div className="p-3 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec] text-[11px] text-[#627d98] space-y-1">
                <div className="flex items-center gap-1.5 text-[#243b53] font-semibold">
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  <span>Security & Principle of Minimum Privilege</span>
                </div>
                <p>
                  Only public/publishable credentials may be entered. The
                  privileged{" "}
                  <code className="text-rose-700 font-mono">service_role</code>{" "}
                  secret key must never be entered or distributed with client
                  applications.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d9e2ec]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsSupabaseConfigOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {saved ?
                    <>
                      <CheckCircle2 className="h-4 w-4 text-white" />{" "}
                      Saved!
                    </>
                  : "Save & Connect"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "SYNC" && (
          <div className="space-y-4">
            {/* Live Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec]">
                <span className="text-[10px] text-[#627d98] uppercase font-mono block">
                  Network Connectivity
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs">
                  {syncStatus.isOnline ?
                    <>
                      <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">ONLINE</span>
                    </>
                  : <>
                      <WifiOff className="h-3.5 w-3.5 text-rose-600" />
                      <span className="text-rose-700">OFFLINE</span>
                    </>
                  }
                </div>
              </div>

              <div className="p-3 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec]">
                <span className="text-[10px] text-[#627d98] uppercase font-mono block">
                  Pending Offline Queue
                </span>
                <p className="text-sm font-bold font-mono text-teal-700 mt-1">
                  {syncStatus.pendingCount} Record(s)
                </p>
              </div>

              <div className="p-3 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec] col-span-2 sm:col-span-1">
                <span className="text-[10px] text-[#627d98] uppercase font-mono block">
                  Last Cloud Sync
                </span>
                <p className="text-xs font-mono text-[#243b53] mt-1 truncate">
                  {syncStatus.lastSyncTime ?
                    formatDateTime(syncStatus.lastSyncTime)
                  : "Never"}
                </p>
              </div>
            </div>

            {/* Sync Now Action */}
            <div className="flex items-center justify-between p-3 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec]">
              <div className="text-xs">
                <p className="font-semibold text-[#102a43]">
                  Force Instant Cloud Synchronization
                </p>
                <p className="text-[11px] text-[#627d98]">
                  Drain pending local changes to remote PostgreSQL with
                  idempotent deduplication.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isManualSyncing || !syncStatus.isOnline}
                onClick={handleManualSync}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isManualSyncing ? "animate-spin" : ""}`}
                />
                <span>{isManualSyncing ? "Syncing..." : "Sync Now"}</span>
              </Button>
            </div>

            {/* Sync Log History */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#243b53] block">
                Recent Sync Events
              </span>
              <div className="max-h-48 overflow-y-auto rounded-[10px] border border-[#d9e2ec] bg-white p-2 text-[11px] space-y-1.5">
                {syncLogs.length === 0 ?
                  <p className="text-[#627d98] text-center py-4 italic">
                    No sync events logged yet.
                  </p>
                : syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-1.5 rounded-[8px] bg-[#f5f7fa] border border-[#d9e2ec]"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3 text-teal-700" />
                        <span className="text-[#243b53] font-mono font-medium">
                          {log.sync_type}
                        </span>
                        <span className="text-[#627d98]">•</span>
                        <span className="text-[#627d98]">
                          Pushed {log.records_pushed}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#627d98]">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#d9e2ec]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsSupabaseConfigOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
