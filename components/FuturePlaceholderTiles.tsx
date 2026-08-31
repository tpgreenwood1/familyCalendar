const PLACEHOLDERS = [
  { icon: "⭐", label: "Rewards" },
  { icon: "🍽", label: "Meal Planning" },
];

/** Visual-only "coming soon" tiles per DesignSpec.md §42 — no backend, not interactive. */
export default function FuturePlaceholderTiles({ large = false }: { large?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${large ? "gap-6" : ""}`}>
      {PLACEHOLDERS.map(({ icon, label }) => (
        <div
          key={label}
          aria-disabled="true"
          className={`flex items-center gap-3 rounded-2xl border-t-4 border-gray-700 bg-gray-900/50 text-gray-600 ${
            large ? "p-6" : "p-4"
          }`}
        >
          <span className={large ? "text-4xl" : "text-2xl"}>{icon}</span>
          <div>
            <span className={`block font-medium ${large ? "text-2xl" : "text-base"}`}>{label}</span>
            <span className={large ? "text-base" : "text-xs"}>Coming soon</span>
          </div>
        </div>
      ))}
    </div>
  );
}
