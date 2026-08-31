"use client";

import { useEffect, useState } from "react";

export default function ClockWidget() {
  // Starts null so the server-rendered markup has no time in it, then fills in on mount —
  // avoids a hydration mismatch between server render time and client render time.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return <div className="h-[88px]" />;

  const day = now.toLocaleDateString(undefined, { weekday: "long" });
  const date = now.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-2xl text-gray-300">
        {day}, {date}
      </p>
      <p className="text-5xl font-light tracking-widest text-white">{time}</p>
    </div>
  );
}
