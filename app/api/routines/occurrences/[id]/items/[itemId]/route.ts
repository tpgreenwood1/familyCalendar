import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { routineItemCompletionSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { setRoutineItemCompletion } from "@/lib/routines";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "routineOccurrence.manage");

    const occurrenceId = Number(params.id);
    const itemId = Number(params.itemId);
    if (Number.isNaN(occurrenceId) || Number.isNaN(itemId)) {
      throw new ApiError(400, "invalid id");
    }

    const { completed } = routineItemCompletionSchema.parse(await request.json());
    const occurrence = await setRoutineItemCompletion(ctx, occurrenceId, itemId, completed);

    return NextResponse.json(occurrence);
  } catch (error) {
    return errorResponse(error);
  }
}
