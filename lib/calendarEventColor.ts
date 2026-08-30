import { getFamilyMemberColor } from "@/lib/familyMemberColors";

/**
 * DesignSpec.md §11: an event's colour is derived from its participants, never
 * stored on the event itself, so changing a member's colour updates every event
 * they're in automatically. One participant -> solid colour. Multiple -> an equal
 * striped gradient.
 */
export function calendarEventBackground(participantColorKeys: string[]): string {
  const hexes = participantColorKeys.map((key) => getFamilyMemberColor(key).hex);

  if (hexes.length === 0) return getFamilyMemberColor("fallback").hex;
  if (hexes.length === 1) return hexes[0];

  const stops = hexes.map((hex, i) => {
    const start = (i / hexes.length) * 100;
    const end = ((i + 1) / hexes.length) * 100;
    return `${hex} ${start}% ${end}%`;
  });
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}
