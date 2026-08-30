-- CreateEnum
CREATE TYPE "RoutinePeriod" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- AlterTable
ALTER TABLE "FamilyGroup" ADD COLUMN     "holidayMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Routine" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "period" "RoutinePeriod" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "familyGroupId" INTEGER NOT NULL,
    "familyMemberId" INTEGER NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineSchedule" (
    "id" SERIAL NOT NULL,
    "routineId" INTEGER NOT NULL,
    "daysOfWeek" INTEGER[],
    "activeDuringHoliday" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineItem" (
    "id" SERIAL NOT NULL,
    "routineId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineOccurrence" (
    "id" SERIAL NOT NULL,
    "routineId" INTEGER NOT NULL,
    "familyGroupId" INTEGER NOT NULL,
    "familyMemberId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineItemCompletion" (
    "id" SERIAL NOT NULL,
    "routineOccurrenceId" INTEGER NOT NULL,
    "routineItemId" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineItemCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Routine_familyGroupId_idx" ON "Routine"("familyGroupId");

-- CreateIndex
CREATE INDEX "Routine_familyMemberId_idx" ON "Routine"("familyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineSchedule_routineId_key" ON "RoutineSchedule"("routineId");

-- CreateIndex
CREATE INDEX "RoutineItem_routineId_idx" ON "RoutineItem"("routineId");

-- CreateIndex
CREATE INDEX "RoutineOccurrence_familyGroupId_date_idx" ON "RoutineOccurrence"("familyGroupId", "date");

-- CreateIndex
CREATE INDEX "RoutineOccurrence_familyMemberId_date_idx" ON "RoutineOccurrence"("familyMemberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineOccurrence_routineId_date_key" ON "RoutineOccurrence"("routineId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineItemCompletion_routineOccurrenceId_routineItemId_key" ON "RoutineItemCompletion"("routineOccurrenceId", "routineItemId");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineSchedule" ADD CONSTRAINT "RoutineSchedule_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItem" ADD CONSTRAINT "RoutineItem_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineOccurrence" ADD CONSTRAINT "RoutineOccurrence_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineOccurrence" ADD CONSTRAINT "RoutineOccurrence_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineOccurrence" ADD CONSTRAINT "RoutineOccurrence_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItemCompletion" ADD CONSTRAINT "RoutineItemCompletion_routineOccurrenceId_fkey" FOREIGN KEY ("routineOccurrenceId") REFERENCES "RoutineOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItemCompletion" ADD CONSTRAINT "RoutineItemCompletion_routineItemId_fkey" FOREIGN KEY ("routineItemId") REFERENCES "RoutineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

