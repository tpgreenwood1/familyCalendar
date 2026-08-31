-- CreateEnum
CREATE TYPE "SpecialOccasionType" AS ENUM ('BIRTHDAY', 'ANNIVERSARY');

-- CreateTable
CREATE TABLE "SpecialOccasion" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "type" "SpecialOccasionType" NOT NULL,
    "originalDate" TIMESTAMP(3) NOT NULL,
    "isSomber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "familyGroupId" INTEGER NOT NULL,

    CONSTRAINT "SpecialOccasion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialOccasion_familyGroupId_idx" ON "SpecialOccasion"("familyGroupId");

-- AddForeignKey
ALTER TABLE "SpecialOccasion" ADD CONSTRAINT "SpecialOccasion_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
