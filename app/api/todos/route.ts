import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireCan } from "@/lib/authz";
import { todoCreateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";

export async function GET() {
  try {
    const ctx = await requireSession();

    const todos = await prisma.todo.findMany({
      where: { familyMember: { familyGroupId: ctx.familyGroupId } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(todos);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "todo.manage");

    const { text, userId, priority } = todoCreateSchema.parse(await request.json());

    const owner = await prisma.familyMember.findFirst({
      where: { id: userId, familyGroupId: ctx.familyGroupId },
    });
    if (!owner) {
      throw new ApiError(400, "userId is required");
    }

    const todo = await prisma.todo.create({
      data: { text, userId, priority: priority ?? false },
    });

    publishDomainEvent({ type: "TODO_CREATED", familyGroupId: ctx.familyGroupId });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
