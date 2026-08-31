import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { errorResponse } from "@/lib/api-errors";
import { listRoutineOccurrencesForWeek } from "@/lib/routines";

export async function GET() {
  try {
    const ctx = await requireSession();

    const { weekStart, occurrences } = await listRoutineOccurrencesForWeek(ctx);

    return NextResponse.json({ weekStart, occurrences });
  } catch (error) {
    return errorResponse(error);
  }
}
