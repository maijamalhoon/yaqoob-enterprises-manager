import React, { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UserAvatar } from "../common/UserAvatar";

const fieldClass =
  "w-full h-11 rounded-lg border border-border-standard bg-white px-3.5 text-sm outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

/**
 * Single Unified Auth Screen (Slack / Notion / Linear style)
 * Clean Email/Password with Sign In <-> Sign Up toggle, plus Continue with Google.
 * Zero technical/backend jargon.
 */
export const AuthScreen: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    shopName: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    // Detect OAuth errors passed back in URL hash or query params
    const hash = window.location.hash;
    const search = window.location.search;
    const rawParams =
      hash.startsWith("#") ? hash.slice(1)
      : search.startsWith("?") ? search.slice(1)
      : "";
    if (rawParams) {
      const params = new URLSearchParams(rawParams);
      const errorCode = params.get("error_code") || params.get("error");
      const errorDesc = params.get("error_description");

      if (errorCode || errorDesc) {
        if (
          errorCode === "403" ||
          errorCode === "access_denied" ||
          errorDesc?.toLowerCase().includes("access_denied")
        ) {
          setFeedback({
            type: "error",
            text: "Google Sign-In 403 (Access Denied): Google Cloud Console mein OAuth Consent Screen 'Testing' mode mein hai aur aapka email Test Users mein add nahi hai. Please Google Cloud Console mein app ko 'Publish to Production' karein ya Test Users mein apna email add karein.",
          });
        } else {
          setFeedback({
            type: "error",
            text:
              errorDesc ?
                decodeURIComponent(errorDesc.replace(/\+/g, " "))
              : "Authentication error occurred.",
          });
        }
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      if (mode === "signIn") {
        const result = await signIn(form.email, form.password);
        if (result.error) {
          setFeedback({ type: "error", text: result.error });
        }
      } else {
        if (!form.fullName.trim()) {
          setFeedback({ type: "error", text: "Please enter your name." });
          setIsSubmitting(false);
          return;
        }
        if (!form.shopName.trim()) {
          setFeedback({
            type: "error",
            text: "Please enter your business or shop name.",
          });
          setIsSubmitting(false);
          return;
        }
        if (form.password.length < 8) {
          setFeedback({
            type: "error",
            text: "Password must be at least 8 characters.",
          });
          setIsSubmitting(false);
          return;
        }
        const result = await signUp(
          form.email,
          form.password,
          form.fullName,
          form.shopName,
        );
        if (result.error) {
          setFeedback({ type: "error", text: result.error });
        }
      }
    } catch {
      setFeedback({
        type: "error",
        text: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setFeedback({ type: "error", text: result.error });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Google sign in could not be initiated.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setFeedback({
        type: "error",
        text: "Please enter your email address above first.",
      });
      return;
    }
    setIsResetting(true);
    setFeedback(null);
    try {
      const result = await sendPasswordReset(form.email);
      setFeedback({
        type:
          result.error?.includes("check your email") || !result.error ?
            "success"
          : "error",
        text:
          result.error ||
          "Password reset instructions have been sent to your email.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-surface p-4 font-sans text-on-surface">
      <main className="w-full max-w-[400px] rounded-xl border border-border-standard bg-white p-6 shadow-level-2 sm:p-8">
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/assets/logo.svg"
            alt=""
            className="mb-2 h-10 w-10 rounded-lg"
          />
          <p className="mb-3 text-xs font-semibold text-secondary">Shop Pro</p>
          <h1 className="text-xl font-bold text-on-surface">
            {mode === "signIn" ?
              "Welcome back"
            : "Get started with your register"}
          </h1>
          <p className="mt-1 max-w-[280px] text-xs text-text-muted">
            {mode === "signIn" ?
              "Sign in to open your shop ledger"
            : "Create an account for your shop to begin"}
          </p>
        </div>

        {/* Google Single Sign-On Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border-standard bg-white text-sm font-medium text-on-surface shadow-xs transition hover:border-outline-variant hover:bg-surface-container-low disabled:opacity-60"
        >
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Clean Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e6e8ec]" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase text-text-muted">
            <span className="bg-white px-2.5">or</span>
          </div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signUp" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-secondary">
                  Owner Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="Enter owner name"
                  className={fieldClass}
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-secondary">
                  Shop Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="Enter shop name"
                  className={fieldClass}
                  value={form.shopName}
                  onChange={(e) => update("shopName", e.target.value)}
                  autoComplete="organization"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-secondary">
              Email Address
            </label>
            <input
              required
              type="email"
              placeholder="you@example.com"
              className={fieldClass}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-semibold text-secondary">
                Password
              </label>
              {mode === "signIn" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                  className="text-xs font-medium text-primary hover:text-primary-hover hover:underline cursor-pointer"
                >
                  {isResetting ? "Sending..." : "Forgot password?"}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                placeholder={
                  mode === "signUp" ? "At least 8 characters" : "••••••••"
                }
                className={`${fieldClass} pr-10`}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                autoComplete={
                  mode === "signIn" ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-3 text-[#98a2b3] hover:text-[#555f73] transition cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ?
                  <EyeOff className="h-4.5 w-4.5" />
                : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs leading-relaxed ${
                feedback.type === "error" ?
                  "bg-red-50 border border-red-200 text-[#b91c1c]"
                : "bg-emerald-50 border border-emerald-200 text-[#047857]"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <span>
              {isSubmitting ?
                "Please wait..."
              : mode === "signIn" ?
                "Sign In"
              : "Create Account"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-6 pt-5 border-t border-[#e6e8ec] text-center text-xs text-[#667085]">
          {mode === "signIn" ?
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signUp");
                  setFeedback(null);
                }}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </p>
          : <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signIn");
                  setFeedback(null);
                }}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          }
        </div>
      </main>
    </div>
  );
};

/**
 * 4-Digit PIN Setup Screen
 * Shown right after account creation or initial Google sign-in.
 * Establishes the quick-unlock PIN used for the register lock screen.
 */
export const PinSetupScreen: React.FC = () => {
  const { user, organization, setupPin, signOut } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.getElementById("setup-pin-input")?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PIN and confirmation do not match.");
      return;
    }

    setIsSubmitting(true);
    const result = await setupPin(pin);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Failed to set up PIN. Please try again.");
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-surface p-4 font-sans text-on-surface">
      <main className="w-full max-w-[400px] rounded-lg border border-border-standard bg-white p-6 shadow-level-2 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-on-surface">
            Set Your Quick-Unlock PIN
          </h1>
          <p className="mt-1.5 max-w-[300px] text-xs leading-relaxed text-text-muted">
            Set a 4-digit PIN for quick register unlock and screen lock. Staff
            won't need to retype passwords between transactions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="setup-pin-input"
              className="mb-1 block text-xs font-semibold text-secondary"
            >
              Choose 4-Digit PIN
            </label>
            <div className="relative">
              <input
                id="setup-pin-input"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                required
                placeholder="••••"
                className={`${fieldClass} text-center font-mono text-base`}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(val);
                  setError("");
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="setup-confirm-pin"
              className="mb-1 block text-xs font-semibold text-secondary"
            >
              Confirm 4-Digit PIN
            </label>
            <div className="relative">
              <input
                id="setup-confirm-pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                required
                placeholder="••••"
                className={`${fieldClass} text-center font-mono text-base`}
                value={confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setConfirmPin(val);
                  setError("");
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted">
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              {showPin ? "Hide numbers" : "Show numbers"}
            </button>
            <span className="text-[11px] text-text-muted">
              Choose a PIN you can recall
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-[#b91c1c]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              isSubmitting || pin.length !== 4 || confirmPin.length !== 4
            }
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {isSubmitting ? "Setting PIN..." : "Save PIN & Enter Register"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full pt-2 text-center text-xs font-medium text-text-muted hover:text-on-surface hover:underline"
          >
            Cancel and sign out
          </button>
        </form>
      </main>
    </div>
  );
};

/**
 * Quick-Unlock Lock Screen (Used for Register Lock & Session Reopen)
 * Shows current user profile photo, name, business name, and 4-digit PIN input.
 */
export const LockScreen: React.FC = () => {
  const { user, organization, unlock, signOut } = useAuth();
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.getElementById("unlock-pin")?.focus();
  }, []);

  const handleUnlock = async (pinToTry: string) => {
    setError("");
    setIsSubmitting(true);
    const success = await unlock(pinToTry);
    setIsSubmitting(false);

    if (!success) {
      setPin("");
      setError("Incorrect PIN. Please try again.");
      document.getElementById("unlock-pin")?.focus();
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length >= 4) {
      void handleUnlock(pin);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-surface p-4 font-sans text-on-surface">
      <main className="w-full max-w-[380px] rounded-lg border border-border-standard bg-white p-6 shadow-level-2 sm:p-8">
        {/* User Avatar and Identity */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-full ring-4 ring-primary/10">
            <UserAvatar
              src={user?.avatar_url}
              name={user?.full_name || organization.owner_name || "Owner"}
              size="lg"
            />
          </div>
          <h1 className="text-base font-bold text-on-surface">
            {user?.full_name || organization.owner_name || "Register Terminal"}
          </h1>
          <p className="mt-0.5 text-xs font-medium text-text-muted">
            {organization.name || "Shop Pro"}
          </p>
        </div>

        {/* PIN Input Form */}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label
              htmlFor="unlock-pin"
              className="mb-1.5 block text-center text-xs font-semibold text-secondary"
            >
              Enter 4-Digit Quick-Unlock PIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-5 w-5 text-[#98a2b3]" />
              <input
                id="unlock-pin"
                className={`${fieldClass} px-10 text-center font-mono text-base`}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                autoComplete="current-password"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(val);
                  setError("");
                  if (val.length === 4) {
                    void handleUnlock(val);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-3.5 top-3 text-[#98a2b3] hover:text-[#555f73] transition cursor-pointer"
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ?
                  <EyeOff className="h-5 w-5" />
                : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-[#b91c1c] text-center"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            <span>{isSubmitting ? "Unlocking..." : "Unlock Register"}</span>
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full pt-2 text-center text-xs font-medium text-text-muted hover:text-on-surface hover:underline"
          >
            Switch account
          </button>
        </form>
      </main>
    </div>
  );
};

// Re-export SignUpScreen as an alias for AuthScreen for backwards compatibility
export const SignUpScreen = AuthScreen;
