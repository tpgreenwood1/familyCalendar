import { del } from "@vercel/blob";
import type { Photo } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { FamilyContext } from "@/lib/authz";
import { ApiError } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";
import type {
  photoAlbumCreateSchema,
  photoAlbumUpdateSchema,
  photoCreateSchema,
} from "@/lib/schemas";

type CreateAlbumInput = z.infer<typeof photoAlbumCreateSchema>;
type UpdateAlbumInput = z.infer<typeof photoAlbumUpdateSchema>;
type CreatePhotoInput = z.infer<typeof photoCreateSchema>;

export type PhotoDTO = {
  id: number;
  blobUrl: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
};

export type PhotoAlbumDTO = {
  id: number;
  name: string;
  createdAt: Date;
  photoCount: number;
  coverPhotoUrl: string | null;
};

export type PhotoAlbumDetailDTO = PhotoAlbumDTO & { photos: PhotoDTO[] };

/** DesignSpec.md §16B/§42B -- the household-wide screensaver settings plus the currently
 * selected album's photos, in one shape so Wall/Dashboard only need one fetch. */
export type ScreensaverSettingsDTO = {
  enabled: boolean;
  albumId: number | null;
  albumName: string | null;
  intervalSeconds: number;
  idleSeconds: number;
  photos: PhotoDTO[];
};

function toPhotoDTO(photo: Photo): PhotoDTO {
  return {
    id: photo.id,
    blobUrl: photo.blobUrl,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
  };
}

export async function listAlbums(ctx: FamilyContext): Promise<PhotoAlbumDTO[]> {
  const albums = await prisma.photoAlbum.findMany({
    where: { familyGroupId: ctx.familyGroupId },
    orderBy: { createdAt: "asc" },
    include: {
      photos: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { photos: true } },
    },
  });

  return albums.map((album) => ({
    id: album.id,
    name: album.name,
    createdAt: album.createdAt,
    photoCount: album._count.photos,
    coverPhotoUrl: album.photos[0]?.blobUrl ?? null,
  }));
}

export async function getAlbum(ctx: FamilyContext, albumId: number): Promise<PhotoAlbumDetailDTO> {
  const album = await prisma.photoAlbum.findFirst({
    where: { id: albumId, familyGroupId: ctx.familyGroupId },
    include: { photos: { orderBy: { createdAt: "asc" } } },
  });
  if (!album) throw new ApiError(404, "not found");

  return {
    id: album.id,
    name: album.name,
    createdAt: album.createdAt,
    photoCount: album.photos.length,
    coverPhotoUrl: album.photos[album.photos.length - 1]?.blobUrl ?? null,
    photos: album.photos.map(toPhotoDTO),
  };
}

export async function createAlbum(ctx: FamilyContext, input: CreateAlbumInput): Promise<PhotoAlbumDTO> {
  const existing = await prisma.photoAlbum.findUnique({
    where: { familyGroupId_name: { familyGroupId: ctx.familyGroupId, name: input.name } },
  });
  if (existing) throw new ApiError(409, "an album with this name already exists");

  const album = await prisma.photoAlbum.create({
    data: { name: input.name, familyGroupId: ctx.familyGroupId },
  });

  publishDomainEvent({ type: "PHOTO_ALBUM_CREATED", familyGroupId: ctx.familyGroupId });

  return { id: album.id, name: album.name, createdAt: album.createdAt, photoCount: 0, coverPhotoUrl: null };
}

export async function renameAlbum(
  ctx: FamilyContext,
  albumId: number,
  input: UpdateAlbumInput
): Promise<PhotoAlbumDTO> {
  const existing = await prisma.photoAlbum.findFirst({
    where: { id: albumId, familyGroupId: ctx.familyGroupId },
  });
  if (!existing) throw new ApiError(404, "not found");

  const nameTaken = await prisma.photoAlbum.findUnique({
    where: { familyGroupId_name: { familyGroupId: ctx.familyGroupId, name: input.name } },
  });
  if (nameTaken && nameTaken.id !== albumId) throw new ApiError(409, "an album with this name already exists");

  const album = await prisma.photoAlbum.update({ where: { id: albumId }, data: { name: input.name } });

  publishDomainEvent({ type: "PHOTO_ALBUM_UPDATED", familyGroupId: ctx.familyGroupId });

  return {
    id: album.id,
    name: album.name,
    createdAt: album.createdAt,
    photoCount: 0, // callers refetch listAlbums()/getAlbum() for an accurate count after rename
    coverPhotoUrl: null,
  };
}

