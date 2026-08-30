import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { choreOccurrenceStatusSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { setChoreOccurrenceStatus } from "@/lib/chores";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "choreOccurrence.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const { status } = choreOccurrenceStatusSchema.parse(await request.json());
    const occurrence = await setChoreOccurrenceStatus(ctx, id, status);

    return NextResponse.json(occurrence);
  } catch (error) {
    return errorResponse(error);
  }
}
