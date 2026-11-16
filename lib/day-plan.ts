// Time maths for Today's "Plan your hours" (AI_BUILD_PLAN.md Part 0, Stage 6).
// Times are minutes after midnight in the person's own day.

export const DAY_START = 6 * 60
export const DAY_END = 23 * 60
export const SLOT_MINUTES = 30
export const DEFAULT_DURATION = 30
export const DURATIONS = [15, 30, 60, 90, 120]

export type DayBlock = {
  id: string
  kind: "task" | "event"
  title: string
  start: number
  end: number
}

// The half-hour slots a task can be placed in, as minutes after midnight.
export function daySlots() {
  return Array.from({ length: (DAY_END - DAY_START) / SLOT_MINUTES }, (_, index) => DAY_START + index * SLOT_MINUTES)
}

// "09:30" or "09:30:00" to 570. Null for anything else.
export function toMinutes(time: string | null | undefined) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "")
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

// 570 to "09:30", the format the tasks API stores.
export function toTime(minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes))
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`
}

export function clockLabel(minutes: number) {
  const hours = Math.floor(minutes / 60) % 24
  const suffix = hours < 12 ? "AM" : "PM"
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  const mins = minutes % 60
  return mins === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`
}

export function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`
}

// Other blocks that share time with this one.
export function overlapping(block: DayBlock, blocks: DayBlock[]) {
  return blocks.filter((other) => other.id !== block.id && other.start < block.end && block.start < other.end)
}

// Minutes between from and DAY_END not covered by any block.
export function freeMinutes(blocks: DayBlock[], from: number) {
  const start = Math.max(from, DAY_START)
  if (start >= DAY_END) return 0
  const covered = blocks
    .map((block) => [Math.max(block.start, start), Math.min(block.end, DAY_END)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
  let total = 0
  let cursor = start
  for (const [a, b] of covered) {
    if (a > cursor) total += a - cursor
    cursor = Math.max(cursor, b)
  }
  return total + Math.max(0, DAY_END - cursor)
}

// The slot a block starts in, so it can be drawn on that row.
export function slotOf(minutes: number) {
  return Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES
}
