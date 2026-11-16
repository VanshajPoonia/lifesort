import { parseCsv } from "@/lib/task-import"

// Bank statement import (AI_BUILD_PLAN.md Part 0, Later). Reads common statement CSVs:
// one signed Amount column, or separate Debit/Withdrawal and Credit/Deposit columns
// (HDFC, SBI, ICICI and most others). Runs in the browser before anything is saved.

export type BankRow = { date: string; description: string; amount: number; type: "income" | "expense" }

export type BankCsv = { rows: BankRow[]; skipped: number; dayFirst: boolean; ambiguous: boolean }

export const MAX_BANK_ROWS = 2000

const DATE_HEADERS = ["date", "transaction date", "txn date", "tran date", "posting date", "value date", "value dt", "booking date"]
const TEXT_HEADERS = ["description", "narration", "details", "particulars", "memo", "payee", "remarks", "transaction details", "name"]
const AMOUNT_HEADERS = ["amount", "transaction amount", "amount (inr)"]
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawal amt.", "withdrawal amt", "withdrawal amount", "withdrawal amount (inr)", "debit amount", "dr"]
const CREDIT_HEADERS = ["credit", "deposit", "deposit amt.", "deposit amt", "deposit amount", "deposit amount (inr)", "credit amount", "cr"]
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const clean = (header: string) => header.trim().toLowerCase().replace(/\s+/g, " ")
const find = (headers: string[], names: string[]) => headers.findIndex((header) => names.includes(header))

// "1,234.50", "₹ 1,234.50 Dr", "(45.00)", "-45" to a signed number. Dr or brackets mean money out.
export function parseAmount(value: string) {
  const text = value.trim()
  if (!text) return null
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text) || /\bdr\.?$/i.test(text)
  const digits = text.replace(/[^0-9.]/g, "")
  if (!digits || !/\d/.test(digits)) return null
  const number = Number(digits)
  if (!Number.isFinite(number)) return null
  return negative ? -number : number
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

// Reads ISO, "15 Nov 2026", "15-Nov-26" and numeric dates. Numeric dates use dayFirst.
export function parseBankDate(value: string, dayFirst: boolean) {
  const text = value.trim()
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text)
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    return validDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null
  }
  match = /^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ,]+(\d{2,4})/.exec(text)
  if (match) {
    const month = MONTHS.indexOf(match[2].toLowerCase()) + 1
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])
    return month > 0 && validDate(year, month, Number(match[1])) ? `${year}-${pad(month)}-${pad(Number(match[1]))}` : null
  }
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(text)
  if (match) {
    const first = Number(match[1])
    const second = Number(match[2])
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])
    const [day, month] = dayFirst ? [first, second] : [second, first]
    return validDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null
  }
  return null
}

// Day first unless a value proves otherwise. "ambiguous" means no value could tell.
function dateOrder(values: string[]) {
  let dayFirst = false
  let monthFirst = false
  for (const value of values) {
    const match = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(value.trim())
    if (!match) continue
    if (Number(match[1]) > 12) dayFirst = true
    if (Number(match[2]) > 12) monthFirst = true
  }
  const numeric = values.some((value) => /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(value.trim()))
  return { dayFirst: !monthFirst || dayFirst, ambiguous: numeric && !dayFirst && !monthFirst }
}

export function readBankCsv(text: string, forceDayFirst?: boolean): BankCsv | { error: string } {
  const rows = parseCsv(text)
  // Statements often start with account details, so look for the header row.
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(clean)
    const hasDate = find(headers, DATE_HEADERS) >= 0
    const hasMoney = find(headers, AMOUNT_HEADERS) >= 0 || (find(headers, DEBIT_HEADERS) >= 0 && find(headers, CREDIT_HEADERS) >= 0)
    return hasDate && hasMoney
  })
  if (headerIndex < 0) return { error: "Couldn't find the date and amount columns. Try your bank's CSV or Excel-to-CSV export." }

  const headers = rows[headerIndex].map(clean)
  const dateColumn = find(headers, DATE_HEADERS)
  const textColumn = find(headers, TEXT_HEADERS)
  const amountColumn = find(headers, AMOUNT_HEADERS)
  const debitColumn = find(headers, DEBIT_HEADERS)
  const creditColumn = find(headers, CREDIT_HEADERS)
  const body = rows.slice(headerIndex + 1)

  const order = dateOrder(body.map((cells) => cells[dateColumn] ?? ""))
  const dayFirst = forceDayFirst ?? order.dayFirst

  const parsed: BankRow[] = []
  let skipped = 0
  for (const cells of body) {
    const date = parseBankDate(cells[dateColumn] ?? "", dayFirst)
    let amount: number | null = null
    if (amountColumn >= 0) {
      amount = parseAmount(cells[amountColumn] ?? "")
    } else {
      const debit = parseAmount(cells[debitColumn] ?? "")
      const credit = parseAmount(cells[creditColumn] ?? "")
      if (debit) amount = -Math.abs(debit)
      else if (credit) amount = Math.abs(credit)
    }
    if (!date || amount === null || amount === 0) {
      skipped++
      continue
    }
    parsed.push({
      date,
      description: (cells[textColumn] ?? "").trim().replace(/\s+/g, " ").slice(0, 500) || "Bank transaction",
      amount: Math.round(Math.abs(amount) * 100) / 100,
      type: amount < 0 ? "expense" : "income",
    })
  }

  return {
    rows: parsed.slice(0, MAX_BANK_ROWS),
    skipped: skipped + Math.max(0, parsed.length - MAX_BANK_ROWS),
    dayFirst,
    ambiguous: forceDayFirst === undefined && order.ambiguous,
  }
}
