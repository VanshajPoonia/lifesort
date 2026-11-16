import { describe, expect, it } from "vitest"

import { parseAmount, parseBankDate, readBankCsv, type BankCsv } from "./bank-import"

const ok = (value: ReturnType<typeof readBankCsv>) => {
  if ("error" in value) throw new Error(value.error)
  return value as BankCsv
}

describe("parseAmount", () => {
  it("reads signs, Dr, brackets, commas and currency", () => {
    expect(parseAmount("1,234.50")).toBe(1234.5)
    expect(parseAmount("₹ 1,234.50 Dr")).toBe(-1234.5)
    expect(parseAmount("(45.00)")).toBe(-45)
    expect(parseAmount("-45")).toBe(-45)
    expect(parseAmount("")).toBeNull()
    expect(parseAmount("n/a")).toBeNull()
  })
})

describe("parseBankDate", () => {
  it("reads ISO, month names and numeric dates in either order", () => {
    expect(parseBankDate("2026-11-05", true)).toBe("2026-11-05")
    expect(parseBankDate("15 Nov 2026", true)).toBe("2026-11-15")
    expect(parseBankDate("05-Nov-26", true)).toBe("2026-11-05")
    expect(parseBankDate("05/11/26", true)).toBe("2026-11-05")
    expect(parseBankDate("05/11/2026", false)).toBe("2026-05-11")
    expect(parseBankDate("31/02/2026", true)).toBeNull()
  })
})

describe("readBankCsv", () => {
  it("reads an HDFC-style statement after its preamble", () => {
    const csv = [
      "HDFC BANK Ltd,,,,,,",
      "Statement of account,,,,,,",
      "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
      "13/11/26,UPI-SWIGGY,0001,13/11/26,450.00,,52000.00",
      "14/11/26,SALARY NOV,0002,14/11/26,,85000.00,137000.00",
      "15/11/26,Opening balance note,,,,,",
    ].join("\n")
    const result = ok(readBankCsv(csv))
    expect(result.dayFirst).toBe(true)
    expect(result.ambiguous).toBe(false)
    expect(result.skipped).toBe(1)
    expect(result.rows).toEqual([
      { date: "2026-11-13", description: "UPI-SWIGGY", amount: 450, type: "expense" },
      { date: "2026-11-14", description: "SALARY NOV", amount: 85000, type: "income" },
    ])
  })

  it("reads one signed amount column", () => {
    const result = ok(readBankCsv("Transaction Date,Description,Amount\n2026-11-02,Coffee,-120\n2026-11-03,Refund,300\n"))
    expect(result.rows.map((row) => [row.type, row.amount])).toEqual([
      ["expense", 120],
      ["income", 300],
    ])
  })

  it("says when numeric dates could go either way, and lets the person choose", () => {
    const csv = "Date,Description,Debit,Credit\n03/04/2026,Rent,15000,\n"
    const guessed = ok(readBankCsv(csv))
    expect(guessed).toMatchObject({ ambiguous: true, dayFirst: true })
    expect(guessed.rows[0].date).toBe("2026-04-03")
    expect(ok(readBankCsv(csv, false)).rows[0].date).toBe("2026-03-04")
  })

  it("explains a file it can't use", () => {
    expect(readBankCsv("Foo,Bar\n1,2\n")).toHaveProperty("error")
  })
})
