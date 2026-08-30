-- Rename User -> LegacyUser (hand-written, not `prisma migrate dev --create-only`, so this
-- is a rename rather than a destructive drop+recreate; frees the `User` name/table for
-- Better Auth's Prisma adapter). Data is preserved untouched.
ALTER TABLE "User" RENAME TO "LegacyUser";
ALTER TABLE "LegacyUser" RENAME CONSTRAINT "User_pkey" TO "LegacyUser_pkey";
ALTER INDEX "User_email_key" RENAME TO "LegacyUser_email_key";
ALTER INDEX "User_familyGroupId_idx" RENAME TO "LegacyUser_familyGroupId_idx";
ALTER TABLE "LegacyUser" RENAME CONSTRAINT "User_familyGroupId_fkey" TO "LegacyUser_familyGroupId_fkey";
