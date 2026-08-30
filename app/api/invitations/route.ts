import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { createInvitation } from "@/lib/invitations";
import { errorResponse } from "@/lib/api-errors";

export async function POST() {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "invitation.create");

    const code = await createInvitation(ctx.familyGroupId, ctx.user.id);

    return NextResponse.json({ code }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
