import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getProfiles } from "../../services";
import { UserProfile } from "../../types";
import { Card, CardHeader, CardTitle } from "../common/Card";
import { Badge } from "../common/Badge";
import { UserCheck, Shield, Check, X, Users } from "lucide-react";

export const UsersView: React.FC = () => {
  const { organization, user, role } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    getProfiles(organization.id)
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, [organization.id]);

  const permissions = [
    { name: "Fast POS Checkout", cashier: true, manager: true, owner: true },
    {
      name: "Record Daily Expenses",
      cashier: true,
      manager: true,
      owner: true,
    },
    {
      name: "Submit Daily Cash Closing",
      cashier: true,
      manager: true,
      owner: true,
    },
    { name: "Void Completed Sale", cashier: false, manager: true, owner: true },
    { name: "Void Expense", cashier: false, manager: true, owner: true },
    {
      name: "Stock Movement & Cost Adjustment",
      cashier: false,
      manager: true,
      owner: true,
    },
    {
      name: "Inter-Account Money Transfer",
      cashier: false,
      manager: true,
      owner: true,
    },
    {
      name: "Executive P&L & Margins Report",
      cashier: false,
      manager: true,
      owner: true,
    },
    {
      name: "Tenant Business Configuration",
      cashier: false,
      manager: false,
      owner: true,
    },
    {
      name: "Manage Staff Accounts",
      cashier: false,
      manager: false,
      owner: true,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Staff & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage organization members, permission scopes, and simulate user
            roles.
          </p>
        </div>

        <Badge variant="slate">Current session: {role || "SIGNED OUT"}</Badge>
      </div>

      {/* Staff Directory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <Card key={p.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                {p.full_name.charAt(0)}
              </div>
              <Badge
                variant={
                  p.role === "OWNER" ? "cyan"
                  : p.role === "MANAGER" ?
                    "teal"
                  : "slate"
                }
              >
                {p.role}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-200">
                {p.full_name}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {p.email}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
              Active Member • Organization Staff
            </div>
          </Card>
        ))}
      </div>

      {/* RBAC Permission Matrix */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <CardTitle>Role Permissions Matrix</CardTitle>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict authorization boundaries enforced at application and database
            RLS levels.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-4">System Capability</th>
                <th className="py-3 px-4 text-center">Cashier</th>
                <th className="py-3 px-4 text-center">Manager</th>
                <th className="py-3 px-4 text-center">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {permissions.map((perm, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-900/70 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-slate-200">
                    {perm.name}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.cashier ?
                      <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                    : <X className="h-4 w-4 text-slate-600 mx-auto" />}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.manager ?
                      <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                    : <X className="h-4 w-4 text-slate-600 mx-auto" />}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.owner ?
                      <Check className="h-4 w-4 text-cyan-400 mx-auto" />
                    : <X className="h-4 w-4 text-slate-600 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
