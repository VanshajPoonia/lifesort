import { z } from "zod"

import { addDaysToDate } from "@/lib/date-math"

// Photo to Vault (AI_BUILD_PLAN.md Part 0, Stage 4): the AI reads a photo of a bill,
// policy, warranty or ID and drafts the records; the person checks them before saving.

export const VAULT_CATEGORIES = [
  "documents", "subscriptions", "warranty", "insurance",
  "vehicle", "home", "medical", "education", "work", "other",
] as const

export const PHOTO_KINDS = ["bill", "receipt", "policy", "warranty", "id", "subscription", "other"] as const

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024
export const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
export const RENEWAL_LEAD_DAYS = 14

// The AI's output schema. Dates and amounts stay loose here; cleanDraft checks them.
export const photoDraftSchema = z.object({
  kind: z.enum(PHOTO_KINDS),
  title: z.string().trim().min(1).max(120),
  vault_category: z.enum(VAULT_CATEGORIES),
  issuer: z.string().trim().max(120).nullable(),
  summary: z.string().trim().max(300).nullable(),
  reference: z.string().trim().max(80).nullable(),
  document_date: z.string().nullable(),
  start_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  renewal_date: z.string().nullable(),
  due_date: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().trim().max(3).nullable(),
  due_action: z.string().trim().max(120).nullable(),
})

export type PhotoDraftRaw = z.infer<typeof photoDraftSchema>

export type PhotoDraft = {
  kind: (typeof PHOTO_KINDS)[number]
  title: string
  category: (typeof VAULT_CATEGORIES)[number]
  issuer: string | null
  summary: string | null
  reference: string | null
  documentDate: string | null
  startDate: string | null
  expiryDate: string | null
  renewalDate: string | null
  dueDate: string | null
  amount: number | null
  currency: string | null
  dueAction: string | null
}

export function buildPhotoPrompt(today: string) {
  return `This is a photo someone took to file away: a bill, receipt, insurance policy, warranty, ID card, subscription or similar.
Today is ${today}. Read only what is printed on it.

Fill in:
- kind: what it is.
- title: a short plain name, like "Electricity bill, November" or "Car insurance (HDFC Ergo)". No emojis.
- vault_category: the best fit.
- issuer: the company or office that issued it, or null.
- summary: one or two plain sentences on what it is and anything important, or null.
- reference: a policy, account or invoice number if printed, or null. Never an ID card's own number, a password or a PIN.
- document_date: the date it was issued or the purchase date, or null.
- start_date, expiry_date, renewal_date: cover or validity dates, or null.
- due_date: when a payment or action is due, or null.
- amount: the total to pay or the amount paid, as a plain number, or null.
- currency: a 3-letter code like INR or USD, or null.
- due_action: if something is due, a short task starting with a verb, like "Pay the electricity bill", or null.

All dates are YYYY-MM-DD. If a value isn't printed or you aren't sure, use null. Never guess.`
}

function cleanDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  const year = date.getUTCFullYear()
  return year >= 1950 && year <= 2100 ? value : null
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function cleanDraft(raw: PhotoDraftRaw): PhotoDraft {
  const amount = typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount > 0 && raw.amount < 1_000_000_000
    ? Math.round(raw.amount * 100) / 100
    : null
  const currency = raw.currency && /^[A-Za-z]{3}$/.test(raw.currency) ? raw.currency.toUpperCase() : null
  return {
    kind: raw.kind,
    title: raw.title.trim(),
    category: raw.vault_category,
    issuer: cleanText(raw.issuer),
    summary: cleanText(raw.summary),
    reference: cleanText(raw.reference),
    documentDate: cleanDate(raw.document_date),
    startDate: cleanDate(raw.start_date),
    expiryDate: cleanDate(raw.expiry_date),
    renewalDate: cleanDate(raw.renewal_date),
    dueDate: cleanDate(raw.due_date),
    amount,
    currency,
    dueAction: cleanText(raw.due_action),
  }
}

