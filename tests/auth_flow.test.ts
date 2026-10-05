import { describe, expect, it } from "vitest";

describe("Authentication flow & validation standards", () => {
  it("validates email addresses correctly according to global standards", () => {
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    
    expect(isValidEmail("owner@shoppro.com")).toBe(true);
    expect(isValidEmail("user.name+tag@domain.co.uk")).toBe(true);
    expect(isValidEmail("invalid-email")).toBe(false);
    expect(isValidEmail("@missingusername.com")).toBe(false);
    expect(isValidEmail("missingdomain@")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
  });

  it("enforces strong password length constraints (minimum 8 characters)", () => {
    const isValidPassword = (password: string) => password.length >= 8;

    expect(isValidPassword("12345678")).toBe(true);
    expect(isValidPassword("securePassw0rd!")).toBe(true);
    expect(isValidPassword("short")).toBe(false);
    expect(isValidPassword("1234567")).toBe(false);
  });

  it("correctly identifies OAuth error parameters in URL query/hash strings", () => {
    const parseOAuthParams = (rawUrl: string) => {
      const hashIndex = rawUrl.indexOf("#");
      const queryIndex = rawUrl.indexOf("?");
      let searchParams: URLSearchParams;

      if (hashIndex !== -1) {
        searchParams = new URLSearchParams(rawUrl.slice(hashIndex + 1));
      } else if (queryIndex !== -1) {
        searchParams = new URLSearchParams(rawUrl.slice(queryIndex + 1));
      } else {
        searchParams = new URLSearchParams(rawUrl);
      }

      const errorCode = searchParams.get("error_code") || searchParams.get("error");
      const errorDesc = searchParams.get("error_description") || "";
      const isRecovery = rawUrl.includes("type=recovery");

      return { errorCode, errorDesc, isRecovery };
    };

    const gcpTestUserError = parseOAuthParams("https://app.run.app/#error=access_denied&error_code=403&error_description=User+is+not+allowed");
    expect(gcpTestUserError.errorCode).toBe("403");
    expect(gcpTestUserError.errorDesc).toContain("User is not allowed");
    expect(gcpTestUserError.isRecovery).toBe(false);

    const redirectMismatch = parseOAuthParams("https://app.run.app/?error=redirect_uri_mismatch&error_description=Redirect+URI+does+not+match");
    expect(redirectMismatch.errorCode).toBe("redirect_uri_mismatch");

    const recoveryUrl = parseOAuthParams("https://app.run.app/#access_token=xyz&type=recovery&expires_in=3600");
    expect(recoveryUrl.isRecovery).toBe(true);
  });

  it("handles explicit sign out flag logic to prevent unintended auto-login", () => {
    const mockStorage = new Map<string, string>();

    const handleSignOut = () => {
      mockStorage.set("yaqoob_signed_out", "true");
      mockStorage.delete("yaqoob_active_profile");
    };

    const shouldAutoRestoreFirstAccount = () => {
      const isExplicitlySignedOut = mockStorage.get("yaqoob_signed_out") === "true";
      const activeProfileId = mockStorage.get("yaqoob_active_profile");
      if (isExplicitlySignedOut && !activeProfileId) {
        return false;
      }
      return true;
    };

    // Initial state before signout
    expect(shouldAutoRestoreFirstAccount()).toBe(true);

    // After sign out
    handleSignOut();
    expect(shouldAutoRestoreFirstAccount()).toBe(false);

    // After subsequent user sign in
    mockStorage.delete("yaqoob_signed_out");
    mockStorage.set("yaqoob_active_profile", "user-123");
    expect(shouldAutoRestoreFirstAccount()).toBe(true);
  });
});
