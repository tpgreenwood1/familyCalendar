import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { photoAlbumCreateSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api-errors";
import { listAlbums, createAlbum } from "@/lib/photos";

export async function GET() {
  try {
    const ctx = await requireSession();
    const albums = await listAlbums(ctx);
    return NextResponse.json(albums);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "photoAlbum.manage");

    const input = photoAlbumCreateSchema.parse(await request.json());
    const album = await createAlbum(ctx, input);

    return NextResponse.json(album, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
