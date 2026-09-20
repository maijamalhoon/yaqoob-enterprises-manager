import React, { createContext, useContext, useEffect, useState } from "react";
import { Organization, UserProfile } from "../types";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import { sqliteRepository } from "../services/sqliteRepository";
import { syncEngine } from "../services/syncEngine";
import { setSecurityPrincipal } from "../lib/security";

const MIN_PIN_LENGTH = 4;

const EMPTY_ORGANIZATION: Organization = {
  id: "",
  name: "",
  owner_name: "",
  currency: "PKR",
  currency_symbol: "Rs.",
  country: "Pakistan",
  timezone: "Asia/Karachi",
  business_category: "",
  tax_rate: 0,
  tax_enabled: false,
  invoice_prefix: "YE-",
  next_invoice_number: 1001,
  created_at: "",
};

async function derivePin(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 120000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function encodeBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBytes(value: string): Uint8Array {
  return new Uint8Array(
    value.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derivePin(pin, salt), salt: encodeBytes(salt) };
}

interface AuthContextType {
  user: UserProfile | null;
  organization: Organization;
  role: UserProfile["role"] | null;
  isSupabaseReady: boolean;
  isLoading: boolean;
  isLocked: boolean;
  hasLocalAccount: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  updatePin: (
    currentPin: string,
    newPin: string,
  ) => Promise<{ success: boolean; error?: string }>;
  createAccount: (details: {
    shopName: string;
    ownerName: string;
    email: string;
    pin: string;
    confirmPin: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onboardingCompleted: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    orgName: string,
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateOrganization: (org: Partial<Organization>) => void;
  completeOnboarding: (orgData: Partial<Organization>) => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [organization, setOrganization] =
    useState<Organization>(EMPTY_ORGANIZATION);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserProfile["role"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [hasLocalAccount, setHasLocalAccount] = useState(false);
  const [localAccount, setLocalAccount] =
    useState<Awaited<ReturnType<typeof sqliteRepository.getLocalAuthAccount>>>(
      null,
    );
  const [error, setError] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const isSupabaseReady = isSupabaseConfigured();

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      setIsLoading(true);
      setSecurityPrincipal(null);
      try {
        await sqliteRepository.migrateLegacyLocalStorage();
        const account = await sqliteRepository.getLocalAuthAccount();
        if (cancelled) return;
        setLocalAccount(account);
        setHasLocalAccount(Boolean(account));
        if (account) {
          const [localOrg, profile] = await Promise.all([
            sqliteRepository.getOrganization(account.organization_id),
            sqliteRepository.getSessionProfile(account.profile_id),
          ]);
          if (localOrg) setOrganization(localOrg);
          if (profile) {
            setUser(profile);
            setRole(profile.role);
          }
        }
        if (account && (typeof navigator === "undefined" || navigator.onLine))
          syncEngine.syncNow().catch(() => {});
        if (isSupabaseConfigured())
          getSupabaseClient()
            ?.auth.getSession()
            .catch(() => {});
      } catch (initializationError) {
        console.warn("Auth initialization warning:", initializationError);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseReady]);

  const activate = (profile: UserProfile, org: Organization) => {
    setOrganization(org);
    setUser(profile);
    setRole(profile.role);
    setSecurityPrincipal(profile);
    setIsLocked(false);
  };

  const unlock = async (enteredPin: string): Promise<boolean> => {
    if (!localAccount || enteredPin.length < MIN_PIN_LENGTH) return false;
    try {
      const hash = await derivePin(
        enteredPin,
        decodeBytes(localAccount.pin_salt),
      );
      if (hash !== localAccount.pin_hash) return false;
      const [org, profile] = await Promise.all([
        sqliteRepository.getOrganization(localAccount.organization_id),
        sqliteRepository.getSessionProfile(localAccount.profile_id),
      ]);
      if (!org || !profile || !profile.is_active) return false;
      activate(profile, org);
      return true;
    } finally {
      enteredPin = "";
    }
  };

  const lock = () => {
    setIsLocked(true);
    setSecurityPrincipal(null);
  };

  const createAccount = async (details: {
    shopName: string;
    ownerName: string;
    email: string;
    pin: string;
    confirmPin: string;
  }) => {
    const shopName = details.shopName.trim();
    const ownerName = details.ownerName.trim();
    const email = details.email.trim();
    if (!shopName || !ownerName || !details.pin)
      return {
        success: false,
        error: "Shop name, owner name, and PIN are required.",
      };
    if (details.pin.length < MIN_PIN_LENGTH)
      return { success: false, error: "PIN must be at least 4 characters." };
    if (details.pin !== details.confirmPin)
      return { success: false, error: "PIN confirmation does not match." };
    if (hasLocalAccount)
      return { success: false, error: "A local shop account already exists." };
    const now = new Date().toISOString();
    const org: Organization = {
      ...EMPTY_ORGANIZATION,
      id: crypto.randomUUID(),
      name: shopName,
      owner_name: ownerName,
      email: email || undefined,
      created_at: now,
      updated_at: now,
    };
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      email,
      full_name: ownerName,
      role: "OWNER",
      organization_id: org.id,
      is_active: true,
      created_at: now,
    };
    const credential = await hashPin(details.pin);
    try {
      await sqliteRepository.createLocalAuthAccount(
        org,
        profile,
        credential.hash,
        credential.salt,
      );
      const account = await sqliteRepository.getLocalAuthAccount();
      setLocalAccount(account);
      setHasLocalAccount(true);
      setOnboardingCompleted(true);
      activate(profile, org);
      return { success: true };
    } catch (creationError) {
      console.error("Local account creation failed:", creationError);
      return {
        success: false,
        error: getErrorMessage(
          creationError,
          "Could not create the local account.",
        ),
      };
    }
  };

  const updatePin = async (currentPin: string, newPin: string) => {
    if (!localAccount)
      return { success: false, error: "No local account exists." };
    if (newPin.length < MIN_PIN_LENGTH)
      return {
        success: false,
        error: "New PIN must be at least 4 characters.",
      };
    if (
      !(await unlockCheck(
        currentPin,
        localAccount.pin_hash,
        localAccount.pin_salt,
      ))
    )
      return { success: false, error: "Current PIN is incorrect" };
    const credential = await hashPin(newPin);
    await sqliteRepository.updateLocalAuthAccount(
      localAccount.id,
      credential.hash,
      credential.salt,
    );
    setLocalAccount({
      ...localAccount,
      pin_hash: credential.hash,
      pin_salt: credential.salt,
    });
    return { success: true };
  };

  const updateOrganization = (orgData: Partial<Organization>) => {
    const updated = {
      ...organization,
      ...orgData,
      updated_at: new Date().toISOString(),
    };
    void sqliteRepository.updateOrganization(updated);
    setOrganization(updated);
    if (user) {
      const updatedUser = {
        ...user,
        full_name: updated.owner_name,
        email: updated.email || user.email,
      };
      setUser(updatedUser);
      setSecurityPrincipal(updatedUser);
    }
  };

  const completeOnboarding = (orgData: Partial<Organization>) => {
    updateOrganization(orgData);
    setOnboardingCompleted(true);
  };

  const signIn = async () => ({
    error: "Use the local PIN to unlock this shop.",
  });
  const signUp = async () => ({
    error: "Use the shop account setup screen to create a local account.",
  });
  const signOut = async () => lock();

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        role,
        isSupabaseReady,
        isLoading,
        isLocked,
        hasLocalAccount,
        unlock,
        lock,
        updatePin,
        createAccount,
        onboardingCompleted,
        signIn,
        signUp,
        signOut,
        updateOrganization,
        completeOnboarding,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

async function unlockCheck(
  pin: string,
  expectedHash: string,
  salt: string,
): Promise<boolean> {
  return (await derivePin(pin, decodeBytes(salt))) === expectedHash;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
/*
import React, { createContext, useContext, useEffect, useState } from "react";
import { Organization, UserProfile } from "../types";
import { DEFAULT_ORGANIZATION } from "../lib/mockData";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import { StorageEngine } from "../services/storageEngine";
import { isTauriEnvironment } from "../services/sqliteEngine";
import { sqliteRepository } from "../services/sqliteRepository";
import { syncEngine } from "../services/syncEngine";
import { setSecurityPrincipal } from "../lib/security";

const DEFAULT_PIN = "1234";
const PIN_STORAGE_KEY = "yaqoob_counter_pin_hash";

async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(pin.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface AuthContextType {
  user: UserProfile | null;
  organization: Organization;
  role: UserProfile["role"] | null;
  isSupabaseReady: boolean;
  isLoading: boolean;
  isLocked: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  updatePin: (
    currentPin: string,
    newPin: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onboardingCompleted: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    orgName: string,
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateOrganization: (org: Partial<Organization>) => void;
  completeOnboarding: (orgData: Partial<Organization>) => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [organization, setOrganization] = useState<Organization>(() => {
    if (isTauriEnvironment()) return DEFAULT_ORGANIZATION;
    const org = StorageEngine.getOrganization(DEFAULT_ORGANIZATION.id);
    return org || DEFAULT_ORGANIZATION;
  });

  const defaultOwner: UserProfile = {
    id: "usr-owner-1",
    email: organization.email || "yaqoobenterprisesofficial@gmail.com",
    full_name: organization.owner_name || "Muhammad Yaqoob",
    role: "OWNER",
    organization_id: organization.id,
    is_active: true,
    created_at: organization.created_at || new Date().toISOString(),
  };

  const [user, setUser] = useState<UserProfile | null>(defaultOwner);
  const [role, setRole] = useState<UserProfile["role"] | null>("OWNER");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(
    () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("yaqoob_onboarding_done") === "true";
      }
      return true;
    },
  );

  const isSupabaseReady = isSupabaseConfigured();

  const getStoredPinHash = async (): Promise<string> => {
    if (typeof window === "undefined") return hashPin(DEFAULT_PIN);
    const stored = localStorage.getItem(PIN_STORAGE_KEY);
    if (!stored) {
      const defaultHash = await hashPin(DEFAULT_PIN);
      localStorage.setItem(PIN_STORAGE_KEY, defaultHash);
      return defaultHash;
    }
    return stored;
  };

  const unlock = async (enteredPin: string): Promise<boolean> => {
    try {
      const targetHash = await getStoredPinHash();
      const enteredHash = await hashPin(enteredPin);
      if (enteredHash === targetHash) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const lock = () => {
    setIsLocked(true);
  };

  const updatePin = async (
    currentPin: string,
    newPin: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!newPin || newPin.length < 4) {
      return {
        success: false,
        error: "New PIN must be at least 4 digits/characters",
      };
    }
    const targetHash = await getStoredPinHash();
    const currentHash = await hashPin(currentPin);
    if (currentHash !== targetHash) {
      return { success: false, error: "Current PIN is incorrect" };
    }
    const newHash = await hashPin(newPin);
    if (typeof window !== "undefined") {
      localStorage.setItem(PIN_STORAGE_KEY, newHash);
    }
    return { success: true };
  };

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      try {
        // Initialize security principal with owner privileges immediately
        setSecurityPrincipal(defaultOwner);
        setUser(defaultOwner);
        setRole("OWNER");

        if (isTauriEnvironment()) {
          await sqliteRepository.migrateLegacyLocalStorage();
          const localOrg = await sqliteRepository.getOrganization(
            organization.id,
          );
          if (localOrg) {
            setOrganization(localOrg);
            const syncedOwner: UserProfile = {
              ...defaultOwner,
              organization_id: localOrg.id,
              full_name: localOrg.owner_name || defaultOwner.full_name,
            };
            setUser(syncedOwner);
            setSecurityPrincipal(syncedOwner);
          }
        }

        if (typeof navigator === "undefined" || navigator.onLine) {
          syncEngine.syncNow().catch(() => {});
        }

        // Silent background check for cloud Supabase session (used for syncEngine)
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseClient();
          if (supabase) {
            supabase.auth.getSession().catch((sbErr) => {
              console.warn("Background Supabase session check:", sbErr);
            });
          }
        }
      } catch (err: any) {
        console.warn("Auth initialization warning:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, [isSupabaseReady, organization.id]);

  const signIn = async (
    _email: string,
    _pass: string,
  ): Promise<{ error?: string }> => {
    setUser(defaultOwner);
    setRole("OWNER");
    setSecurityPrincipal(defaultOwner);
    setIsLocked(false);
    return {};
  };

  const signUp = async (
    _email: string,
    _pass: string,
    _fullName: string,
    _orgName: string,
  ): Promise<{ error?: string }> => {
    setUser(defaultOwner);
    setRole("OWNER");
    setSecurityPrincipal(defaultOwner);
    setIsLocked(false);
    return {};
  };

  const signOut = async () => {
    // Single-operator model: "Exit Session" acts as a counter lock
    lock();
  };

  const updateOrganization = (orgData: Partial<Organization>) => {
    const updated: Organization = {
      ...organization,
      ...orgData,
      updated_at: new Date().toISOString(),
    };
    if (isTauriEnvironment()) void sqliteRepository.updateOrganization(updated);
    else StorageEngine.updateOrganization(updated);
    setOrganization(updated);

    const updatedOwner: UserProfile = {
      ...defaultOwner,
      organization_id: updated.id,
      full_name: updated.owner_name || defaultOwner.full_name,
      email: updated.email || defaultOwner.email,
    };
    setUser(updatedOwner);
    setSecurityPrincipal(updatedOwner);
  };

  const completeOnboarding = (orgData: Partial<Organization>) => {
    const updated: Organization = {
      ...organization,
      ...orgData,
      updated_at: new Date().toISOString(),
    };
    updateOrganization(updated);
    setOnboardingCompleted(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("yaqoob_onboarding_done", "true");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        role,
        isSupabaseReady,
        isLoading,
        isLocked,
        unlock,
        lock,
        updatePin,
        onboardingCompleted,
        signIn,
        signUp,
        signOut,
        updateOrganization,
        completeOnboarding,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
*/
