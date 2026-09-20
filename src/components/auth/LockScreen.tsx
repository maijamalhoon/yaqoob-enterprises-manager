import React, { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Store,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const fieldClass =
  "w-full h-11 rounded-lg border border-[#dfe3e8] bg-white px-3 text-sm outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15";

export const LockScreen: React.FC = () => {
  const { unlock, organization, signOut } = useAuth();
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => document.getElementById("unlock-pin")?.focus(), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const success = await unlock(pin);
    setIsSubmitting(false);
    if (!success) {
      setPin("");
      setError("That PIN is incorrect. Please try again.");
      document.getElementById("unlock-pin")?.focus();
    }
  };

  return (
    <AuthFrame
      title={organization.name || "Shop workspace"}
      subtitle="Enter your PIN to continue"
    >
      <form onSubmit={submit} className="w-full space-y-4">
        <label
          htmlFor="unlock-pin"
          className="block text-xs font-semibold text-[#555f73]"
        >
          Owner PIN
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-3 h-5 w-5 text-[#98a2b3]" />
          <input
            id="unlock-pin"
            className={`${fieldClass} pl-10 pr-11 tracking-[0.25em]`}
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error)}
          />
          <button
            type="button"
            onClick={() => setShowPin((visible) => !visible)}
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
            className="absolute right-3 top-3 text-[#667085] hover:text-[#191c1e]"
          >
            {showPin ?
              <EyeOff className="h-5 w-5" />
            : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-[#c2413b]">
            {error}
          </p>
        )}
        <button
          disabled={isSubmitting || pin.length < 4}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#3525cd] text-sm font-semibold text-white transition hover:bg-[#2d20af] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LockKeyhole className="h-4 w-4" />
          {isSubmitting ? "Checking..." : "Unlock workspace"}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full text-xs font-semibold text-[#4f46e5] hover:underline"
        >
          Use account sign-in or switch user
        </button>
      </form>
    </AuthFrame>
  );
};

