import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireCan } from "@/lib/authz";
import { familyGroupUpdateSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";
import { assertAlbumBelongsToFamily } from "@/lib/photos";
import type { FamilyGroup } from "@prisma/client";

function toFamilyGroupDTO(familyGroup: FamilyGroup) {
  return {
    name: familyGroup.name,
    holidayMode: familyGroup.holidayMode,
    screensaverEnabled: familyGroup.screensaverEnabled,
    screensaverAlbumId: familyGroup.screensaverAlbumId,
    screensaverIntervalSeconds: familyGroup.screensaverIntervalSeconds,
    screensaverIdleSeconds: familyGroup.screensaverIdleSeconds,
  };
}

export async function GET() {
  try {
    const ctx = await requireSession();

    const familyGroup = await prisma.familyGroup.findUniqueOrThrow({ where: { id: ctx.familyGroupId } });

    return NextResponse.json(toFamilyGroupDTO(familyGroup));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "family.update");

    const input = familyGroupUpdateSchema.parse(await request.json());

    // A family may only point its screensaver at its own album -- never trust the id alone.
    if (input.screensaverAlbumId != null) {
      await assertAlbumBelongsToFamily(ctx.familyGroupId, input.screensaverAlbumId);
    }

    const familyGroup = await prisma.familyGroup.update({
      where: { id: ctx.familyGroupId },
      data: input,
    });

    publishDomainEvent({ type: "FAMILY_GROUP_UPDATED", familyGroupId: ctx.familyGroupId });

    return NextResponse.json(toFamilyGroupDTO(familyGroup));
  } catch (error) {
    return errorResponse(error);
  }
}
