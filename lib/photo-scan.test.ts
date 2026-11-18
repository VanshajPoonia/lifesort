import { describe, expect, it } from "vitest"

import {
  cleanDraft,
  defaultChoices,
  photoDraftSchema,
  photoSaveSchema,
  planPhotoSave,
  type PhotoDraftRaw,
  type PhotoSaveInput,
} from "@/lib/photo-scan"

const raw: PhotoDraftRaw = {
  kind: "bill",
  title: " Electricity bill, November ",
  vault_category: "home",
  issuer: "Tata Power",
  summary: "Monthly bill for the flat.",
  reference: "  ",
  document_date: "2026-11-10",
  start_date: null,
  expiry_date: "2026-02-30",
  renewal_date: "not a date",
  due_date: "2026-11-25",
  amount: 2450.456,
  currency: "inr",
  due_action: "Pay the electricity bill",
}

const save: PhotoSaveInput = {
  today: "2026-11-18",
  title: "Car insurance",
  category: "insurance",
  summary: null,
  issuer: "HDFC Ergo",
  reference: "P-123",
  document_date: "2026-11-01",
  start_date: "2025-12-01",
  expiry_date: "2026-11-30",
  renewal_date: null,
  due_date: null,
  amount: 12000,
  currency: "INR",
  due_action: null,
  remind: true,
  budget: false,
  task: false,
}

describe("cleanDraft", () => {
  it("keeps real dates, drops impossible ones and tidies text and money", () => {
    const draft = cleanDraft(photoDraftSchema.parse(raw))
    expect(draft.title).toBe("Electricity bill, November")
    expect(draft.reference).toBeNull()
    expect(draft.documentDate).toBe("2026-11-10")
    expect(draft.expiryDate).toBeNull()
    expect(draft.renewalDate).toBeNull()
    expect(draft.amount).toBe(2450.46)
    expect(draft.currency).toBe("INR")
  })

  it("drops a zero or negative amount", () => {
    expect(cleanDraft({ ...raw, amount: 0 }).amount).toBeNull()
    expect(cleanDraft({ ...raw, amount: -5 }).amount).toBeNull()
  })
})

describe("defaultChoices", () => {
  it("ticks budget only for bills and receipts, and a task when something is due", () => {
    const bill = cleanDraft(raw)
    expect(defaultChoices(bill, "2026-11-18")).toEqual({ remind: false, budget: true, task: true })
    const policy = cleanDraft({ ...raw, kind: "policy", due_date: null, renewal_date: "2027-01-01" })
    expect(defaultChoices(policy, "2026-11-18")).toEqual({ remind: true, budget: false, task: false })
  })

  it("doesn't offer a reminder for a date already past", () => {
    const old = cleanDraft({ ...raw, renewal_date: "2026-01-01" })
    expect(defaultChoices(old, "2026-11-18").remind).toBe(false)
  })
})

describe("planPhotoSave", () => {
  it("adds a renewal task 14 days ahead, or today when the date is close", () => {
    const far = planPhotoSave({ ...save, expiry_date: "2027-03-01" })
    expect(far.vault.reminderDate).toBe("2027-02-15")
    expect(far.tasks).toEqual([{ title: "Renew Car insurance", dueDate: "2027-02-15", priority: "medium" }])

    const close = planPhotoSave(save)
    expect(close.vault.reminderDate).toBe("2026-11-18")
    expect(close.tasks[0].dueDate).toBe("2026-11-18")
  })

  it("prefers the renewal date over expiry", () => {
    const plan = planPhotoSave({ ...save, renewal_date: "2027-06-15", expiry_date: "2027-06-30" })
    expect(plan.vault.reminderDate).toBe("2027-06-01")
  })

  it("skips the reminder when unticked or already past", () => {
    expect(planPhotoSave({ ...save, remind: false }).tasks).toEqual([])
    expect(planPhotoSave({ ...save, expiry_date: "2026-10-01" }).vault.reminderDate).toBeNull()
  })

  it("never dates a due task in the past", () => {
    const plan = planPhotoSave({ ...save, remind: false, task: true, due_date: "2026-11-02", due_action: "Pay the premium" })
    expect(plan.tasks).toEqual([{ title: "Pay the premium", dueDate: "2026-11-18", priority: "high" }])
  })

  it("adds spending on the document date, or today when it's in the future", () => {
    const plan = planPhotoSave({ ...save, budget: true })
    expect(plan.spending).toEqual({ amount: 12000, description: "Car insurance (HDFC Ergo)", date: "2026-11-01" })
    const future = planPhotoSave({ ...save, budget: true, document_date: "2026-12-01" })
    expect(future.spending?.date).toBe("2026-11-18")
    expect(planPhotoSave({ ...save, budget: true, amount: null }).spending).toBeNull()
  })

  it("keeps the issuer, reference and amount in the Vault notes", () => {
    expect(planPhotoSave(save).vault.notes).toBe("From HDFC Ergo. Ref P-123. Amount INR 12000")
  })

  it("rejects a malformed save", () => {
    expect(photoSaveSchema.safeParse({ ...save, category: "secrets" }).success).toBe(false)
    expect(photoSaveSchema.safeParse({ ...save, due_date: "25/11/2026" }).success).toBe(false)
  })
})
