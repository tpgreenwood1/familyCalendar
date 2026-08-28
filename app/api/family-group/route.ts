import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name } = await request.json();
  const normalized = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

  if (!normalized) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const familyGroup = await prisma.familyGroup.update({
    where: { id: session.user.familyGroupId },
    data: { name: normalized },
  });

  return NextResponse.json({ name: familyGroup.name });
}
