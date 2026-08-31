-- CreateEnum
CREATE TYPE "ShoppingItemCategory" AS ENUM ('GROCERIES', 'OTHER');

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "category" "ShoppingItemCategory" NOT NULL DEFAULT 'GROCERIES';
