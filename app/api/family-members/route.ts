import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireCan } from "@/lib/authz";
import { familyMemberCreateSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const ctx = await requireSession();

    // Adults first (matches DesignSpec.md §34's "Mum, Dad, Child 1, Child 2" example),
    // includes inactive members so the manager UI can offer "Reactivate".
    const familyMembers = await prisma.familyMember.findMany({
      where: { familyGroupId: ctx.familyGroupId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(familyMembers);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "familyMember.manage");

    const { name, color, avatar, dateOfBirth } = familyMemberCreateSchema.parse(
      await request.json()
    );
    const familyGroupId = ctx.familyGroupId;

    const existing = await prisma.familyMember.findUnique({
      where: { familyGroupId_name: { familyGroupId, name } },
    });
    if (existing) {
      throw new ApiError(409, "That name is already in use");
    }

    // Always CHILD -- adults get their FamilyMember card via signup/invite, not this form
    // (see app/api/family/setup/route.ts).
    const familyMember = await prisma.familyMember.create({
      data: { name, color, avatar, dateOfBirth, role: "CHILD", familyGroupId },
    });

    return NextResponse.json(familyMember, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