/** Deletes the album's blobs from Vercel Blob, then the row (cascades its Photo rows). If
 * this was the family's selected screensaver album, disables the screensaver rather than
 * leaving it pointing at nothing (DesignSpec.md §16B) -- the FK itself would already go
 * null via onDelete: SetNull, but screensaverEnabled needs an explicit flip too. */
export async function deleteAlbum(ctx: FamilyContext, albumId: number): Promise<void> {
  const album = await prisma.photoAlbum.findFirst({
    where: { id: albumId, familyGroupId: ctx.familyGroupId },
    include: { photos: true },
  });
  if (!album) throw new ApiError(404, "not found");

  if (album.photos.length > 0) {
    await del(album.photos.map((p) => p.blobUrl));
  }

  const familyGroup = await prisma.familyGroup.findUniqueOrThrow({ where: { id: ctx.familyGroupId } });

  await prisma.$transaction(async (tx) => {
    if (familyGroup.screensaverAlbumId === albumId) {
      await tx.familyGroup.update({
        where: { id: ctx.familyGroupId },
        data: { screensaverEnabled: false, screensaverAlbumId: null },
      });
    }
    await tx.photoAlbum.delete({ where: { id: albumId } });
  });

  publishDomainEvent({ type: "PHOTO_ALBUM_DELETED", familyGroupId: ctx.familyGroupId });
}

export async function addPhoto(
  ctx: FamilyContext,
  albumId: number,
  input: CreatePhotoInput
): Promise<PhotoDTO> {
  const album = await prisma.photoAlbum.findFirst({
    where: { id: albumId, familyGroupId: ctx.familyGroupId },
  });
  if (!album) throw new ApiError(404, "not found");

  const photo = await prisma.photo.create({
    data: {
      albumId,
      blobUrl: input.blobUrl,
      blobPathname: input.blobPathname,
      width: input.width,
      height: input.height,
    },
  });

  publishDomainEvent({ type: "PHOTO_CREATED", familyGroupId: ctx.familyGroupId });

  return toPhotoDTO(photo);
}

export async function deletePhoto(ctx: FamilyContext, photoId: number): Promise<void> {
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, album: { familyGroupId: ctx.familyGroupId } },
  });
  if (!photo) throw new ApiError(404, "not found");

  await del(photo.blobUrl);
  await prisma.photo.delete({ where: { id: photoId } });

  publishDomainEvent({ type: "PHOTO_DELETED", familyGroupId: ctx.familyGroupId });
}

/** Used by the family-group route's PATCH before writing `screensaverAlbumId`, so a family
 * can never point its screensaver at another family's album. */
export async function assertAlbumBelongsToFamily(familyGroupId: number, albumId: number): Promise<void> {
  const album = await prisma.photoAlbum.findFirst({ where: { id: albumId, familyGroupId } });
  if (!album) throw new ApiError(404, "album not found");
}

export async function getScreensaverSettings(ctx: FamilyContext): Promise<ScreensaverSettingsDTO> {
  const familyGroup = await prisma.familyGroup.findUniqueOrThrow({
    where: { id: ctx.familyGroupId },
    include: { screensaverAlbum: { include: { photos: { orderBy: { createdAt: "asc" } } } } },
  });

  return {
    enabled: familyGroup.screensaverEnabled,
    albumId: familyGroup.screensaverAlbumId,
    albumName: familyGroup.screensaverAlbum?.name ?? null,
    intervalSeconds: familyGroup.screensaverIntervalSeconds,
    idleSeconds: familyGroup.screensaverIdleSeconds,
    photos: familyGroup.screensaverAlbum?.photos.map(toPhotoDTO) ?? [],
  };
}
