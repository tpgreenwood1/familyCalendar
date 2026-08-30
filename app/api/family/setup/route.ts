import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import { familySetupSchema } from "@/lib/schemas";
import { createInvitation, consumeInvitation, assertInviteAttemptAllowed } from "@/lib/invitations";
import { FAMILY_MEMBER_COLORS } from "@/lib/familyMemberColors";
import { ApiError, errorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// DesignSpec.md §6.1 treats "sign in/up" and "family creation/membership" as separate
// migration steps — a Better Auth session can validly exist with no family yet (e.g. the
// join step below failed and the user is retrying from /family-setup).
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "unauthorized");

    const existingMembership = await getFamilyMembership(user.id);
    if (existingMembership) {
      throw new ApiError(409, "You already belong to a family");
    }

    const body = familySetupSchema.parse(await request.json());

    let familyGroupId: number;
    let inviteCode: string | undefined;

    if (body.mode === "create") {
      const familyGroup = await prisma.familyGroup.create({
        data: { name: body.familyGroupName },
      });
      familyGroupId = familyGroup.id;
    } else {
      await assertInviteAttemptAllowed(user.email);
      const result = await consumeInvitation(body.inviteCode, user.id);
      familyGroupId = result.familyGroupId;
    }

    // Every adult gets both a FamilyMembership (auth) and a linked FamilyMember card (the
    // household roster, DesignSpec.md §5.3/§34) -- otherwise they'd sign up but never show
    // up alongside their family's children. Colour is picked round-robin from the palette
    // just for a bit of visual variety between family members.
    const existingMemberCount = await prisma.familyMember.count({ where: { familyGroupId } });
    const color = FAMILY_MEMBER_COLORS[existingMemberCount % FAMILY_MEMBER_COLORS.length].key;

    await prisma.$transaction([
      prisma.familyMembership.create({ data: { userId: user.id, familyGroupId } }),
      prisma.familyMember.create({
        data: { name: user.name, color, role: "ADULT", linkedUserId: user.id, familyGroupId },
      }),
    ]);

    if (body.mode === "create") {
      // So a brand-new family isn't left with zero outstanding invites until someone
      // visits the dashboard and clicks "generate" — matches the old always-has-a-code UX.
      inviteCode = await createInvitation(familyGroupId, user.id);
    }

    return NextResponse.json({ familyGroupId, inviteCode }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
