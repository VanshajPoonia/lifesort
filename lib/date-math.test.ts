import { describe, expect, it } from "vitest"

import { addDaysToDate, addMonthsToDate, daysBetweenDates } from "@/lib/date-math"

describe("addDaysToDate", () => {
  it("adds days within the same month", () => {
    expect(addDaysToDate("2026-08-01", 1)).toBe("2026-08-02")
  })

  it("rolls over a month boundary", () => {
    expect(addDaysToDate("2026-08-31", 1)).toBe("2026-09-01")
  })

  it("rolls over a year boundary", () => {
    expect(addDaysToDate("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("supports negative offsets", () => {
    expect(addDaysToDate("2026-08-01", -1)).toBe("2026-07-31")
  })
})

describe("addMonthsToDate", () => {
  it("adds whole months, keeping the same day", () => {
    expect(addMonthsToDate("2026-08-01", 1)).toBe("2026-09-01")
  })

  it("clamps to the target month's last day instead of overflowing (Jan 31 + 1 month)", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28") // 2026 is not a leap year
  })

  it("clamps Feb 29 on a leap year to Feb 28 one year later (non-leap)", () => {
    expect(addMonthsToDate("2028-02-29", 12)).toBe("2029-02-28")
  })

  it("rolls over a year boundary", () => {
    expect(addMonthsToDate("2026-12-15", 1)).toBe("2027-01-15")
  })
})

describe("daysBetweenDates", () => {
  it("returns a positive gap when b is after a", () => {
    expect(daysBetweenDates("2026-08-01", "2026-08-05")).toBe(4)
  })

  it("returns a negative gap when b is before a", () => {
    expect(daysBetweenDates("2026-08-05", "2026-08-01")).toBe(-4)
  })

  it("returns 0 for the same date", () => {
    expect(daysBetweenDates("2026-08-01", "2026-08-01")).toBe(0)
  })
})
