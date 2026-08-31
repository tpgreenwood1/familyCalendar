"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import type { SpecialOccasionDTO } from "@/lib/specialOccasions";
import { SPECIAL_OCCASIONS_QUERY_KEY, fetchSpecialOccasions } from "@/components/SpecialOccasionList";

function occasionIcon(occasion: SpecialOccasionDTO): string {
  if (occasion.isSomber) return "🕊️";
  return occasion.type === "BIRTHDAY" ? "🎂" : "💍";
}

function occasionLabel(occasion: SpecialOccasionDTO): string {
  const { isToday, isSomber, daysUntil, computedYears, type } = occasion;
  if (isToday && isSomber) {
    return `Today marks ${computedYears} years since ${occasion.title}`;
  }
  if (isToday) {
    return type === "BIRTHDAY"
      ? `It's ${occasion.title} today! (turning ${computedYears})`
      : `It's ${occasion.title} today! (${computedYears} years)`;
  }
  return `${occasion.title} in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
}

export default function SpecialOccasionCard({
  initialOccasions,
}: {
  initialOccasions: SpecialOccasionDTO[];
}) {
  const { data: occasions = initialOccasions } = useQuery({
    queryKey: SPECIAL_OCCASIONS_QUERY_KEY,
    queryFn: fetchSpecialOccasions,
    initialData: initialOccasions,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const upcoming = occasions.filter((o) => o.daysUntil <= 7);

  return (
    <div className="mb-8 rounded-xl border-t-4 border-amber-500 bg-gray-900 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-2xl font-medium text-white">Special Occasions</h3>
        <Link href="/occasions" className="text-sm text-gray-400 hover:text-white">
          Full list →
        </Link>
      </div>
      {upcoming.length === 0 && (
        <p className="text-sm text-gray-500">No occasions in the next 7 days.</p>
      )}
      <ul>
        {upcoming.map((occasion) => (
          <li
            key={occasion.id}
            className="flex items-center gap-3 border-b border-gray-800 py-3 last:border-none"
          >
            <span className="text-xl">{occasionIcon(occasion)}</span>
            <span className="flex-1 truncate text-base text-white">{occasionLabel(occasion)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
