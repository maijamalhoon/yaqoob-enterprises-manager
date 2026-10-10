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
  isPasswordRecovery: boolean;
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
  changePassword: (
    currentPassword: string,
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
  ) => Promise<{ error?: string; emailConfirmationRequired?: boolean; rateLimitExceeded?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string; authUrl?: string; pendingPopup?: boolean }>;
  sendPasswordReset: (email: string) => Promise<{ error?: string; message?: string }>;
  completePasswordReset: (newPassword: string) => Promise<{ error?: string }>;
  cancelPasswordReset: () => void;
  resetConnectionAndSession: () => Promise<void>;
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const isSupabaseReady = isSupabaseConfigured();

  useEffect(() => {
    let cancelled = false;

    // Check if URL contains password recovery hash or parameter
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("type=recovery") ||
        search.includes("type=recovery") ||
        hash.includes("type=invite")
      ) {
        setIsPasswordRecovery(true);
      }
    }

    async function initialize() {
      setIsLoading(true);
      setSecurityPrincipal(null);
      try {
        await sqliteRepository.migrateLegacyLocalStorage();

        const isExplicitlySignedOut =
          typeof window !== "undefined" &&
          localStorage.getItem("yaqoob_signed_out") === "true";

        const activeProfileId =
          typeof window !== "undefined" ?
            localStorage.getItem(ACTIVE_PROFILE_KEY) || undefined
          : undefined;

        // If user explicitly signed out and didn't select an active profile, don't auto-login first account
        const account =
          isExplicitlySignedOut && !activeProfileId ?
            null
          : await sqliteRepository.getLocalAuthAccount(activeProfileId);

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
            setHasPasswordAccount(Boolean(profile.password_hash));
            if (localOrg && !account.pin_hash) {
              activate(profile, localOrg);
            } else {
              setUser(profile);
              setRole(profile.role);
              setIsLocked(Boolean(account.pin_hash));
            }
          }
        }

        if (account && (typeof navigator === "undefined" || navigator.onLine))
          syncEngine.syncNow().catch(() => {});

        if (isSupabaseConfigured()) {
          const sessionResult = await getSupabaseClient().auth.getSession();
          if (!cancelled && sessionResult.data.session?.user.id) {
            if (typeof window !== "undefined") {
              localStorage.removeItem("yaqoob_signed_out");
            }
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
          if (event === "PASSWORD_RECOVERY") {
            setIsPasswordRecovery(true);
            return;
          }
          if (
            !cancelled &&
            session?.user?.id &&
            (event === "SIGNED_IN" || event === "USER_UPDATED")
          ) {
            if (typeof window !== "undefined") {
              localStorage.removeItem("yaqoob_signed_out");
            }
            await activateSupabaseSession(session.user.id);
          }
        },
      );
      authSubscription = data.subscription;
    }

    // Cross-window communication listener for Google OAuth popup
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        if (isSupabaseConfigured()) {
          try {
            if (event.data.accessToken && event.data.refreshToken) {
              const { data } = await getSupabaseClient().auth.setSession({
                access_token: event.data.accessToken,
                refresh_token: event.data.refreshToken,
              });
              if (data?.session?.user?.id) {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("yaqoob_signed_out");
                }
                await activateSupabaseSession(data.session.user.id);
                return;
              }
            }

            const sessionResult = await getSupabaseClient().auth.getSession();
            if (!cancelled && sessionResult.data.session?.user.id) {
              if (typeof window !== "undefined") {
                localStorage.removeItem("yaqoob_signed_out");
              }
              await activateSupabaseSession(sessionResult.data.session.user.id);
            }
          } catch (e) {
            console.warn("OAuth session handling warning:", e);
          }
        }
      } else if (event.data?.type === "OAUTH_AUTH_ERROR") {
        const desc = event.data.errorDescription || "";
        const code = event.data.errorCode || event.data.error || "";
        if (
          code === "403" ||
          code === "access_denied" ||
          desc.toLowerCase().includes("access_denied")
        ) {
          setError(
            "Google Sign-In Access Denied (403): Your OAuth consent screen in Google Cloud Console is in 'Testing' mode. Please add your email (jamalarain186@gmail.com) under 'Test Users' in Google Cloud Console -> APIs & Services -> OAuth consent screen, or publish the application to Production.",
          );
        } else if (
          desc.toLowerCase().includes("redirect_uri_mismatch") ||
          code === "redirect_uri_mismatch"
        ) {
          setError(
            "Google Sign-In configuration mismatch: The current application redirect URI is not listed under Authorized Redirect URIs in your Google Cloud Console OAuth Client credentials.",
          );
        } else {
          setError(desc || "Google authentication was cancelled or encountered an error.");
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("message", handleAuthMessage);
    }

    return () => {
      cancelled = true;
      authSubscription?.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("message", handleAuthMessage);
      }
    };
  }, [isSupabaseReady]);

  const activate = (profile: UserProfile, org: Organization) => {
    setOrganization(org);
    setUser(profile);
    setRole(profile.role);
    setSecurityPrincipal(profile);
    setIsLocked(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
      localStorage.removeItem("yaqoob_signed_out");
    }
  };

  const activateSupabaseSession = async (
    profileId: string,
  ): Promise<boolean> => {
    const client = getSupabaseClient();

    // 1. Verify user exists in Supabase auth.users (critical if user accounts were deleted in Supabase)
    let authUser: any = null;
    try {
      const { data: authUserData, error: userError } = await client.auth.getUser();
      if (userError || !authUserData?.user) {
        console.warn(
          "Supabase auth user does not exist or was deleted:",
          userError?.message,
        );
        try {
          await client.auth.signOut({ scope: "local" });
        } catch {}
        if (typeof window !== "undefined") {
          localStorage.removeItem(ACTIVE_PROFILE_KEY);
          localStorage.removeItem("yaqoob_signed_out");
        }
        setUser(null);
        setRole(null);
        setIsLocked(true);
        setError(
          "Your previous cloud session expired or user accounts were reset in Supabase. Please sign in or create a new account.",
        );
        return false;
      }
      authUser = authUserData.user;
    } catch (e) {
      console.warn("Could not verify auth user in Supabase:", e);
      return false;
    }

    let profileData: any = null;
    try {
      const response = await client
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .maybeSingle();
      profileData = response.data;
    } catch (err) {
      console.warn("Could not query profiles table:", err);
    }

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
        console.warn("Auto-provision Supabase profile RPC note:", e);
      }
    }

    // Pull metadata (Google name + avatar) from auth.users if available
    try {
      const meta = authUser?.user_metadata || {};
      const googleAvatar = meta.avatar_url || meta.picture;
      const googleName = meta.full_name || meta.name;
      let needUpdate = false;
      const updates: any = {};
      if (profileData) {
        if (googleAvatar && !profileData.avatar_url) {
          updates.avatar_url = googleAvatar;
          profileData.avatar_url = googleAvatar;
          needUpdate = true;
        }
        if (
          googleName &&
          (!profileData.full_name || profileData.full_name === profileData.email)
        ) {
          updates.full_name = googleName;
          profileData.full_name = googleName;
          needUpdate = true;
        }
        if (needUpdate) {
          try {
            await client.from("profiles").update(updates).eq("id", profileId);
            await sqliteRepository.updateProfile({ id: profileId, ...updates });
          } catch {}
        }
      }
    } catch (metaErr) {
      console.warn("Could not sync user metadata:", metaErr);
    }

    let organizationData: Organization | null = null;
    if (profileData?.organization_id) {
      try {
        const { data: orgData } = await client
          .from("organizations")
          .select("*")
          .eq("id", profileData.organization_id)
          .maybeSingle();
        organizationData = orgData as Organization;
      } catch (orgErr) {
        console.warn("Could not query organization:", orgErr);
      }
    }

    // Fallback: If organization was not fetched directly via Supabase query, construct safe defaults
    if (!organizationData) {
      const meta = authUser?.user_metadata || {};
      const shopName =
        meta.shop_name ||
        meta.organization_name ||
        (profileData?.full_name ? `${profileData.full_name}'s Shop` : "Shop Pro");
      const ownerName =
        profileData?.full_name ||
        meta.full_name ||
        meta.name ||
        authUser?.email?.split("@")[0] ||
        "Owner";

      organizationData = {
        ...EMPTY_ORGANIZATION,
        id: profileData?.organization_id || crypto.randomUUID(),
        name: shopName,
        owner_name: ownerName,
        email: profileData?.email || authUser?.email,
        created_at: new Date().toISOString(),
      };
    }

    if (!profileData) {
      profileData = {
        id: profileId,
        email: authUser?.email || "",
        full_name: organizationData.owner_name,
        role: "OWNER",
        organization_id: organizationData.id,
        is_active: true,
        created_at: new Date().toISOString(),
      };
    }

    // Cache to local SQLite so offline queries, transactions, and POS checkout always work
    try {
      const existingOrg = await sqliteRepository.getOrganization(organizationData.id);
      if (!existingOrg) {
        await sqliteRepository.createLocalOwnerAccount(
          organizationData,
          profileData as UserProfile,
        );
      }
      StorageEngine.ensureOrganizationDefaults(organizationData.id);

      const localAcc = await sqliteRepository.getLocalAuthAccount(profileData.id);
      await sqliteRepository.upsertLocalAuthAccount(
        organizationData.id,
        profileData.id,
        localAcc?.pin_hash || "",
        localAcc?.pin_salt || "",
      );

      const refreshedAcc = await sqliteRepository.getLocalAuthAccount(profileData.id);
      setLocalAccount(refreshedAcc);
      setHasLocalAccount(Boolean(refreshedAcc));
      setHasPinSetup(Boolean(refreshedAcc?.pin_hash));
    } catch (e) {
      console.warn("Could not sync local organization cache:", e);
    }

    activate(profileData as UserProfile, organizationData);
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
    if (!hasPinSetup) return;
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

  const setupPin = async (
    newPin: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const pin = newPin.trim();
    if (pin.length < MIN_PIN_LENGTH) {
      return { success: false, error: "PIN must be at least 4 digits." };
    }
    const currentProfileId =
      user?.id ||
      (typeof window !== "undefined" ?
        localStorage.getItem(ACTIVE_PROFILE_KEY) || undefined
      : undefined);
    const targetOrgId =
      organization.id ||
      (await sqliteRepository.getLocalAuthAccount(currentProfileId))
        ?.organization_id;
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
      const refreshed =
        await sqliteRepository.getLocalAuthAccount(currentProfileId);
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
      return {
        success: false,
        error: "Password must be at least 8 characters.",
      };
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
      return {
        success: false,
        error: err?.message || "Could not update password.",
      };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Sign in to change your password." };
    if (!currentPassword) {
      return { success: false, error: "Enter your current password." };
    }

    try {
      if (isSupabaseReady) {
        if (!user.email) {
          return { success: false, error: "This account has no email address." };
        }
        const { data, error: signInError } =
          await getSupabaseClient().auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
          });
        if (signInError || data.user?.id !== user.id) {
          return { success: false, error: "Current password is incorrect." };
        }
      } else {
        const profile = await sqliteRepository.getSessionProfile(user.id);
        if (
          !profile?.password_hash ||
          !(await verifyPassword(currentPassword, profile.password_hash))
        ) {
          return { success: false, error: "Current password is incorrect." };
        }
      }

      return updatePassword(newPassword);
    } catch (err) {
      return {
        success: false,
        error: getErrorMessage(err, "Could not verify your current password."),
      };
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
      return {
        success: false,
        error: err?.message || "Could not update profile photo.",
      };
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

  const signIn = async (
    email: string,
    pass: string,
  ): Promise<{ error?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !pass)
      return { error: "Please enter your email and password." };

    if (isSupabaseReady) {
      try {
        const response = await getSupabaseClient().auth.signInWithPassword({
          email: normalizedEmail,
          password: pass,
        });

        if (response.error) {
          const msg = response.error.message.toLowerCase();
          if (
            msg.includes("failed to fetch") ||
            msg.includes("network") ||
            msg.includes("timeout")
          ) {
            console.warn("Supabase unreachable during signIn, trying offline account...");
          } else if (
            msg.includes("invalid login credentials") ||
            msg.includes("invalid grant")
          ) {
            return {
              error: "Invalid email or password. Please verify your credentials.",
            };
          } else if (msg.includes("email not confirmed")) {
            return {
              error:
                "Your email has not been confirmed yet. Please check your inbox for the confirmation email.",
            };
          } else if (
            msg.includes("too many requests") ||
            msg.includes("rate limit")
          ) {
            return {
              error:
                "Too many sign-in attempts. Please wait a moment before trying again.",
            };
          } else {
            return { error: response.error.message };
          }
        } else if (response.data.user) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("yaqoob_signed_out");
          }
          const activated = await activateSupabaseSession(
            response.data.user.id,
          );
          if (activated) return {};
          return {
            error:
              "Authentication succeeded, but failed to load workspace. Please refresh.",
          };
        }
      } catch (networkErr: any) {
        console.warn("Supabase network error during signIn:", networkErr);
      }
    }

    // Offline / Local SQLite account fallback
    let profile =
      await sqliteRepository.findLocalProfileByEmail(normalizedEmail);
    if (!profile) {
      const storageProfile =
        StorageEngine.findLocalProfileByEmail(normalizedEmail);
      if (storageProfile && storageProfile.password_hash) {
        profile = storageProfile;
      }
    }
    let account =
      profile ? await sqliteRepository.getLocalAuthAccount(profile.id) : null;
    if (
      !profile ||
      !profile.password_hash ||
      !(await verifyPassword(pass, profile.password_hash))
    ) {
      return {
        error: "Invalid email or password. Please try again.",
      };
    }
    if (!account && profile) {
      try {
        await sqliteRepository.upsertLocalAuthAccount(
          profile.organization_id,
          profile.id,
          "",
          "",
        );
        account = await sqliteRepository.getLocalAuthAccount(profile.id);
      } catch {}
    }
    const org =
      (await sqliteRepository.getOrganization(profile.organization_id)) ||
      StorageEngine.getOrganization(profile.organization_id);
    if (!org || !profile.is_active)
      return { error: "This account is no longer active." };

    if (typeof window !== "undefined") {
      localStorage.removeItem("yaqoob_signed_out");
    }
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
  ): Promise<{ error?: string; emailConfirmationRequired?: boolean; rateLimitExceeded?: boolean }> => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanOrg = orgName.trim();

    if (!normalizedEmail || !pass || !cleanName || !cleanOrg)
      return { error: "Please complete all required fields." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { error: "Please enter a valid email address." };
    }
    if (pass.length < 8)
      return { error: "Password must be at least 8 characters long." };

    if (isSupabaseReady) {
      try {
        const response = await getSupabaseClient().auth.signUp({
          email: normalizedEmail,
          password: pass,
          options: {
            data: {
              full_name: cleanName,
              shop_name: cleanOrg,
              organization_name: cleanOrg,
            },
          },
        });

        if (response.error) {
          const msg = response.error.message.toLowerCase();
          if (msg.includes("already") || msg.includes("exists")) {
            return {
              error: "An account with this email already exists. Please sign in instead.",
            };
          }
          if (
            msg.includes("rate limit") ||
            response.error.status === 429 ||
            (response.error as any).code === "over_email_send_rate_limit"
          ) {
            return {
              error:
                "Supabase email confirmation rate limit reached (free tier limit of 3 emails/hour). You can use 'Continue with Google' to sign in instantly, or create an offline local account below.",
              rateLimitExceeded: true,
            };
          }
          return {
            error: response.error.message || "Could not create your account.",
          };
        }

        // Supabase returns an empty identities list when email already exists to prevent enumeration
        if (
          response.data.user?.identities &&
          response.data.user.identities.length === 0
        ) {
          return {
            error: "An account with this email already exists. Please sign in instead.",
          };
        }

        if (typeof window !== "undefined") {
          localStorage.removeItem("yaqoob_signed_out");
        }

        // If email confirmation is enabled on the Supabase project
        if (response.data.user && !response.data.session) {
          return {
            emailConfirmationRequired: true,
          };
        }

        // If user is auto-confirmed or session is immediately available
        if (response.data.session && response.data.user) {
          await activateSupabaseSession(response.data.user.id);
          setHasPinSetup(false);
          return {};
        }
      } catch (networkErr: any) {
        console.warn("Supabase network error during signUp:", networkErr);
      }
    }

    // Offline / Local SQLite account fallback
    const existingSqliteProfile =
      await sqliteRepository.findLocalProfileByEmail(normalizedEmail);
    const existingStorageProfile =
      StorageEngine.findLocalProfileByEmail(normalizedEmail);
    if (
      existingSqliteProfile ||
      (existingStorageProfile && existingStorageProfile.id !== "usr-owner-1")
    ) {
      return {
        error: "An account with this email already exists. Please sign in instead.",
      };
    }

    const now = new Date().toISOString();
    const org: Organization = {
      ...EMPTY_ORGANIZATION,
      id: crypto.randomUUID(),
      name: cleanOrg,
      owner_name: cleanName,
      email: normalizedEmail,
      created_at: now,
      updated_at: now,
    };
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      full_name: cleanName,
      role: "OWNER",
      organization_id: org.id,
      is_active: true,
      password_hash: await hashPassword(pass),
      created_at: now,
    };

    try {
      await sqliteRepository.createLocalAuthAccount(org, profile, "", "", true);
      StorageEngine.createLocalOwnerAccount(org, profile);
      const account = await sqliteRepository.getLocalAuthAccount(profile.id);
      if (typeof window !== "undefined") {
        localStorage.removeItem("yaqoob_signed_out");
      }
      setLocalAccount(account);
      setHasLocalAccount(true);
      setHasPasswordAccount(true);
      setHasPinSetup(false);
      setOnboardingCompleted(true);
      activate(profile, org);
      return {};
    } catch (creationError: any) {
      console.error("Local account creation error:", creationError);
      return {
        error:
          creationError?.message ||
          "Could not create the local account. Please try again.",
      };
    }
  };

  const signInWithGoogle = async (): Promise<{
    error?: string;
    authUrl?: string;
    pendingPopup?: boolean;
  }> => {
    if (!isSupabaseReady) {
      return {
        error:
          "Google sign-in requires an active Supabase cloud connection. Please configure Supabase or sign in with email and password.",
      };
    }

    const redirectUrl =
      typeof window !== "undefined" ?
        `${window.location.origin}${window.location.pathname}`
      : "";
    const isInIframe =
      typeof window !== "undefined" && window.self !== window.top;

    try {
      const response = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isInIframe,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (response.error) {
        const msg = response.error.message.toLowerCase();
        if (
          msg.includes("provider is not enabled") ||
          msg.includes("unsupported provider")
        ) {
          return {
            error:
              "Google provider is not enabled in your Supabase project. Please enable Google in Supabase Dashboard -> Authentication -> Providers.",
          };
        }
        return {
          error: response.error.message || "Failed to initiate Google sign-in.",
        };
      }

      if (isInIframe && response.data?.url) {
        const popup = window.open(
          response.data.url,
          "google_oauth_popup",
          "width=520,height=650,left=200,top=100,menubar=no,toolbar=no,location=no,status=no",
        );
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          return {
            error:
              "Popup was blocked by your browser. Please allow popups or use the direct link below.",
            authUrl: response.data.url,
          };
        }
        return { pendingPopup: true, authUrl: response.data.url };
      }

      if (response.data?.url && !isInIframe) {
        if (typeof window !== "undefined") {
          window.location.assign(response.data.url);
        }
        return { authUrl: response.data.url };
      }

      return {};
    } catch (err: any) {
      return {
        error: err?.message || "Google sign-in could not be initiated.",
      };
    }
  };

  const resetConnectionAndSession = async () => {
    try {
      if (isSupabaseReady) {
        await getSupabaseClient()
          .auth.signOut({ scope: "local" })
          .catch(() => {});
      }
    } catch {}
    if (typeof window !== "undefined") {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.href = window.location.pathname;
    }
  };

  const sendPasswordReset = async (
    email: string,
  ): Promise<{ error?: string; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { error: "Please enter your email address first." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { error: "Please enter a valid email address." };
    }
    if (!isSupabaseReady)
      return {
        error: "Password reset requires an active Supabase cloud connection.",
      };

    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    const response = await getSupabaseClient().auth.resetPasswordForEmail(
      cleanEmail,
      { redirectTo: redirectUrl },
    );

    if (response.error) {
      return {
        error: response.error.message || "Could not send password reset email.",
      };
    }
    return {
      message: `Password reset instructions have been sent to ${cleanEmail}. Please check your inbox.`,
    };
  };

  const completePasswordReset = async (
    newPassword: string,
  ): Promise<{ error?: string }> => {
    const cleanPass = newPassword.trim();
    if (cleanPass.length < 8) {
      return { error: "Password must be at least 8 characters long." };
    }
    try {
      const { error: supaErr } = await getSupabaseClient().auth.updateUser({
        password: cleanPass,
      });
      if (supaErr) {
        return { error: supaErr.message };
      }
      setIsPasswordRecovery(false);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
      return {};
    } catch (e: any) {
      return {
        error: e?.message || "Failed to update password. Please try again.",
      };
    }
  };

  const cancelPasswordReset = () => {
    setIsPasswordRecovery(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const signOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("yaqoob_signed_out", "true");
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
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
        isPasswordRecovery,
        unlock,
        lock,
        setupPin,
        updatePin,
        updatePassword,
        changePassword,
        updateProfilePhoto,
        createAccount,
        onboardingCompleted,
        signIn,
        signUp,
        signInWithGoogle,
        sendPasswordReset,
        completePasswordReset,
        cancelPasswordReset,
        resetConnectionAndSession,
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
