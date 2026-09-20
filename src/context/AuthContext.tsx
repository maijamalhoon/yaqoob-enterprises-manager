import React, { createContext, useContext, useEffect, useState } from "react";
import { Organization, UserProfile } from "../types";
import { DEFAULT_ORGANIZATION } from "../lib/mockData";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase";
import { StorageEngine } from "../services/storageEngine";
import { isTauriEnvironment } from "../services/sqliteEngine";
import { sqliteRepository } from "../services/sqliteRepository";
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
      return { success: false, error: "New PIN must be at least 4 digits/characters" };
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
          const localOrg = await sqliteRepository.getOrganization(organization.id);
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
