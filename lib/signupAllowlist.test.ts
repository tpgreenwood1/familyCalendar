import { afterEach, describe, expect, it } from "vitest";
import { isEmailAllowedToSignUp } from "@/lib/signupAllowlist";

const ENV_KEY = "ALLOWED_SIGNUP_EMAILS";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("isEmailAllowedToSignUp", () => {
  it("denies everyone when the env var is unset", () => {
    delete process.env[ENV_KEY];
    expect(isEmailAllowedToSignUp("anyone@example.com")).toBe(false);
  });

  it("denies everyone when the env var is empty", () => {
    process.env[ENV_KEY] = "";
    expect(isEmailAllowedToSignUp("anyone@example.com")).toBe(false);
  });

  it("allows an exact match for a single-email allowlist", () => {
    process.env[ENV_KEY] = "admin@example.com";
    expect(isEmailAllowedToSignUp("admin@example.com")).toBe(true);
    expect(isEmailAllowedToSignUp("other@example.com")).toBe(false);
  });

  it("allows any address from a comma-separated list", () => {
    process.env[ENV_KEY] = "a@example.com,b@example.com, c@example.com";
    expect(isEmailAllowedToSignUp("a@example.com")).toBe(true);
    expect(isEmailAllowedToSignUp("b@example.com")).toBe(true);
    expect(isEmailAllowedToSignUp("c@example.com")).toBe(true);
    expect(isEmailAllowedToSignUp("d@example.com")).toBe(false);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    process.env[ENV_KEY] = " Admin@Example.com ";
    expect(isEmailAllowedToSignUp("admin@example.com")).toBe(true);
    expect(isEmailAllowedToSignUp("ADMIN@EXAMPLE.COM")).toBe(true);
    expect(isEmailAllowedToSignUp("  admin@example.com  ")).toBe(true);
  });
});
