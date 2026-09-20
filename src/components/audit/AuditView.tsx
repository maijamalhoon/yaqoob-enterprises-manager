import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { auditRepo } from '../../services';
import { AuditLog } from '../../types';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/utils';
import { FileCheck2, Search, ShieldCheck, Filter } from 'lucide-react';

export const AuditView: React.FC = () => {
  const { organization } = useAuth();
  const { dataVersion } = useApp();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    async function loadLogs() {
      const list = await auditRepo.getLogs(organization.id, 200);
      setLogs(list);
    }
    loadLogs();
  }, [organization.id, dataVersion]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log) => {
      const matchesQ =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.user_name.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(q));

      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
      return matchesQ && matchesAction;
    });
  }, [logs, searchQuery, actionFilter]);

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action)));
  }, [logs]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-950 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Audit Trail & Event Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically trace voids, stock adjustments, cashier closes, and funds transfers.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-mono">
          <ShieldCheck className="h-4 w-4" />
          <span>Immutable Ledger Active</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, user, or invoice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="ALL">All Actions</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Authorized User</th>
                <th className="py-3 px-3">Action Type</th>
                <th className="py-3 px-3">Entity / Record</th>
                <th className="py-3 px-4">Details & State Mutation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredLogs.map((log) => {
                const isVoid = log.action.includes('VOID');
                const isCreate = log.action.includes('CREATE');

                return (
                  <tr key={log.id} className="hover:bg-slate-900/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{log.user_name}</td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={isVoid ? 'rose' : isCreate ? 'cyan' : 'amber'}
                        size="sm"
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      <span className="text-slate-300 font-semibold">{log.entity}</span>
                      {log.entity_id && (
                        <span className="block text-[10px] text-slate-500">#{log.entity_id}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 leading-relaxed font-sans">
                      {log.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
