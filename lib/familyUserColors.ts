export const FAMILY_USER_COLORS = [
  { key: "honey-bronze", label: "Honey Bronze", swatch: "bg-honey-bronze", accent: "border-honey-bronze" },
  { key: "linen", label: "Linen", swatch: "bg-linen", accent: "border-linen" },
  { key: "cotton-rose", label: "Cotton Rose", swatch: "bg-cotton-rose", accent: "border-cotton-rose" },
  { key: "muted-teal", label: "Muted Teal", swatch: "bg-muted-teal", accent: "border-muted-teal" },
  { key: "light-coral", label: "Light Coral", swatch: "bg-light-coral", accent: "border-light-coral" },
] as const;

export type FamilyUserColorKey = (typeof FAMILY_USER_COLORS)[number]["key"];

const FALLBACK = { key: "fallback", label: "Gray", swatch: "bg-gray-500", accent: "border-gray-500" };

export function getFamilyUserColor(key: string) {
  return FAMILY_USER_COLORS.find((c) => c.key === key) ?? FALLBACK;
}

export function isValidFamilyUserColor(key: unknown): key is FamilyUserColorKey {
  return typeof key === "string" && FAMILY_USER_COLORS.some((c) => c.key === key);
}
