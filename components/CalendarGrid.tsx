"use client";

import type { CalendarOccurrenceDTO } from "@/lib/calendar";
import { calendarEventBackground } from "@/lib/calendarEventColor";
import { getFamilyMemberAvatar } from "@/lib/familyMemberAvatars";

const HOUR_HEIGHT = 48; // px
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function overlapsDay(occ: CalendarOccurrenceDTO, day: Date): boolean {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return new Date(occ.startAt) < dayEnd && new Date(occ.endAt) > dayStart;
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

/**
 * Day/multi-day/week are all the same engine (DesignSpec.md §10.4) -- just a
 * different number of `days` columns. Renders in the browser's local time, on
 * the assumption (true for a household calendar/wall display) that whoever is
 * looking at it is in the same timezone the events were entered in.
 */
export default function CalendarGrid({
  days,
  occurrences,
  onSlotClick,
  onEventClick,
}: {
  days: Date[];
  occurrences: CalendarOccurrenceDTO[];
  onSlotClick: (date: Date) => void;
  onEventClick: (occurrence: CalendarOccurrenceDTO) => void;
}) {
  const today = new Date();
  const gridTemplateColumns = `56px repeat(${days.length}, minmax(0, 1fr))`;

  function chipBackground(occ: CalendarOccurrenceDTO): string {
    return calendarEventBackground(occ.participants.map((p) => p.color));
  }

  function renderEventChip(occ: CalendarOccurrenceDTO, style: React.CSSProperties) {
    return (
      <button
        key={`${occ.eventId}-${occ.startAt}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEventClick(occ);
        }}
        style={{ background: chipBackground(occ), ...style }}
        className="absolute left-1 right-1 overflow-hidden rounded-lg px-2 py-1 text-left text-xs font-medium text-gray-900 shadow"
      >
        <div className="truncate">{occ.title}</div>
        <div className="flex gap-0.5">
          {occ.participants.map((p) => (
            <span key={p.id}>{getFamilyMemberAvatar(p.avatar).emoji}</span>
          ))}
        </div>
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl bg-gray-900">
      <div className="grid border-b border-gray-800" style={{ gridTemplateColumns }}>
        <div />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col items-center gap-0.5 py-3 ${
                isToday ? "text-white" : "text-gray-400"
              }`}
            >
              <span className="text-xs uppercase tracking-wide">
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className={`text-lg ${isToday ? "font-semibold text-honey-bronze" : ""}`}>
                {day.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid border-b border-gray-800" style={{ gridTemplateColumns }}>
        <div className="py-2 text-right text-[10px] text-gray-500">All day</div>
        {days.map((day) => (
          <div key={day.toISOString()} className="flex flex-col gap-1 p-1">
            {occurrences
              .filter((occ) => occ.allDay && overlapsDay(occ, day))
              .map((occ) => (
                <button
                  key={`${occ.eventId}-${occ.startAt}-allday`}
                  type="button"
                  onClick={() => onEventClick(occ)}
                  style={{ background: chipBackground(occ) }}
                  className="truncate rounded px-2 py-1 text-left text-xs font-medium text-gray-900"
                >
                  {occ.title}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="max-h-[65vh] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns }}>
          <div>
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="border-t border-gray-800 pr-2 text-right text-[10px] text-gray-500"
              >
                {formatHourLabel(hour)}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const timedEvents = occurrences.filter((occ) => !occ.allDay && overlapsDay(occ, day));
            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-gray-800"
                style={{ height: HOUR_HEIGHT * 24 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const offsetY = e.clientY - rect.top;
                  const rawMinutes = (offsetY / (HOUR_HEIGHT * 24)) * 1440;
                  const minutes = Math.round(rawMinutes / 30) * 30;
                  const clicked = new Date(day);
                  clicked.setHours(0, minutes, 0, 0);
                  onSlotClick(clicked);
                }}
              >
                {HOURS.map((hour) => (
                  <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-t border-gray-800" />
                ))}
                {timedEvents.map((occ) => {
                  const start = new Date(occ.startAt);
                  const end = new Date(occ.endAt);
                  const top = (minutesFromMidnight(start) / 1440) * (HOUR_HEIGHT * 24);
                  const height = Math.max(
                    20,
                    ((end.getTime() - start.getTime()) / 60000 / 1440) * (HOUR_HEIGHT * 24)
                  );
                  return renderEventChip(occ, { top, height });
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
