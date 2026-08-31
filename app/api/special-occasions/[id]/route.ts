import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { specialOccasionUpdateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { updateSpecialOccasion, deleteSpecialOccasion } from "@/lib/specialOccasions";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "specialOccasion.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const input = specialOccasionUpdateSchema.parse(await request.json());
    const occasion = await updateSpecialOccasion(ctx, id, input);

    return NextResponse.json(occasion);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "specialOccasion.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    await deleteSpecialOccasion(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
