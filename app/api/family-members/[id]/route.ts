import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireCan } from "@/lib/authz";
import { familyMemberUpdateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "familyMember.manage");
    const familyGroupId = ctx.familyGroupId;

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const target = await prisma.familyMember.findFirst({ where: { id, familyGroupId } });
    if (!target) {
      throw new ApiError(404, "not found");
    }

    const body = familyMemberUpdateSchema.parse(await request.json());

    // Adults can only edit their own card (name/avatar/colour) -- DesignSpec.md §34's
    // "manage adult membership" (editing/removing *other* adults) is out of scope this
    // phase. Children can be freely managed by any adult in the family.
    if (target.role === "ADULT") {
      if (target.linkedUserId !== ctx.user.id) {
        throw new ApiError(403, "forbidden");
      }
      if (body.active !== undefined) {
        throw new ApiError(403, "forbidden");
      }
    }

    const { name, color, avatar, dateOfBirth, active } = body;
    const data: {
      name?: string;
      color?: string;
      avatar?: string;
      dateOfBirth?: Date | null;
      active?: boolean;
    } = {};

    if (name !== undefined) {
      const existing = await prisma.familyMember.findUnique({
        where: { familyGroupId_name: { familyGroupId, name } },
      });
      if (existing && existing.id !== id) {
        throw new ApiError(409, "That name is already in use");
      }
      data.name = name;
    }

    if (color !== undefined) data.color = color;
    if (avatar !== undefined) data.avatar = avatar;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth;
    if (active !== undefined) data.active = active;

    const familyMember = await prisma.familyMember.update({
      where: { id },
      data,
    });

    return NextResponse.json(familyMember);
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
    requireCan(ctx, "familyMember.manage");
    const familyGroupId = ctx.familyGroupId;

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "invalid id");
    }

    const target = await prisma.familyMember.findFirst({ where: { id, familyGroupId } });
    if (!target) {
      throw new ApiError(404, "not found");
    }

    // Removing an adult's FamilyMember card is "manage adult membership" -- deferred to a
    // later phase (see plan). Only children can be removed here.
    if (target.role === "ADULT") {
      throw new ApiError(403, "forbidden");
    }

    await prisma.familyMember.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
