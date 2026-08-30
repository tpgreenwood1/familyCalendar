import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { routineCreateSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api-errors";
import { listRoutines, createRoutine } from "@/lib/routines";

export async function GET() {
  try {
    const ctx = await requireSession();
    const routines = await listRoutines(ctx);
    return NextResponse.json(routines);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "routine.manage");

    const input = routineCreateSchema.parse(await request.json());
    const routine = await createRoutine(ctx, input);

    return NextResponse.json(routine, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
