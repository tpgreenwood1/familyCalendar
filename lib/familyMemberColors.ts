// `hex` mirrors the values in tailwind.config.ts -- kept alongside the Tailwind
// class names because the calendar's multi-participant colour striping (§11)
// needs real colour values for an inline `linear-gradient`, which a class name
// alone can't provide.
export const FAMILY_MEMBER_COLORS = [
  { key: "honey-bronze", label: "Honey Bronze", swatch: "bg-honey-bronze", accent: "border-honey-bronze", hex: "#f6bd60" },
  { key: "linen", label: "Linen", swatch: "bg-linen", accent: "border-linen", hex: "#f7ede2" },
  { key: "cotton-rose", label: "Cotton Rose", swatch: "bg-cotton-rose", accent: "border-cotton-rose", hex: "#f5cac3" },
  { key: "muted-teal", label: "Muted Teal", swatch: "bg-muted-teal", accent: "border-muted-teal", hex: "#84a59d" },
  { key: "light-coral", label: "Light Coral", swatch: "bg-light-coral", accent: "border-light-coral", hex: "#f28482" },
] as const;

export type FamilyMemberColorKey = (typeof FAMILY_MEMBER_COLORS)[number]["key"];

const FALLBACK = { key: "fallback", label: "Gray", swatch: "bg-gray-500", accent: "border-gray-500", hex: "#6b7280" };

export function getFamilyMemberColor(key: string) {
  return FAMILY_MEMBER_COLORS.find((c) => c.key === key) ?? FALLBACK;
}

export function isValidFamilyMemberColor(key: unknown): key is FamilyMemberColorKey {
  return typeof key === "string" && FAMILY_MEMBER_COLORS.some((c) => c.key === key);
}
