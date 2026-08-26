let _cache: string[] | null = null

// Lazy + cached: only ever called client-side (from useEffect in
// TimezoneField), since Intl.supportedValuesOf can differ between the
// server's and browser's ICU data, and computing it during SSR risks a
// hydration mismatch.
export function getTimezones(): string[] {
  if (!_cache) _cache = Intl.supportedValuesOf('timeZone').sort()
  return _cache
}

export function isValidTimezone(tz: string): boolean {
  return getTimezones().includes(tz)
}
