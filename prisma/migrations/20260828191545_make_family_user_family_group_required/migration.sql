-- DropIndex
DROP INDEX "FamilyUser_name_key";

-- AlterTable
ALTER TABLE "FamilyUser" ALTER COLUMN "familyGroupId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FamilyUser_familyGroupId_idx" ON "FamilyUser"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyUser_familyGroupId_name_key" ON "FamilyUser"("familyGroupId", "name");
