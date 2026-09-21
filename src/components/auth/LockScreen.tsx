import React, { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Store,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UserAvatar } from "../common/UserAvatar";

const fieldClass =
  "w-full h-11 rounded-lg border border-[#dfe3e8] bg-white px-3.5 text-sm outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15 transition placeholder:text-[#98a2b3]";

/**
 * Single Unified Auth Screen (Slack / Notion / Linear style)
 * Clean Email/Password with Sign In <-> Sign Up toggle, plus Continue with Google.
 * Zero technical/backend jargon.
 */
export const AuthScreen: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
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
    const rawParams = hash.startsWith("#") ? hash.slice(1) : search.startsWith("?") ? search.slice(1) : "";
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
            text: errorDesc
              ? decodeURIComponent(errorDesc.replace(/\+/g, " "))
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
          setFeedback({ type: "error", text: "Please enter your business or shop name." });
          setIsSubmitting(false);
          return;
        }
        if (form.password.length < 8) {
          setFeedback({ type: "error", text: "Password must be at least 8 characters." });
          setIsSubmitting(false);
          return;
        }
        const result = await signUp(form.email, form.password, form.fullName, form.shopName);
        if (result.error) {
          setFeedback({ type: "error", text: result.error });
        }
      }
    } catch {
      setFeedback({ type: "error", text: "An unexpected error occurred. Please try again." });
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
      setFeedback({ type: "error", text: "Google sign in could not be initiated." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setFeedback({ type: "error", text: "Please enter your email address above first." });
      return;
    }
    setIsResetting(true);
    setFeedback(null);
    try {
      const result = await sendPasswordReset(form.email);
      setFeedback({
        type: result.error?.includes("check your email") || !result.error ? "success" : "error",
        text: result.error || "Password reset instructions have been sent to your email.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#f8f9fb] p-4 font-sans text-[#191c1e] select-none">
      <main className="w-full max-w-[420px] rounded-2xl border border-[#e2e6eb] bg-white p-7 shadow-[0_16px_48px_rgba(25,28,30,0.06)] sm:p-9">
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4f46e5]/10 text-[#4f46e5]">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#191c1e]">
            {mode === "signIn" ? "Welcome back" : "Get started with your register"}
          </h1>
          <p className="mt-1 text-xs text-[#667085] max-w-[280px]">
            {mode === "signIn"
              ? "Sign in to access your sales, inventory, and register"
              : "Create an account for your shop to begin"}
          </p>
        </div>

        {/* Google Single Sign-On Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#dfe3e8] bg-white text-sm font-medium text-[#191c1e] shadow-xs hover:bg-[#f8f9fb] hover:border-[#ccd2d9] transition cursor-pointer disabled:opacity-60"
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
          <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-[#98a2b3]">
            <span className="bg-white px-2.5">or</span>
          </div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signUp" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#555f73] mb-1">
                  Your Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Muhammad Yaqoob"
                  className={fieldClass}
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555f73] mb-1">
                  Shop or Business Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Yaqoob Enterprises"
                  className={fieldClass}
                  value={form.shopName}
                  onChange={(e) => update("shopName", e.target.value)}
                  autoComplete="organization"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#555f73] mb-1">
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#555f73]">
                Password
              </label>
              {mode === "signIn" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                  className="text-xs font-medium text-[#4f46e5] hover:text-[#4338ca] hover:underline cursor-pointer"
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
                placeholder={mode === "signUp" ? "At least 8 characters" : "••••••••"}
                className={`${fieldClass} pr-10`}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-3 text-[#98a2b3] hover:text-[#555f73] transition cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs leading-relaxed ${
                feedback.type === "error"
                  ? "bg-red-50 border border-red-200 text-[#b91c1c]"
                  : "bg-emerald-50 border border-emerald-200 text-[#047857]"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] text-sm font-semibold text-white shadow-xs hover:bg-[#4338ca] transition cursor-pointer disabled:opacity-60 mt-2"
          >
            <span>{isSubmitting ? "Please wait..." : mode === "signIn" ? "Sign In" : "Create Account"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-6 pt-5 border-t border-[#e6e8ec] text-center text-xs text-[#667085]">
          {mode === "signIn" ? (
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signUp");
                  setFeedback(null);
                }}
                className="font-semibold text-[#4f46e5] hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signIn");
                  setFeedback(null);
                }}
                className="font-semibold text-[#4f46e5] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          )}
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
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#f8f9fb] p-4 font-sans text-[#191c1e] select-none">
      <main className="w-full max-w-[400px] rounded-2xl border border-[#e2e6eb] bg-white p-7 shadow-[0_16px_48px_rgba(25,28,30,0.06)] sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4f46e5]/10 text-[#4f46e5]">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#191c1e]">Set Your Quick-Unlock PIN</h1>
          <p className="mt-1.5 text-xs text-[#667085] leading-relaxed max-w-[300px]">
            Set a 4-digit PIN for quick register unlock and screen lock. Staff won't need to retype passwords between transactions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="setup-pin-input" className="block text-xs font-semibold text-[#555f73] mb-1">
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
                className={`${fieldClass} text-center tracking-[0.3em] font-mono text-base`}
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
            <label htmlFor="setup-confirm-pin" className="block text-xs font-semibold text-[#555f73] mb-1">
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
                className={`${fieldClass} text-center tracking-[0.3em] font-mono text-base`}
                value={confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setConfirmPin(val);
                  setError("");
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#667085]">
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="font-medium text-[#4f46e5] hover:underline cursor-pointer"
            >
              {showPin ? "Hide numbers" : "Show numbers"}
            </button>
            <span className="text-[11px] text-[#98a2b3]">Recommended: easy to remember</span>
          </div>

          {error && (
            <p role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-[#b91c1c]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || pin.length !== 4 || confirmPin.length !== 4}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] text-sm font-semibold text-white shadow-xs hover:bg-[#4338ca] transition cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isSubmitting ? "Setting PIN..." : "Save PIN & Enter Register"}</span>
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full text-center text-xs font-medium text-[#667085] hover:text-[#191c1e] hover:underline pt-2 cursor-pointer"
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
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#f8f9fb] p-4 font-sans text-[#191c1e] select-none">
      <main className="w-full max-w-[380px] rounded-2xl border border-[#e2e6eb] bg-white p-7 shadow-[0_16px_48px_rgba(25,28,30,0.06)] sm:p-9">
        {/* User Avatar and Identity */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 ring-4 ring-[#4f46e5]/10 rounded-full">
            <UserAvatar
              src={user?.avatar_url}
              name={user?.full_name || organization.owner_name || "Owner"}
              size="lg"
            />
          </div>
          <h1 className="text-base font-bold text-[#191c1e]">
            {user?.full_name || organization.owner_name || "Register Terminal"}
          </h1>
          <p className="text-xs text-[#667085] mt-0.5 font-medium">
            {organization.name || "Yaqoob Enterprises"}
          </p>
        </div>

        {/* PIN Input Form */}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="unlock-pin" className="block text-xs font-semibold text-[#555f73] mb-1.5 text-center">
              Enter 4-Digit Quick-Unlock PIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-5 w-5 text-[#98a2b3]" />
              <input
                id="unlock-pin"
                className={`${fieldClass} text-center tracking-[0.3em] font-mono text-base px-10`}
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
                {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#667085]">
            <span>Default PIN: <strong className="text-[#191c1e]">1234</strong></span>
            <button
              type="button"
              onClick={() => handleUnlock("1234")}
              className="font-medium text-[#4f46e5] hover:underline cursor-pointer"
            >
              Quick Unlock (1234)
            </button>
          </div>

          {error && (
            <p role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-[#b91c1c] text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] text-sm font-semibold text-white shadow-xs hover:bg-[#4338ca] transition cursor-pointer disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            <span>{isSubmitting ? "Unlocking..." : "Unlock Register"}</span>
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full text-center text-xs font-medium text-[#667085] hover:text-[#191c1e] hover:underline pt-2 cursor-pointer"
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
