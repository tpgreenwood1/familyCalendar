import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { photoAlbumUpdateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { getAlbum, renameAlbum, deleteAlbum } from "@/lib/photos";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireSession();

    const id = Number(params.id);
    if (Number.isNaN(id)) throw new ApiError(400, "invalid id");

    const album = await getAlbum(ctx, id);
    return NextResponse.json(album);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "photoAlbum.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) throw new ApiError(400, "invalid id");

    const input = photoAlbumUpdateSchema.parse(await request.json());
    const album = await renameAlbum(ctx, id, input);

    return NextResponse.json(album);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "photoAlbum.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) throw new ApiError(400, "invalid id");

    await deleteAlbum(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
