import { randomBytes, createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-errors";

// Excludes ambiguous characters (0/O, 1/I/L) since this is read off a screen and typed by hand.
const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 10;
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — DesignSpec.md §7 wants codes to expire

const INVITE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const INVITE_ATTEMPT_MAX = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function randomInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

/** Mints a new single-use invite code for a family, returning the plaintext code once —
 * only its SHA-256 hash is stored (DesignSpec.md §7: "never store reusable invitation
 * codes in plain text"). */
export async function createInvitation(
  familyGroupId: number,
  createdByUserId: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInviteCode();
    try {
      await prisma.invitation.create({
        data: {
          familyGroupId,
          createdByUserId,
          codeHash: hashCode(code),
          expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
        },
      });
      return code;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not generate a unique invite code");
}

/** Validates and atomically consumes an invite code. The `usedAt: null` guard in the
 * update's WHERE clause makes single-use enforcement race-safe without a transaction. */
export async function consumeInvitation(
  code: string,
  usedByUserId: string
): Promise<{ familyGroupId: number }> {
  const invitation = await prisma.invitation.findUnique({
    where: { codeHash: hashCode(normalizeCode(code)) },
  });
  if (!invitation || invitation.expiresAt < new Date()) {
    throw new ApiError(400, "Invalid or expired invite code");
  }

  const result = await prisma.invitation.updateMany({
    where: { id: invitation.id, usedAt: null },
    data: { usedAt: new Date(), usedByUserId },
  });
  if (result.count === 0) {
    throw new ApiError(400, "This invite code has already been used");
  }

  return { familyGroupId: invitation.familyGroupId };
}

/** Throws 429 once `key` (e.g. the joining user's email) has attempted a join too many
 * times recently. Records every attempt, not just failures — simplest correct guard
 * against brute-forcing invite codes (DesignSpec.md §27). */
export async function assertInviteAttemptAllowed(key: string): Promise<void> {
  const since = new Date(Date.now() - INVITE_ATTEMPT_WINDOW_MS);
  const recentAttempts = await prisma.inviteAttempt.count({
    where: { key, createdAt: { gte: since } },
  });
  if (recentAttempts >= INVITE_ATTEMPT_MAX) {
    throw new ApiError(429, "Too many attempts. Please try again later.");
  }
  await prisma.inviteAttempt.create({ data: { key } });
}
