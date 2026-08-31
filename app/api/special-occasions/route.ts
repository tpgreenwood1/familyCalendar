import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { specialOccasionCreateSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api-errors";
import { listSpecialOccasions, createSpecialOccasion } from "@/lib/specialOccasions";

export async function GET() {
  try {
    const ctx = await requireSession();
    const occasions = await listSpecialOccasions(ctx);
    return NextResponse.json(occasions);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "specialOccasion.manage");

    const input = specialOccasionCreateSchema.parse(await request.json());
    const occasion = await createSpecialOccasion(ctx, input);

    return NextResponse.json(occasion, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
