import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

function randomCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

export async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    const existing = await prisma.familyGroup.findUnique({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique invite code");
}
