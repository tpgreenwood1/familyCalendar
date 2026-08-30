export const FAMILY_MEMBER_AVATARS = [
  { key: "star", label: "Star", emoji: "⭐" },
  { key: "cat", label: "Cat", emoji: "🐱" },
  { key: "dog", label: "Dog", emoji: "🐶" },
  { key: "bear", label: "Bear", emoji: "🐻" },
  { key: "unicorn", label: "Unicorn", emoji: "🦄" },
  { key: "rocket", label: "Rocket", emoji: "🚀" },
  { key: "sun", label: "Sun", emoji: "☀️" },
  { key: "flower", label: "Flower", emoji: "🌸" },
] as const;

export type FamilyMemberAvatarKey = (typeof FAMILY_MEMBER_AVATARS)[number]["key"];

const FALLBACK = { key: "star", label: "Star", emoji: "⭐" };

export function getFamilyMemberAvatar(key: string) {
  return FAMILY_MEMBER_AVATARS.find((a) => a.key === key) ?? FALLBACK;
}

export function isValidFamilyMemberAvatar(key: unknown): key is FamilyMemberAvatarKey {
  return typeof key === "string" && FAMILY_MEMBER_AVATARS.some((a) => a.key === key);
}
