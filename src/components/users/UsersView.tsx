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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#f5f7fa] select-none text-[#102a43]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#d9e2ec]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#102a43]">
            Staff & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-[#627d98] mt-0.5">
            Manage organization members, permission scopes, and simulate user
            roles.
          </p>
        </div>

        <Badge variant="slate">Current session: {role || "SIGNED OUT"}</Badge>
      </div>

      {/* Staff Directory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <Card key={p.id} className="p-4 space-y-3 bg-white border border-[#d9e2ec]">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-full bg-[#f5f7fa] border border-[#d9e2ec] flex items-center justify-center font-bold text-teal-800">
                {p.full_name.charAt(0)}
              </div>
              <Badge
                variant={
                  p.role === "OWNER" ? "teal"
                  : p.role === "MANAGER" ?
                    "emerald"
                  : "slate"
                }
              >
                {p.role}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#102a43]">
                {p.full_name}
              </h3>
              <p className="text-xs text-[#627d98] font-mono mt-0.5">
                {p.email}
              </p>
            </div>

            <div className="pt-2 border-t border-[#d9e2ec] text-[11px] text-[#829ab1]">
              Active Member • Organization Staff
            </div>
          </Card>
        ))}
      </div>

      {/* RBAC Permission Matrix */}
      <Card className="p-0 overflow-hidden bg-white border border-[#d9e2ec]">
        <div className="p-4 border-b border-[#d9e2ec]">
          <CardTitle>Role Permissions Matrix</CardTitle>
          <p className="text-xs text-[#627d98] mt-0.5">
            Strict authorization boundaries enforced at application and database
            RLS levels.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                <th className="py-3 px-4">System Capability</th>
                <th className="py-3 px-4 text-center">Cashier</th>
                <th className="py-3 px-4 text-center">Manager</th>
                <th className="py-3 px-4 text-center">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d9e2ec] font-sans">
              {permissions.map((perm, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-[#f5f7fa] transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-[#102a43]">
                    {perm.name}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.cashier ?
                      <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                    : <X className="h-4 w-4 text-[#bcccdc] mx-auto" />}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.manager ?
                      <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                    : <X className="h-4 w-4 text-[#bcccdc] mx-auto" />}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.owner ?
                      <Check className="h-4 w-4 text-teal-700 mx-auto" />
                    : <X className="h-4 w-4 text-[#bcccdc] mx-auto" />}
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
