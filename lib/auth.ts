import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isEmailAllowedToSignUp } from "@/lib/signupAllowlist";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  // Dev-phase safeguard (not a DesignSpec feature): block account creation for anyone
  // not on ALLOWED_SIGNUP_EMAILS. Fires only on sign-up (a new User row), never on
  // sign-in, so already-approved accounts are unaffected. See docs/AUTH.md.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isEmailAllowedToSignUp(user.email)) {
            console.warn(`[signup-blocked] ${user.email} attempted sign-up (not on allowlist)`);
            throw new APIError("FORBIDDEN", {
              message:
                "This app is currently in its development phase. A request for access has been sent to the administrator, who will need to grant permission before you can sign up.",
              code: "SIGN_UP_NOT_APPROVED",
            });
          }
        },
      },
    },
  },
  // The kiosk tablet stays signed in indefinitely (mirrors the previous NextAuth
  // 1-year sliding session — see git history of lib/auth.config.ts).
  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
});
