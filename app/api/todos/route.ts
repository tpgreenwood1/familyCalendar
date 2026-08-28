import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const todos = await prisma.todo.findMany({
    where: { familyUser: { familyGroupId: session.user.familyGroupId } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(todos);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text, userId } = await request.json();

  const normalized = typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";

  if (!normalized) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (typeof userId !== "number" || !Number.isInteger(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const owner = await prisma.familyUser.findFirst({
    where: { id: userId, familyGroupId: session.user.familyGroupId },
  });
  if (!owner) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const todo = await prisma.todo.create({
    data: { text: normalized, userId },
  });

  return NextResponse.json(todo, { status: 201 });
}
