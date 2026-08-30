import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { calendarEventUpdateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/calendar";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "calendarEvent.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const input = calendarEventUpdateSchema.parse(await request.json());
    const occurrence = await updateCalendarEvent(ctx, id, input);

    return NextResponse.json(occurrence);
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
    requireCan(ctx, "calendarEvent.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    await deleteCalendarEvent(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
