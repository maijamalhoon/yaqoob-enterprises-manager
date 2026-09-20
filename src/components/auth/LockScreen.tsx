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
          {/* Header */}
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

          {/* PIN Status Dots */}
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

          {/* Feedback message */}
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

          {/* Keypad */}
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

          {/* Quiet Footer */}
          <div className="mt-6 pt-4 border-t border-[#e6e8ec] w-full flex flex-col items-center gap-1 text-[11px] text-[#667085]">
            <span>Default counter PIN is <strong>1234</strong></span>
            <span className="text-[10px] text-[#98a2b3]">You can change this anytime in Settings</span>
          </div>
        </div>
      </main>
    </div>
  );
};
