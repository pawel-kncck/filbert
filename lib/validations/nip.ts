/** Strips separators (dashes, spaces) from a user-entered NIP. */
export function normalizeNip(nip: string): string {
  return nip.replace(/[-\s]/g, '')
}

/** True when the value normalizes to exactly 10 digits. */
export function isValidNip(nip: string): boolean {
  return /^\d{10}$/.test(normalizeNip(nip))
}
