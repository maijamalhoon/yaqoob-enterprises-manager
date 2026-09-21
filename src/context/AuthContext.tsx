import React, { createContext, useContext, useEffect, useState } from "react";
import { Organization, UserProfile } from "../types";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import { sqliteRepository } from "../services/sqliteRepository";
import { StorageEngine } from "../services/storageEngine";
import { syncEngine } from "../services/syncEngine";
import { setSecurityPrincipal } from "../lib/security";

const MIN_PIN_LENGTH = 4;
const ACTIVE_PROFILE_KEY = "yaqoob_active_profile";

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

async function hashPassword(
  password: string,
  salt = encodeBytes(crypto.getRandomValues(new Uint8Array(16))),
): Promise<string> {
  return `${salt}:${await derivePin(password, decodeBytes(salt))}`;
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  return (
    Boolean(salt && expected) &&
    (await derivePin(password, decodeBytes(salt))) === expected
  );
}

interface AuthContextType {
  user: UserProfile | null;
  organization: Organization;
  role: UserProfile["role"] | null;
  isSupabaseReady: boolean;
  isLoading: boolean;
  isLocked: boolean;
  hasLocalAccount: boolean;
  hasPasswordAccount: boolean;
  hasPinSetup: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  setupPin: (newPin: string) => Promise<{ success: boolean; error?: string }>;
  updatePin: (
    currentPin: string,
    newPin: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateProfilePhoto: (
    avatarUrl: string,
  ) => Promise<{ success: boolean; error?: string }>;
  createAccount: (details: {
    shopName: string;
    ownerName: string;
    email: string;
    pin: string;
    confirmPin: string;
    password?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onboardingCompleted: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    orgName: string,
  ) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
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
  const [hasPasswordAccount, setHasPasswordAccount] = useState(false);
  const [hasPinSetup, setHasPinSetup] = useState(false);
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
        const activeProfileId =
          typeof window !== "undefined" ?
            localStorage.getItem(ACTIVE_PROFILE_KEY) || undefined
          : undefined;
        const account =
          await sqliteRepository.getLocalAuthAccount(activeProfileId);
        if (cancelled) return;
        setLocalAccount(account);
        setHasLocalAccount(Boolean(account));
        setHasPinSetup(Boolean(account?.pin_hash));
        if (account) {
          const [localOrg, profile] = await Promise.all([
            sqliteRepository.getOrganization(account.organization_id),
            sqliteRepository.getSessionProfile(account.profile_id),
          ]);
          if (localOrg) setOrganization(localOrg);
          if (profile) {
            setUser(profile);
            setRole(profile.role);
            setHasPasswordAccount(Boolean(profile.password_hash));
          }
        }
        if (account && (typeof navigator === "undefined" || navigator.onLine))
          syncEngine.syncNow().catch(() => {});
        if (isSupabaseConfigured()) {
          const sessionResult = await getSupabaseClient().auth.getSession();
          if (!cancelled && sessionResult.data.session?.user.id) {
            await activateSupabaseSession(sessionResult.data.session.user.id);
          }
        }
      } catch (initializationError) {
        console.warn("Auth initialization warning:", initializationError);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void initialize();

    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = getSupabaseClient().auth.onAuthStateChange(
        async (event, session) => {
          if (!cancelled && session?.user?.id && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
            await activateSupabaseSession(session.user.id);
          }
        },
      );
      authSubscription = data.subscription;
    }

    return () => {
      cancelled = true;
      authSubscription?.unsubscribe();
    };
  }, [isSupabaseReady]);

  const activate = (profile: UserProfile, org: Organization) => {
    setOrganization(org);
    setUser(profile);
    setRole(profile.role);
    setSecurityPrincipal(profile);
    setIsLocked(false);
    if (typeof window !== "undefined")
      localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  };

  const activateSupabaseSession = async (
    profileId: string,
  ): Promise<boolean> => {
    const client = getSupabaseClient();
    let { data: profileData } = await client
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (!profileData?.organization_id) {
      try {
        await client.rpc("ensure_my_profile");
        const refreshed = await client
          .from("profiles")
          .select("*")
          .eq("id", profileId)
          .maybeSingle();
        profileData = refreshed.data;
      } catch (e) {
        console.warn("Could not auto-provision Supabase profile:", e);
      }
    }

    if (!profileData?.organization_id) return false;

    // Pull metadata (Google name + avatar) from auth.users if available
    try {
      const { data: authUserData } = await client.auth.getUser();
      const meta = authUserData?.user?.user_metadata || {};
      const googleAvatar = meta.avatar_url || meta.picture;
      const googleName = meta.full_name || meta.name;
      let needUpdate = false;
      const updates: any = {};
      if (googleAvatar && !profileData.avatar_url) {
        updates.avatar_url = googleAvatar;
        profileData.avatar_url = googleAvatar;
        needUpdate = true;
      }
      if (googleName && (!profileData.full_name || profileData.full_name === profileData.email)) {
        updates.full_name = googleName;
        profileData.full_name = googleName;
        needUpdate = true;
      }
      if (needUpdate) {
        await client.from("profiles").update(updates).eq("id", profileId);
        await sqliteRepository.updateProfile({ id: profileId, ...updates });
      }
    } catch (metaErr) {
      console.warn("Could not sync user metadata:", metaErr);
    }

    const { data: organizationData } = await client
      .from("organizations")
      .select("*")
      .eq("id", profileData.organization_id)
      .maybeSingle();
    if (!organizationData) return false;

    // Cache to local SQLite so offline queries and POS operations always work
    try {
      const existingOrg = await sqliteRepository.getOrganization(organizationData.id);
      if (!existingOrg) {
        await sqliteRepository.createLocalOwnerAccount(
          organizationData as Organization,
          profileData as UserProfile,
        );
      }
      StorageEngine.ensureOrganizationDefaults(organizationData.id);
    } catch (e) {
      console.warn("Could not sync local organization cache:", e);
    }

    const localAcc = await sqliteRepository.getLocalAuthAccount(profileData.id);
    setLocalAccount(localAcc);
    setHasLocalAccount(Boolean(localAcc));
    setHasPinSetup(Boolean(localAcc?.pin_hash));

    activate(profileData as UserProfile, organizationData as Organization);
    setHasPasswordAccount(true);
    return true;
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
    password?: string;
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
      ...(details.password ?
        { password_hash: await hashPassword(details.password) }
      : {}),
    };
    const credential = await hashPin(details.pin);
    try {
      await sqliteRepository.createLocalAuthAccount(
        org,
        profile,
        credential.hash,
        credential.salt,
        true,
      );
      StorageEngine.createLocalOwnerAccount(org, profile);
      const account = await sqliteRepository.getLocalAuthAccount();
      setLocalAccount(account);
      setHasLocalAccount(true);
      setHasPasswordAccount(Boolean(details.password));
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

  const setupPin = async (newPin: string): Promise<{ success: boolean; error?: string }> => {
    const pin = newPin.trim();
    if (pin.length < MIN_PIN_LENGTH) {
      return { success: false, error: "PIN must be at least 4 digits." };
    }
    const currentProfileId =
      user?.id ||
      (typeof window !== "undefined"
        ? localStorage.getItem(ACTIVE_PROFILE_KEY) || undefined
        : undefined);
    const targetOrgId =
      organization.id ||
      (await sqliteRepository.getLocalAuthAccount(currentProfileId))?.organization_id;
    if (!currentProfileId || !targetOrgId) {
      return { success: false, error: "Active account session required." };
    }

    try {
      const credential = await hashPin(pin);
      await sqliteRepository.upsertLocalAuthAccount(
        targetOrgId,
        currentProfileId,
        credential.hash,
        credential.salt,
      );
      const refreshed = await sqliteRepository.getLocalAuthAccount(currentProfileId);
      setLocalAccount(refreshed);
      setHasLocalAccount(true);
      setHasPinSetup(true);
      setIsLocked(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not set PIN." };
    }
  };

  const updatePin = async (currentPin: string, newPin: string) => {
    if (!localAccount) {
      return setupPin(newPin);
    }
    const cleanPin = newPin.trim();
    if (cleanPin.length < MIN_PIN_LENGTH) {
      return {
        success: false,
        error: "New PIN must be at least 4 characters.",
      };
    }
    if (
      !(await unlockCheck(
        currentPin.trim(),
        localAccount.pin_hash,
        localAccount.pin_salt,
      ))
    ) {
      return { success: false, error: "Current PIN is incorrect." };
    }
    const credential = await hashPin(cleanPin);
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
    setHasPinSetup(true);
    return { success: true };
  };

  const updatePassword = async (
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = newPassword.trim();
    if (cleanPass.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }

    try {
      if (isSupabaseReady) {
        const { error: supaErr } = await getSupabaseClient().auth.updateUser({
          password: cleanPass,
        });
        if (supaErr) {
          return { success: false, error: supaErr.message };
        }
      }
      if (user) {
        const newHash = await hashPassword(cleanPass);
        await sqliteRepository.updateProfile({
          id: user.id,
          password_hash: newHash,
        });
        setUser((prev) => (prev ? { ...prev, password_hash: newHash } : null));
        setHasPasswordAccount(true);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not update password." };
    }
  };

  const updateProfilePhoto = async (
    avatarUrl: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "No active user session." };
    try {
      setUser((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : null));

      await sqliteRepository.updateProfile({
        id: user.id,
        avatar_url: avatarUrl,
      });

      if (isSupabaseReady) {
        try {
          await getSupabaseClient()
            .from("profiles")
            .update({ avatar_url: avatarUrl })
            .eq("id", user.id);
        } catch {
          // Non-blocking sync failure handled gracefully
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not update profile photo." };
    }
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

  const signIn = async (email: string, pass: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !pass)
      return { error: "Enter your email and password." };
    if (isSupabaseReady) {
      try {
        const response = await getSupabaseClient().auth.signInWithPassword({
          email: normalizedEmail,
          password: pass,
        });
        if (!response.error && response.data.user) {
          const activated = await activateSupabaseSession(response.data.user.id);
          if (activated) return {};
        }
      } catch (networkErr) {
        console.warn("Supabase network error during signIn:", networkErr);
      }
    }
    // Offline / Local SQLite account fallback
    const profile =
      await sqliteRepository.findLocalProfileByEmail(normalizedEmail);
    const account =
      profile ? await sqliteRepository.getLocalAuthAccount(profile.id) : null;
    if (
      !profile ||
      !account ||
      !profile.password_hash ||
      !(await verifyPassword(pass, profile.password_hash))
    ) {
      return {
        error: "Incorrect email or password. Please try again.",
      };
    }
    const org = await sqliteRepository.getOrganization(profile.organization_id);
    if (!org || !profile.is_active)
      return { error: "This account is no longer active." };
    setLocalAccount(account);
    setHasLocalAccount(true);
    setHasPasswordAccount(true);
    setHasPinSetup(Boolean(account?.pin_hash));
    activate(profile, org);
    return {};
  };

  const signUp = async (
    email: string,
    pass: string,
    fullName: string,
    orgName: string,
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !pass || !fullName.trim() || !orgName.trim())
      return { error: "Complete all required fields." };
    if (pass.length < 8)
      return { error: "Password must be at least 8 characters." };

    if (isSupabaseReady) {
      try {
        const response = await getSupabaseClient().auth.signUp({
          email: normalizedEmail,
          password: pass,
          options: {
            data: {
              full_name: fullName.trim(),
              organization_name: orgName.trim(),
            },
          },
        });
        if (response.error) {
          return {
            error:
              response.error.message.toLowerCase().includes("already") ?
                "An account with this email already exists."
              : response.error.message || "Could not create your account.",
          };
        }
        // Mirror to local SQLite so offline mode works seamlessly
        const now = new Date().toISOString();
        const org: Organization = {
          ...EMPTY_ORGANIZATION,
          id: crypto.randomUUID(),
          name: orgName.trim(),
          owner_name: fullName.trim(),
          email: normalizedEmail,
          created_at: now,
          updated_at: now,
        };
        const profile: UserProfile = {
          id: response.data.user?.id || crypto.randomUUID(),
          email: normalizedEmail,
          full_name: fullName.trim(),
          role: "OWNER",
          organization_id: org.id,
          is_active: true,
          password_hash: await hashPassword(pass),
          created_at: now,
        };

        try {
          await sqliteRepository.createLocalAuthAccount(
            org,
            profile,
            "",
            "",
            true,
          );
          StorageEngine.createLocalOwnerAccount(org, profile);
        } catch {
          // If already exists locally
        }

        if (response.data.session && response.data.user) {
          await activateSupabaseSession(response.data.user.id);
          setHasPinSetup(false);
          return {};
        }

        activate(profile, org);
        setHasPinSetup(false);
        return {};
      } catch (networkErr: any) {
        // Fallback to local account creation on network error
      }
    }

    if (await sqliteRepository.findLocalProfileByEmail(normalizedEmail))
      return { error: "An account with this email already exists." };
    const now = new Date().toISOString();
    const org: Organization = {
      ...EMPTY_ORGANIZATION,
      id: crypto.randomUUID(),
      name: orgName.trim(),
      owner_name: fullName.trim(),
      email: normalizedEmail,
      created_at: now,
      updated_at: now,
    };
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      full_name: fullName.trim(),
      role: "OWNER",
      organization_id: org.id,
      is_active: true,
      password_hash: await hashPassword(pass),
      created_at: now,
    };
    try {
      await sqliteRepository.createLocalAuthAccount(
        org,
        profile,
        "",
        "",
        true,
      );
      StorageEngine.createLocalOwnerAccount(org, profile);
      const account = await sqliteRepository.getLocalAuthAccount(profile.id);
      setLocalAccount(account);
      setHasLocalAccount(true);
      setHasPasswordAccount(true);
      setHasPinSetup(false);
      setOnboardingCompleted(true);
      activate(profile, org);
      return {};
    } catch {
      return { error: "Could not create the account. Please try again." };
    }
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseReady) {
      return { error: "Google sign-in requires network access. Please use email and password." };
    }
    const response = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return response.error ?
        { error: "Google sign-in could not be started." }
      : {};
  };

  const sendPasswordReset = async (email: string) => {
    if (!email.trim()) return { error: "Enter your account email first." };
    if (!isSupabaseReady)
      return {
        error: "Password recovery requires network access.",
      };
    const response = await getSupabaseClient().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: window.location.origin },
    );
    return response.error ?
        { error: "We could not send a reset email. Please try again." }
      : { error: "Check your email for password reset instructions." };
  };

  const signOut = async () => {
    if (isSupabaseReady)
      await getSupabaseClient()
        .auth.signOut()
        .catch(() => {});
    setUser(null);
    setRole(null);
    setLocalAccount(null);
    setHasLocalAccount(false);
    setHasPasswordAccount(false);
    setHasPinSetup(false);
    setOrganization(EMPTY_ORGANIZATION);
    setSecurityPrincipal(null);
    setIsLocked(true);
    if (typeof window !== "undefined")
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
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
        hasLocalAccount,
        hasPasswordAccount,
        hasPinSetup,
        unlock,
        lock,
        setupPin,
        updatePin,
        updatePassword,
        updateProfilePhoto,
        createAccount,
        onboardingCompleted,
        signIn,
        signUp,
        signInWithGoogle,
        sendPasswordReset,
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
