import React, { createContext, useContext, useEffect, useState } from "react";
import { Organization, UserProfile } from "../types";
import { DEFAULT_ORGANIZATION } from "../lib/mockData";
import {
  formatSupabaseError,
  getSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase";
import { StorageEngine } from "../services/storageEngine";
import { isTauriEnvironment } from "../services/sqliteEngine";
import { sqliteRepository } from "../services/sqliteRepository";
import { setSecurityPrincipal } from "../lib/security";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: UserProfile | null;
  organization: Organization;
  role: UserProfile["role"] | null;
  isSupabaseReady: boolean;
  isLoading: boolean;
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

function isUserRole(role: unknown): role is UserProfile["role"] {
  return role === "OWNER" || role === "MANAGER" || role === "CASHIER";
}

function fallbackProfileFromUser(
  user: User,
  organizationId: string,
): UserProfile {
  return {
    id: user.id,
    email: user.email || "user@yaqoob.com",
    full_name: user.email?.split("@")[0] || "Staff Member",
    role: "CASHIER",
    organization_id: organizationId,
    is_active: true,
    created_at: user.created_at,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [organization, setOrganization] = useState<Organization>(() => {
    if (isTauriEnvironment()) return DEFAULT_ORGANIZATION;
    const org = StorageEngine.getOrganization(DEFAULT_ORGANIZATION.id);
    return org || DEFAULT_ORGANIZATION;
  });

  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserProfile["role"] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

  const loadCloudProfile = async (authUser: User): Promise<UserProfile> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Cloud authentication is unavailable");
    }

    let lastError = "Authenticated profile was not found";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,organization_id,is_active,created_at")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError) {
        lastError = profileError.message;
      } else if (data) {
        return {
          id: data.id,
          email: data.email || authUser.email || "user@yaqoob.com",
          full_name: data.full_name || "Staff Member",
          role: isUserRole(data.role) ? data.role : "CASHIER",
          organization_id: data.organization_id || organization.id,
          is_active: data.is_active === true,
          created_at: data.created_at || authUser.created_at,
        };
      }

      if (attempt < 4) {
        await new Promise((resolve) =>
          setTimeout(resolve, 250 * (attempt + 1)),
        );
      }
    }

    throw new Error(lastError);
  };

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseReady) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (session?.user) {
              const profile = await loadCloudProfile(session.user);
              if (!profile.is_active)
                throw new Error("This account is inactive");
              setUser(profile);
              setRole(profile.role);
              setSecurityPrincipal(profile);
            }
          } catch (err: any) {
            console.warn("Supabase auth session lookup error:", err);
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
            setSecurityPrincipal(null);
            setError(err?.message || "Authentication failed");
          }
        } else {
          if (isTauriEnvironment())
            await sqliteRepository.migrateLegacyLocalStorage();
          const sessionId =
            typeof window !== "undefined" ?
              sessionStorage.getItem("yaqoob_auth_session")
            : null;
          const localProfile =
            isTauriEnvironment() ?
              sessionId ? await sqliteRepository.getSessionProfile(sessionId)
              : null
            : StorageEngine.getSessionProfile();
          if (localProfile) {
            if (isTauriEnvironment()) {
              const localOrganization = await sqliteRepository.getOrganization(
                localProfile.organization_id,
              );
              if (!localOrganization)
                throw new Error("Authenticated organization was not found");
              setOrganization(localOrganization);
            }
            setUser(localProfile);
            setRole(localProfile.role);
            setSecurityPrincipal(localProfile);
          }
        }
      } catch (err: any) {
        setUser(null);
        setRole(null);
        setSecurityPrincipal(null);
        setError(err?.message || "Authentication initialization failed");
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, [isSupabaseReady, organization.id]);

  const signIn = async (
    email: string,
    pass: string,
  ): Promise<{ error?: string }> => {
    setError(null);
    setIsLoading(true);
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseReady) {
      try {
        const { data, error: sbError } = await supabase.auth.signInWithPassword(
          {
            email,
            password: pass,
          },
        );
        if (sbError) {
          setIsLoading(false);
          setError(sbError.message);
          return { error: sbError.message };
        }
        if (data.user) {
          const { error: provisioningError } =
            await supabase.rpc("ensure_my_profile");
          if (provisioningError) throw provisioningError;
          const profile = await loadCloudProfile(data.user);
          if (!profile.is_active) throw new Error("This account is inactive");
          setUser(profile);
          setRole(profile.role);
          setSecurityPrincipal(profile);
        }
      } catch (err: any) {
        setIsLoading(false);
        const message = formatSupabaseError(err);
        setError(message);
        return { error: message };
      }
    } else {
      const profile =
        isTauriEnvironment() ?
          await sqliteRepository.findLocalProfileByEmail(email)
        : StorageEngine.findLocalProfileByEmail(email);
      if (!profile || !profile.is_active || !profile.password_hash) {
        const message =
          "Invalid local credentials or no trusted local account exists";
        setIsLoading(false);
        setError(message);
        return { error: message };
      }
      if (!(await StorageEngine.verifyPassword(pass, profile.password_hash))) {
        const message = "Invalid local credentials";
        setIsLoading(false);
        setError(message);
        return { error: message };
      }
      StorageEngine.saveSession(profile.id);
      if (isTauriEnvironment())
        sessionStorage.setItem("yaqoob_auth_session", profile.id);
      setUser(profile);
      setRole(profile.role);
      setSecurityPrincipal(profile);
    }

    setIsLoading(false);
    return {};
  };

  const signUp = async (
    email: string,
    pass: string,
    fullName: string,
    orgName: string,
  ): Promise<{ error?: string }> => {
    setError(null);
    setIsLoading(true);
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseReady) {
      try {
        const { data, error: sbError } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: fullName,
              organization_name: orgName,
            },
          },
        });
        if (sbError) {
          setIsLoading(false);
          setError(sbError.message);
          return { error: sbError.message };
        }
        if (data.user) {
          if (!data.session) {
            const message =
              "Account created. Check your email to confirm the account, then sign in.";
            setIsLoading(false);
            setError(message);
            return { error: message };
          }
          const { error: provisioningError } =
            await supabase.rpc("ensure_my_profile");
          if (provisioningError) throw provisioningError;
          const profile = await loadCloudProfile(data.user);
          if (!profile.is_active) throw new Error("This account is inactive");
          setUser(profile);
          setRole(profile.role);
          setSecurityPrincipal(profile);
        }
      } catch (err: any) {
        setIsLoading(false);
        const message = formatSupabaseError(err);
        setError(message);
        return { error: message };
      }
    } else {
      const newOrg: Organization = {
        ...DEFAULT_ORGANIZATION,
        id: crypto.randomUUID(),
        name: orgName,
        owner_name: fullName,
      };
      const profile: UserProfile = {
        id: crypto.randomUUID(),
        email,
        full_name: fullName,
        role: "OWNER",
        organization_id: newOrg.id,
        is_active: true,
        password_hash: await StorageEngine.hashPassword(pass),
        created_at: new Date().toISOString(),
      };
      if (isTauriEnvironment())
        await sqliteRepository.createLocalOwnerAccount(newOrg, profile);
      else StorageEngine.createLocalOwnerAccount(newOrg, profile);
      setOrganization(newOrg);
      setUser(profile);
      setRole("OWNER");
      StorageEngine.saveSession(profile.id);
      if (isTauriEnvironment())
        sessionStorage.setItem("yaqoob_auth_session", profile.id);
      setSecurityPrincipal(profile);
    }

    setIsLoading(false);
    return {};
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseReady) {
      await supabase.auth.signOut();
    }
    StorageEngine.clearSession();
    if (isTauriEnvironment() && typeof window !== "undefined")
      sessionStorage.removeItem("yaqoob_auth_session");
    setUser(null);
    setRole(null);
    setSecurityPrincipal(null);
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
