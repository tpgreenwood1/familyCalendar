import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const config = await prisma.appConfig.findUnique({
    where: { key: "app_label" },
  });

  if (!config) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ label: config.value });
}
