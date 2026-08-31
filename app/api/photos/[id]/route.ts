import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { deletePhoto } from "@/lib/photos";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "photo.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) throw new ApiError(400, "invalid id");

    await deletePhoto(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
