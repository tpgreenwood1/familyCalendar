import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUniqueInviteCode } from "@/lib/inviteCode";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json();

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
  }

  let familyGroupId: number;

  if (body.mode === "create") {
    const name =
      typeof body.familyGroupName === "string"
        ? body.familyGroupName.trim().replace(/\s+/g, " ")
        : "";
    if (!name) {
      return NextResponse.json({ error: "Family name is required" }, { status: 400 });
    }
    const inviteCode = await generateUniqueInviteCode();
    const group = await prisma.familyGroup.create({ data: { name, inviteCode } });
    familyGroupId = group.id;
  } else if (body.mode === "join") {
    const code = typeof body.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";
    const group = code ? await prisma.familyGroup.findUnique({ where: { inviteCode: code } }) : null;
    if (!group) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
    }
    familyGroupId = group.id;
  } else {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({ data: { email, passwordHash, familyGroupId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
