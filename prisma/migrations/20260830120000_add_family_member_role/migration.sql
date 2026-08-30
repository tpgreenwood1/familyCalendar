-- Rename FamilyUser -> FamilyMember (hand-written, not `prisma migrate dev`, so this is a
-- rename rather than a destructive drop+recreate; existing Todo-owning rows are preserved)
-- and extend it with the fields from DesignSpec.md §5.3: role, avatar, dateOfBirth, active,
-- and a nullable link back to the Better Auth `user` who owns this person's account (adults
-- only — see prisma/schema.prisma).

-- RenameTable
ALTER TABLE "FamilyUser" RENAME TO "FamilyMember";
ALTER TABLE "FamilyMember" RENAME CONSTRAINT "FamilyUser_pkey" TO "FamilyMember_pkey";
ALTER INDEX "FamilyUser_familyGroupId_idx" RENAME TO "FamilyMember_familyGroupId_idx";
ALTER INDEX "FamilyUser_familyGroupId_name_key" RENAME TO "FamilyMember_familyGroupId_name_key";
ALTER TABLE "FamilyMember" RENAME CONSTRAINT "FamilyUser_familyGroupId_fkey" TO "FamilyMember_familyGroupId_fkey";

-- CreateEnum
CREATE TYPE "FamilyMemberRole" AS ENUM ('ADULT', 'CHILD');

-- AlterTable
ALTER TABLE "FamilyMember"
  ADD COLUMN "role" "FamilyMemberRole" NOT NULL DEFAULT 'CHILD',
  ADD COLUMN "avatar" TEXT NOT NULL DEFAULT 'star',
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "linkedUserId" TEXT;

ALTER TABLE "FamilyMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_linkedUserId_key" ON "FamilyMember"("linkedUserId");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: give every already-existing adult (one per FamilyMembership) a linked
-- FamilyMember card, since previously an adult who signed up got no such row (the gap this
-- migration/phase closes). Skips a userId that already has a linked FamilyMember (idempotent
-- if re-run) and skips any (familyGroupId, name) collision with a pre-existing unlinked row
-- rather than violating the unique constraint -- such families should rename by hand
-- afterward via the app.
INSERT INTO "FamilyMember" ("name", "color", "role", "avatar", "active", "familyGroupId", "linkedUserId", "createdAt", "updatedAt")
SELECT u."name", 'honey-bronze', 'ADULT', 'star', true, fm."familyGroupId", fm."userId", now(), now()
FROM "FamilyMembership" fm
JOIN "user" u ON u."id" = fm."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "FamilyMember" existing WHERE existing."linkedUserId" = fm."userId"
)
AND NOT EXISTS (
  SELECT 1 FROM "FamilyMember" existing
  WHERE existing."familyGroupId" = fm."familyGroupId" AND existing."name" = u."name"
);
