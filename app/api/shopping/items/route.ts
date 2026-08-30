import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { shoppingItemCreateSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api-errors";
import { listShoppingItems, addShoppingItem } from "@/lib/shopping";

export async function GET() {
  try {
    const ctx = await requireSession();
    const items = await listShoppingItems(ctx);
    return NextResponse.json(items);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "shoppingItem.manage");

    const { name } = shoppingItemCreateSchema.parse(await request.json());
    const item = await addShoppingItem(ctx, name);

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