export const SignUpScreen: React.FC = () => {
  const { createAccount } = useAuth();
  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    email: "",
    pin: "",
    confirmPin: "",
  });
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => document.getElementById("shop-name")?.focus(), []);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const result = await createAccount(form);
    setIsSubmitting(false);
    if (!result.success)
      setError(result.error || "Could not create the shop account.");
  };

  return (
    <AuthFrame
      title="Create your shop account"
      subtitle="Set up this computer for offline shop management"
    >
      <form onSubmit={submit} className="w-full space-y-3">
        <label className="block text-xs font-semibold text-[#555f73]">
          Shop or business name
          <input
            id="shop-name"
            required
            className={`${fieldClass} mt-1`}
            value={form.shopName}
            onChange={(event) => update("shopName", event.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[#555f73]">
          Owner name
          <input
            required
            className={`${fieldClass} mt-1`}
            value={form.ownerName}
            onChange={(event) => update("ownerName", event.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[#555f73]">
          Email <span className="font-normal text-[#98a2b3]">(optional)</span>
          <input
            type="email"
            className={`${fieldClass} mt-1`}
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-[#555f73]">
            PIN
            <input
              required
              minLength={4}
              className={`${fieldClass} mt-1`}
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              value={form.pin}
              onChange={(event) => update("pin", event.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-[#555f73]">
            Confirm PIN
            <input
              required
              minLength={4}
              className={`${fieldClass} mt-1`}
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              value={form.confirmPin}
              onChange={(event) => update("confirmPin", event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowPin((visible) => !visible)}
          className="text-xs font-medium text-[#4f46e5]"
        >
          {showPin ? "Hide PIN" : "Show PIN"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-[#c2413b]">
            {error}
          </p>
        )}
        <button
          disabled={isSubmitting}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#3525cd] text-sm font-semibold text-white transition hover:bg-[#2d20af] disabled:opacity-50"
        >
          <Store className="h-4 w-4" />
          {isSubmitting ? "Creating account..." : "Create shop account"}
        </button>
      </form>
    </AuthFrame>
  );
};

export const AuthScreen: React.FC = () => {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    createAccount,
    isSupabaseReady,
  } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    shopName: "",
  });
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback("");
    setSuccess("");
    if (mode === "signUp" && form.password !== form.confirmPassword) {
      setFeedback("Password confirmation does not match.");
      return;
    }
    setIsSubmitting(true);
    const result =
      mode === "signIn" ? await signIn(form.email, form.password)
      : isSupabaseReady ?
        await signUp(form.email, form.password, form.fullName, form.shopName)
      : await createAccount({
          shopName: form.shopName,
          ownerName: form.fullName,
          email: form.email,
          pin: form.password,
          confirmPin: form.password,
          password: form.password,
        });
    setIsSubmitting(false);
    if (result.error) setFeedback(result.error);
    else if (mode === "signUp" && isSupabaseReady)
      setSuccess("Account created. Check your email to confirm your account.");
  };

  const resetPassword = async () => {
    setFeedback("");
    setSuccess("");
    const result = await sendPasswordReset(form.email);
    if (result.error) setFeedback(result.error);
    else setSuccess("Password reset instructions are on their way.");
  };

  return (
    <AuthFrame
      title={mode === "signIn" ? "Welcome back" : "Create your account"}
      subtitle={
        mode === "signIn" ?
          "Sign in to your shop workspace"
        : "Set up your shop workspace securely"
      }
    >
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-[#f3f5f8] p-1 text-sm font-semibold">
        {(["signIn", "signUp"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setMode(tab);
              setFeedback("");
              setSuccess("");
            }}
            className={`rounded-md px-3 py-2 ${mode === tab ? "bg-white text-[#3525cd] shadow-sm" : "text-[#667085]"}`}
          >
            {tab === "signIn" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="w-full space-y-3">
        {mode === "signUp" && (
          <>
            <label className="block text-xs font-semibold text-[#555f73]">
              Your name
              <input
                required
                className={`${fieldClass} mt-1`}
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold text-[#555f73]">
              Shop name
              <input
                required
                className={`${fieldClass} mt-1`}
                value={form.shopName}
                onChange={(event) => update("shopName", event.target.value)}
              />
            </label>
          </>
        )}
        <label className="block text-xs font-semibold text-[#555f73]">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            className={`${fieldClass} mt-1`}
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[#555f73]">
          Password
          <div className="relative mt-1">
            <input
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "signIn" ? "current-password" : "new-password"
              }
              className={`${fieldClass} pr-11`}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-3 text-[#667085]"
            >
              {showPassword ?
                <EyeOff className="h-5 w-5" />
              : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </label>
        {mode === "signUp" && (
          <label className="block text-xs font-semibold text-[#555f73]">
            Confirm password
            <input
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={`${fieldClass} mt-1`}
              value={form.confirmPassword}
              onChange={(event) =>
                update("confirmPassword", event.target.value)
              }
            />
          </label>
        )}
        {feedback && (
          <p role="alert" className="text-sm text-[#c2413b]">
            {feedback}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-[#15803d]">
            {success}
          </p>
        )}
        <button
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#3525cd] text-sm font-semibold text-white transition hover:bg-[#2d20af] disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {isSubmitting ?
            "Please wait..."
          : mode === "signIn" ?
            "Sign in"
          : "Create account"}
        </button>
      </form>
      {mode === "signIn" && (
        <button
          type="button"
          onClick={() => void resetPassword()}
          className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-semibold text-[#4f46e5]"
        >
          <Mail className="h-4 w-4" />
          Forgot password?
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          const result = await signInWithGoogle();
          if (result.error) setFeedback(result.error);
        }}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#dfe3e8] bg-white text-sm font-semibold text-[#191c1e] hover:bg-[#f8f9fb]"
      >
        <span className="text-base font-bold">G</span>Continue with Google
      </button>
      {!isSupabaseReady && (
        <p className="mt-3 text-center text-[11px] text-[#98a2b3]">
          Cloud sign-in and password recovery become available when Supabase is
          configured.
        </p>
      )}
    </AuthFrame>
  );
};

const AuthFrame: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="flex min-h-screen w-screen items-center justify-center bg-[#f3f5f8] p-4 font-sans text-[#191c1e]">
    <main className="w-full max-w-md rounded-2xl border border-[#e2e6eb] bg-white p-7 shadow-[0_18px_55px_rgba(25,28,30,0.08)] sm:p-9">
      <div className="mb-7 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e2dfff] text-[#4f46e5]">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
      </div>
      {children}
      <p className="mt-6 text-center text-[11px] text-[#98a2b3]">
        Your account and PIN stay on this computer.
      </p>
    </main>
  </div>
);
/*
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Store, Delete, KeyRound, AlertCircle } from "lucide-react";

export const LockScreen: React.FC = () => {
  const { unlock, organization } = useAuth();
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; type: "error" | "success" | "info" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const attemptUnlock = useCallback(
    async (enteredPin: string) => {
      setIsSubmitting(true);
      setFeedback(null);
      try {
        const success = await unlock(enteredPin);
        if (success) {
          setFeedback({ text: "Unlocking workspace...", type: "success" });
        } else {
          setFeedback({ text: "Incorrect PIN. Try again.", type: "error" });
          setTimeout(() => {
            setPin("");
            setFeedback(null);
            setIsSubmitting(false);
          }, 800);
        }
      } catch {
        setFeedback({ text: "Error unlocking. Please try again.", type: "error" });
        setPin("");
        setIsSubmitting(false);
      }
    },
    [unlock],
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (isSubmitting) return;
      setFeedback(null);
      if (pin.length < 4) {
        const nextPin = pin + digit;
        setPin(nextPin);
        if (nextPin.length === 4) {
          void attemptUnlock(nextPin);
        }
      }
    },
    [pin, isSubmitting, attemptUnlock],
  );

  const handleBackspace = useCallback(() => {
    if (isSubmitting) return;
    setFeedback(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isSubmitting]);

  const handleClear = useCallback(() => {
    if (isSubmitting) return;
    setFeedback(null);
    setPin("");
  }, [isSubmitting]);

  // Keyboard support: 0-9, Backspace, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear]);

  return (
    <div className="min-h-screen w-screen bg-[#f8f9fb] font-sans text-[#191c1e] antialiased flex items-center justify-center p-4 select-none">
      <main className="w-full max-w-md mx-auto">
        <div className="w-full bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e6e8ec] p-8 sm:p-10 flex flex-col items-center relative overflow-hidden">
          {/* Header * /}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#e2dfff] flex items-center justify-center text-[#3525cd] mb-3 shadow-xs">
              <Store className="h-6 w-6 text-[#4f46e5]" />
            </div>
            <h1 className="text-xl font-semibold text-[#191c1e] tracking-tight">
              {organization.name || "Yaqoob Enterprises"}
            </h1>
            <p className="text-xs font-medium text-[#555f73] mt-1">
              Enter Owner PIN to unlock
            </p>
          </div>

          {/* PIN Status Dots * /}
          <div
            aria-label="PIN Entry Status"
            className="flex items-center justify-center gap-4 my-2"
          >
            {[0, 1, 2, 3].map((index) => {
              const isFilled = index < pin.length;
              return (
                <span
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    isFilled
                      ? "bg-[#4f46e5] scale-110 shadow-xs"
                      : "bg-[#e1e2e4] scale-100"
                  }`}
                />
              );
            })}
          </div>

          {/* Feedback message * /}
          <div className="h-5 flex items-center justify-center mt-2">
            {feedback && (
              <p
                className={`text-xs font-medium transition-all ${
                  feedback.type === "success"
                    ? "text-[#16a34a]"
                    : feedback.type === "error"
                    ? "text-[#dc2626]"
                    : "text-[#555f73]"
                }`}
              >
                {feedback.text}
              </p>
            )}
          </div>

          {/* Keypad * /}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px] mt-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-14 rounded-xl bg-[#f2f4f6] hover:bg-[#edeef0] active:scale-95 transition-all flex items-center justify-center font-mono text-xl text-[#191c1e] select-none cursor-pointer border border-[#e6e8ec]"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-xl bg-transparent hover:bg-[#f2f4f6] active:scale-95 transition-all flex items-center justify-center font-medium text-xs text-[#555f73] select-none cursor-pointer"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="h-14 rounded-xl bg-[#f2f4f6] hover:bg-[#edeef0] active:scale-95 transition-all flex items-center justify-center font-mono text-xl text-[#191c1e] select-none cursor-pointer border border-[#e6e8ec]"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Backspace"
              className="h-14 rounded-xl bg-transparent hover:bg-[#f2f4f6] active:scale-95 transition-all flex items-center justify-center text-[#555f73] hover:text-[#191c1e] select-none cursor-pointer"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          {/* Quiet Footer * /}
          <div className="mt-6 pt-4 border-t border-[#e6e8ec] w-full flex flex-col items-center gap-1 text-[11px] text-[#667085]">
            <span>Default counter PIN is <strong>1234</strong></span>
            <span className="text-[10px] text-[#98a2b3]">You can change this anytime in Settings</span>
          </div>
        </div>
      </main>
    </div>
  );
};
*/
