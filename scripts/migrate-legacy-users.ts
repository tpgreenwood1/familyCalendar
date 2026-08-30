/**
 * One-off data migration for DesignSpec.md Phase 2 (Better Auth).
 *
 * For each `LegacyUser` row (the old NextAuth-backed user table, renamed out of the way —
 * see prisma/schema.prisma), creates the equivalent Better Auth `User` + `Account`
 * (reusing the existing bcrypt password hash, so no one needs to reset their password), a
 * `FamilyMembership` linking it to the same family, and a linked adult `FamilyMember` card
 * (DesignSpec.md §5.3/§34) so they show up in the family roster. Also mints a fresh
 * `Invitation` per family that doesn't already have one, since the old plaintext
 * `FamilyGroup.inviteCode` was dropped rather than migrated (see docs/AUTH.md).
 *
 * Idempotent — safe to re-run; already-migrated users (matched by email) are skipped.
 *
 * Run with: npx ts-node scripts/migrate-legacy-users.ts
 * (This is standalone tooling, not part of the Next.js app — it loads `.env` itself and
 * creates its own PrismaClient rather than importing `@/lib/prisma`, matching
 * prisma/seed.ts's convention.)
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { randomBytes, createHash, randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}
loadEnvFile();

const prisma = new PrismaClient();

const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 10;
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function randomInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

async function migrateUsers(): Promise<void> {
  const legacyUsers = await prisma.legacyUser.findMany({ orderBy: { id: "asc" } });
  console.log(`Found ${legacyUsers.length} legacy user(s).`);

  for (const legacy of legacyUsers) {
    const alreadyMigrated = await prisma.user.findUnique({ where: { email: legacy.email } });
    if (alreadyMigrated) {
      console.log(`  skip  ${legacy.email} (already migrated)`);
      continue;
    }

    const userId = randomUUID();
    const name = legacy.email.split("@")[0];

    await prisma.$transaction([
      prisma.user.create({
        data: {
          id: userId,
          name,
          email: legacy.email,
          emailVerified: true,
          createdAt: legacy.createdAt,
          updatedAt: legacy.createdAt,
        },
      }),
      prisma.account.create({
        data: {
          id: randomUUID(),
          userId,
          issuer: "local:credential",
          providerId: "credential",
          accountId: userId,
          password: legacy.passwordHash,
          createdAt: legacy.createdAt,
          updatedAt: legacy.createdAt,
        },
      }),
      prisma.familyMembership.create({
        data: { userId, familyGroupId: legacy.familyGroupId },
      }),
      // Matches the "honey-bronze" default the hand-written schema migration backfilled for
      // pre-existing adults (prisma/migrations/20260830120000_add_family_member_role) --
      // just needs to be a valid FAMILY_MEMBER_COLORS key, not imported here since this
      // script runs outside the `@/*` path alias (see file header).
      prisma.familyMember.create({
        data: { name, color: "honey-bronze", role: "ADULT", linkedUserId: userId, familyGroupId: legacy.familyGroupId },
      }),
    ]);

    console.log(`  done  ${legacy.email} -> Better Auth user ${userId}`);
  }
}

async function mintMissingInvitations(): Promise<void> {
  const familyGroups = await prisma.familyGroup.findMany();

  for (const group of familyGroups) {
    const membership = await prisma.familyMembership.findFirst({
      where: { familyGroupId: group.id },
    });
    if (!membership) continue; // no migrated user yet to attribute the invite to

    const activeInvite = await prisma.invitation.findFirst({
      where: { familyGroupId: group.id, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (activeInvite) {
      console.log(`  skip  "${group.name}" already has an active invite`);
      continue;
    }

    const code = randomInviteCode();
    await prisma.invitation.create({
      data: {
        familyGroupId: group.id,
        createdByUserId: membership.userId,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
      },
    });
    console.log(`  new invite code for "${group.name}": ${code}  (save now — shown once)`);
  }
}

async function main(): Promise<void> {
  console.log("Migrating legacy users to Better Auth...");
  await migrateUsers();
  console.log("Minting invitations for families with none active...");
  await mintMissingInvitations();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
