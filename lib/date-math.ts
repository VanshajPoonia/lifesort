// Shared UTC-explicit date-only ("YYYY-MM-DD") arithmetic. Always operate in
// UTC here, never via `new Date(dateStr + "T00:00:00")` (local time) followed
// by a UTC read (`.toISOString()`) -- that combination silently shifts the
// result by a day on any non-UTC server. See AI_DECISIONS.md.

export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// Clamps to the target month's last day instead of letting JS Date overflow
// into the following month (e.g. Jan 31 + 1 month lands on Feb 28, not Mar 3).
export function addMonthsToDate(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const targetIndex = (m - 1) + months
  const targetYear = y + Math.floor(targetIndex / 12)
  const targetMonth = ((targetIndex % 12) + 12) % 12
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const dt = new Date(Date.UTC(targetYear, targetMonth, Math.min(d, daysInTargetMonth)))
  return dt.toISOString().slice(0, 10)
}

export function daysBetweenDates(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}
