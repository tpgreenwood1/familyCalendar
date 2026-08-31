-- AlterTable
ALTER TABLE "FamilyGroup" ADD COLUMN     "screensaverAlbumId" INTEGER,
ADD COLUMN     "screensaverEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "screensaverIdleSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "screensaverIntervalSeconds" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "PhotoAlbum" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "familyGroupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoAlbum_familyGroupId_idx" ON "PhotoAlbum"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAlbum_familyGroupId_name_key" ON "PhotoAlbum"("familyGroupId", "name");

-- CreateIndex
CREATE INDEX "Photo_albumId_idx" ON "Photo"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGroup_screensaverAlbumId_key" ON "FamilyGroup"("screensaverAlbumId");

-- AddForeignKey
ALTER TABLE "FamilyGroup" ADD CONSTRAINT "FamilyGroup_screensaverAlbumId_fkey" FOREIGN KEY ("screensaverAlbumId") REFERENCES "PhotoAlbum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAlbum" ADD CONSTRAINT "PhotoAlbum_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "PhotoAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
