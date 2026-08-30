-- CreateEnum
CREATE TYPE "ChoreOccurrenceStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Chore" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "familyGroupId" INTEGER NOT NULL,

    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreSchedule" (
    "id" SERIAL NOT NULL,
    "choreId" INTEGER NOT NULL,
    "familyMemberId" INTEGER NOT NULL,
    "daysOfWeek" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChoreSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreOccurrence" (
    "id" SERIAL NOT NULL,
    "choreId" INTEGER NOT NULL,
    "familyGroupId" INTEGER NOT NULL,
    "familyMemberId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ChoreOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chore_familyGroupId_idx" ON "Chore"("familyGroupId");

-- CreateIndex
CREATE INDEX "ChoreSchedule_choreId_idx" ON "ChoreSchedule"("choreId");

-- CreateIndex
CREATE INDEX "ChoreOccurrence_familyGroupId_date_idx" ON "ChoreOccurrence"("familyGroupId", "date");

-- CreateIndex
CREATE INDEX "ChoreOccurrence_familyMemberId_date_idx" ON "ChoreOccurrence"("familyMemberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChoreOccurrence_choreId_familyMemberId_date_key" ON "ChoreOccurrence"("choreId", "familyMemberId", "date");

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreSchedule" ADD CONSTRAINT "ChoreSchedule_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreSchedule" ADD CONSTRAINT "ChoreSchedule_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreOccurrence" ADD CONSTRAINT "ChoreOccurrence_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreOccurrence" ADD CONSTRAINT "ChoreOccurrence_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreOccurrence" ADD CONSTRAINT "ChoreOccurrence_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
