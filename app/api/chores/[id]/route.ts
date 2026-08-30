import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { choreUpdateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { updateChore, deleteChore } from "@/lib/chores";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "chore.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const input = choreUpdateSchema.parse(await request.json());
    const chore = await updateChore(ctx, id, input);

    return NextResponse.json(chore);
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
    requireCan(ctx, "chore.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    await deleteChore(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
