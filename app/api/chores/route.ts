import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { choreCreateSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api-errors";
import { listChores, createChore } from "@/lib/chores";

export async function GET() {
  try {
    const ctx = await requireSession();
    const chores = await listChores(ctx);
    return NextResponse.json(chores);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "chore.manage");

    const input = choreCreateSchema.parse(await request.json());
    const chore = await createChore(ctx, input);

    return NextResponse.json(chore, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
