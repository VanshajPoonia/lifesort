import { describe, expect, it } from "vitest"

import { clockLabel, daySlots, durationLabel, freeMinutes, overlapping, slotOf, toMinutes, toTime, type DayBlock } from "./day-plan"

const block = (id: string, start: number, end: number, kind: DayBlock["kind"] = "task"): DayBlock => ({ id, kind, title: id, start, end })

describe("time conversions", () => {
  it("reads HH:MM and HH:MM:SS", () => {
    expect(toMinutes("09:30")).toBe(570)
    expect(toMinutes("18:05:00")).toBe(1085)
    expect(toMinutes(null)).toBeNull()
    expect(toMinutes("25:00")).toBeNull()
  })

  it("writes HH:MM", () => {
    expect(toTime(570)).toBe("09:30")
    expect(toTime(0)).toBe("00:00")
  })

  it("labels clock times and durations", () => {
    expect(clockLabel(540)).toBe("9 AM")
    expect(clockLabel(750)).toBe("12:30 PM")
    expect(durationLabel(30)).toBe("30 min")
    expect(durationLabel(90)).toBe("1.5 h")
    expect(durationLabel(120)).toBe("2 h")
  })
})

describe("slots", () => {
  it("runs from 6 AM to 10:30 PM in half hours", () => {
    const slots = daySlots()
    expect(slots[0]).toBe(360)
    expect(slots.at(-1)).toBe(1350)
    expect(slots).toHaveLength(34)
    expect(slotOf(585)).toBe(570)
  })
})

describe("overlapping", () => {
  it("finds blocks that share time, not ones that only touch", () => {
    const blocks = [block("a", 540, 600), block("b", 570, 630, "event"), block("c", 600, 660)]
    expect(overlapping(blocks[0], blocks).map((item) => item.id)).toEqual(["b"])
  })
})

describe("freeMinutes", () => {
  it("counts free time until the end of the day, merging overlaps", () => {
    const blocks = [block("a", 1200, 1260), block("b", 1230, 1290, "event")]
    // 8 PM to 11 PM is 180 minutes, minus 8:00 to 9:30 PM.
    expect(freeMinutes(blocks, 1200)).toBe(90)
  })

  it("is zero after the day ends", () => {
    expect(freeMinutes([], 23 * 60 + 10)).toBe(0)
  })
})