// What the review form starts with when the AI fails: the photo can still be filed by hand.
export function emptyDraft(): PhotoDraft {
  return {
    kind: "other", title: "", category: "documents", issuer: null, summary: null, reference: null,
    documentDate: null, startDate: null, expiryDate: null, renewalDate: null, dueDate: null,
    amount: null, currency: null, dueAction: null,
  }
}

// The date the renewal reminder counts back from: renewal first, then expiry.
export function renewalAnchor(draft: Pick<PhotoDraft, "renewalDate" | "expiryDate">) {
  return draft.renewalDate ?? draft.expiryDate
}

// Which ticks start on. Spending only for bills and receipts, since a policy's
// premium may already be in the budget another way.
export function defaultChoices(draft: PhotoDraft, today: string) {
  const anchor = renewalAnchor(draft)
  return {
    remind: Boolean(anchor && anchor >= today),
    budget: Boolean(draft.amount && (draft.kind === "bill" || draft.kind === "receipt")),
    task: Boolean(draft.dueDate),
  }
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// What the browser sends when the person confirms the draft.
export const photoSaveSchema = z.object({
  today: dateString,
  title: z.string().trim().min(1).max(255),
  category: z.enum(VAULT_CATEGORIES),
  summary: z.string().trim().max(2000).nullable(),
  issuer: z.string().trim().max(120).nullable(),
  reference: z.string().trim().max(80).nullable(),
  document_date: dateString.nullable(),
  start_date: dateString.nullable(),
  expiry_date: dateString.nullable(),
  renewal_date: dateString.nullable(),
  due_date: dateString.nullable(),
  amount: z.number().positive().max(1_000_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  due_action: z.string().trim().max(160).nullable(),
  remind: z.boolean(),
  budget: z.boolean(),
  task: z.boolean(),
})

export type PhotoSaveInput = z.infer<typeof photoSaveSchema>

export type PhotoSavePlan = {
  vault: {
    title: string
    category: string
    description: string | null
    notes: string | null
    startDate: string | null
    expiryDate: string | null
    renewalDate: string | null
    reminderDate: string | null
  }
  tasks: { title: string; dueDate: string; priority: "medium" | "high" }[]
  spending: { amount: number; description: string; date: string } | null
}

function laterOf(a: string, b: string) {
  return a > b ? a : b
}

// Turns a confirmed draft into rows. Nothing is dated before today, the same rule kits follow.
export function planPhotoSave(input: PhotoSaveInput): PhotoSavePlan {
  const today = input.today
  const noteParts = [
    input.issuer ? `From ${input.issuer}` : null,
    input.reference ? `Ref ${input.reference}` : null,
    input.amount ? `Amount ${input.currency ? `${input.currency} ` : ""}${input.amount}` : null,
  ].filter(Boolean)

  const anchor = input.renewal_date ?? input.expiry_date
  const reminderDate = input.remind && anchor && anchor >= today
    ? laterOf(today, addDaysToDate(anchor, -RENEWAL_LEAD_DAYS))
    : null

  const tasks: PhotoSavePlan["tasks"] = []
  if (reminderDate && anchor) {
    tasks.push({ title: `Renew ${input.title}`.slice(0, 255), dueDate: reminderDate, priority: "medium" })
  }
  if (input.task && input.due_date) {
    const title = input.due_action || `Deal with ${input.title}`
    tasks.push({ title: title.slice(0, 255), dueDate: laterOf(today, input.due_date), priority: "high" })
  }

  const spending = input.budget && input.amount
    ? {
        amount: input.amount,
        description: (input.issuer ? `${input.title} (${input.issuer})` : input.title).slice(0, 500),
        date: input.document_date && input.document_date <= today ? input.document_date : today,
      }
    : null

  return {
    vault: {
      title: input.title,
      category: input.category,
      description: input.summary,
      notes: noteParts.length ? noteParts.join(". ") : null,
      startDate: input.start_date,
      expiryDate: input.expiry_date,
      renewalDate: input.renewal_date,
      reminderDate,
    },
    tasks,
    spending,
  }
}
