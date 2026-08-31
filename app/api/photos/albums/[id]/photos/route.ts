import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { photoCreateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { addPhoto } from "@/lib/photos";

// Records a Photo row for a file the client already uploaded directly to Vercel Blob
// (see /api/photos/upload) -- this route never receives the file itself, only its metadata.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "photo.manage");

    const albumId = Number(params.id);
    if (Number.isNaN(albumId)) throw new ApiError(400, "invalid id");

    const input = photoCreateSchema.parse(await request.json());
    const photo = await addPhoto(ctx, albumId, input);

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
