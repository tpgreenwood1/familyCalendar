"use client";

import { useEffect, useState } from "react";
import type { WeatherSnapshot } from "@/lib/weather";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/weather");
        if (!res.ok) throw new Error();
        const body = (await res.json()) as WeatherSnapshot;
        if (!cancelled) {
          setWeather(body);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) return null;
  if (!weather) {
    return <p className="text-sm text-gray-500">Loading weather…</p>;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-900 px-6 py-4">
      <span className="text-4xl">{weather.icon}</span>
      <div>
        <p className="text-2xl text-white">{weather.tempC}°C</p>
        <p className="text-sm text-gray-400">{weather.description}</p>
      </div>
    </div>
  );
}
