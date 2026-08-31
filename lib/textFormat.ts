/** Normalizes user-entered text to capitalized casing (first letter upper, rest lower)
 * regardless of how it was typed, so display stays consistent everywhere it's rendered. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
