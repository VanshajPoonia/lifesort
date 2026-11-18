// Browser-safe capture helpers (lib/capture.ts uses node:crypto).

// The display number in Settings, as digits for a wa.me link.
export function waMeLink(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
}
