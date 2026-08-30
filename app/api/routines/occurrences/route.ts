import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { dateOnlySchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api-errors";
import { listRoutineOccurrences } from "@/lib/routines";

export async function GET(request: Request) {
  try {
    const ctx = await requireSession();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? dateOnlySchema.parse(dateParam) : undefined;

    const occurrences = await listRoutineOccurrences(ctx, date);

    return NextResponse.json(occurrences);
  } catch (error) {
    return errorResponse(error);
  }
}
