import { NextResponse } from "next/server";
import { fetchWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const weather = await fetchWeather();
    return NextResponse.json(weather);
  } catch {
    return NextResponse.json({ error: "Could not load weather" }, { status: 502 });
  }
}
