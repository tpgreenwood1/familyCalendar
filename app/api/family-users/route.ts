import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidFamilyUserColor } from "@/lib/familyUserColors";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const familyUsers = await prisma.familyUser.findMany({
    where: { familyGroupId: session.user.familyGroupId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(familyUsers);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, color } = await request.json();

  const normalized = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

  if (!normalized) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!isValidFamilyUserColor(color)) {
    return NextResponse.json({ error: "color is required" }, { status: 400 });
  }

  const familyGroupId = session.user.familyGroupId;

  const existing = await prisma.familyUser.findUnique({
    where: { familyGroupId_name: { familyGroupId, name: normalized } },
  });
  if (existing) {
    return NextResponse.json({ error: "That name is already in use" }, { status: 409 });
  }

  const familyUser = await prisma.familyUser.create({
    data: { name: normalized, color, familyGroupId },
  });

  return NextResponse.json(familyUser, { status: 201 });
}
