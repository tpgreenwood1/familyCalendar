import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { shoppingItemUpdateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { setShoppingItemChecked, deleteShoppingItem } from "@/lib/shopping";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "shoppingItem.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const { checked } = shoppingItemUpdateSchema.parse(await request.json());
    const item = await setShoppingItemChecked(ctx, id, checked);

    return NextResponse.json(item);
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
    requireCan(ctx, "shoppingItem.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    await deleteShoppingItem(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
