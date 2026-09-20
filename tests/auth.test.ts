import { describe, expect, it } from "vitest";
import { sqliteRepository } from "@/services/sqliteRepository";
import { getSqliteDatabase } from "@/services/sqliteEngine";

const organization = {
  id: "auth-org-test",
  name: "Offline Test Shop",
  owner_name: "Test Owner",
  currency: "PKR",
  currency_symbol: "Rs.",
  country: "Pakistan",
  timezone: "Asia/Karachi",
  business_category: "Retail",
  tax_rate: 0,
  tax_enabled: false,
  invoice_prefix: "TEST-",
  next_invoice_number: 1001,
  created_at: new Date().toISOString(),
};

const profile = {
  id: "auth-profile-test",
  email: "auth-test@example.com",
  full_name: "Test Owner",
  role: "OWNER" as const,
  organization_id: organization.id,
  is_active: true,
  created_at: new Date().toISOString(),
};

describe("offline local authentication persistence", () => {
  it("persists a salted PIN hash and restores the linked organization principal data", async () => {
    const db = await getSqliteDatabase();
    const salt = "00112233445566778899aabbccddeeff";
    const hash = "hash-for-auth-test";

    await sqliteRepository.createLocalAuthAccount(organization, profile, hash, salt);

    const account = await sqliteRepository.getLocalAuthAccount();
    expect(account).toMatchObject({ organization_id: organization.id, profile_id: profile.id, pin_hash: hash, pin_salt: salt });
    expect(account?.pin_hash).not.toBe("1234");
    expect(await sqliteRepository.getOrganization(organization.id)).toMatchObject({ name: organization.name });
    expect(await sqliteRepository.getSessionProfile(profile.id)).toMatchObject({ organization_id: organization.id, role: "OWNER" });
    expect(await db.select("SELECT pin_hash FROM local_auth_accounts WHERE organization_id = ?", [organization.id])).toHaveLength(1);
  });

  it("rejects a second local shop account", async () => {
    await expect(sqliteRepository.createLocalAuthAccount(organization, profile, "another-hash", "another-salt")).rejects.toThrow(/already exists/);
  });
});