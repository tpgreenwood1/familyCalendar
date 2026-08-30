import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { calendarEventCreateSchema, calendarEventRangeQuerySchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { listEventsInRange, createCalendarEvent } from "@/lib/calendar";

export async function GET(request: Request) {
  try {
    const ctx = await requireSession();

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!start || !end) {
      throw new ApiError(400, "start and end are required");
    }

    const range = calendarEventRangeQuerySchema.parse({ start, end });
    const occurrences = await listEventsInRange(ctx, new Date(range.start), new Date(range.end));

    return NextResponse.json(occurrences);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "calendarEvent.manage");

    const input = calendarEventCreateSchema.parse(await request.json());
    const occurrence = await createCalendarEvent(ctx, input);

    return NextResponse.json(occurrence, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
