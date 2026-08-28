import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidFamilyUserColor } from "@/lib/familyUserColors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const familyGroupId = session.user.familyGroupId;

  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const owned = await prisma.familyUser.findFirst({ where: { id, familyGroupId } });
  if (!owned) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { name, color } = await request.json();
  const data: { name?: string; color?: string } = {};

  if (name !== undefined) {
    const normalized = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
    if (!normalized) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const existing = await prisma.familyUser.findUnique({
      where: { familyGroupId_name: { familyGroupId, name: normalized } },
    });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "That name is already in use" }, { status: 409 });
    }

    data.name = normalized;
  }

  if (color !== undefined) {
    if (!isValidFamilyUserColor(color)) {
      return NextResponse.json({ error: "color is required" }, { status: 400 });
    }
    data.color = color;
  }

  const familyUser = await prisma.familyUser.update({
    where: { id },
    data,
  });

  return NextResponse.json(familyUser);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const familyGroupId = session.user.familyGroupId;

  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const owned = await prisma.familyUser.findFirst({ where: { id, familyGroupId } });
  if (!owned) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.familyUser.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
