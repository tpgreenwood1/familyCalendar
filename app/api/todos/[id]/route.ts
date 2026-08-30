import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireCan } from "@/lib/authz";
import { todoUpdateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "todo.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const owned = await prisma.todo.findFirst({
      where: { id, familyMember: { familyGroupId: ctx.familyGroupId } },
    });
    if (!owned) {
      throw new ApiError(404, "not found");
    }

    const { text, completed, priority } = todoUpdateSchema.parse(await request.json());

    const todo = await prisma.todo.update({
      where: { id },
      data: { text, completed, priority },
    });

    publishDomainEvent({
      type: completed !== undefined ? "TODO_COMPLETED" : "TODO_UPDATED",
      familyGroupId: ctx.familyGroupId,
    });

    return NextResponse.json(todo);
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
    requireCan(ctx, "todo.manage");

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const owned = await prisma.todo.findFirst({
      where: { id, familyMember: { familyGroupId: ctx.familyGroupId } },
    });
    if (!owned) {
      throw new ApiError(404, "not found");
    }

    await prisma.todo.delete({ where: { id } });

    publishDomainEvent({ type: "TODO_DELETED", familyGroupId: ctx.familyGroupId });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
