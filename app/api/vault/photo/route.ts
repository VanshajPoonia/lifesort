import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { isPlausibleToday } from "@/lib/life-kit-input"
import { planPhotoSave, photoSaveSchema } from "@/lib/photo-scan"
import { isR2Configured } from "@/lib/r2"

// POST /api/vault/photo: saves a confirmed photo draft in one transaction: the Vault
// entry, a renewal task, a due task and a spending line, as ticked. The browser then
// uploads the photo itself through /api/attachments when storage is set up.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = photoSaveSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isPlausibleToday(parsed.data.today)) {
    return NextResponse.json({ error: "Some of those details don't look right. Check the dates and amount." }, { status: 400 })
  }

  const plan = planPhotoSave(parsed.data)
  const { vault, tasks, spending } = plan
  const taskNote = `Added from a photo in your Vault: ${vault.title}`

  try {
    const results = await sql.transaction((tx) => [
      tx`
        INSERT INTO vault_items (user_id, title, category, description, notes, start_date, expiry_date, renewal_date, reminder_date)
        VALUES (${user.id}, ${vault.title}, ${vault.category}, ${vault.description}, ${vault.notes},
          ${vault.startDate}, ${vault.expiryDate}, ${vault.renewalDate}, ${vault.reminderDate})
        RETURNING id
      `,
      ...tasks.map((task) => tx`
        INSERT INTO tasks (user_id, title, description, priority, due_date, status, completed, sort_order)
        VALUES (${user.id}, ${task.title}, ${taskNote}, ${task.priority}, ${task.dueDate}, 'next', FALSE, 0)
        RETURNING id
      `),
      ...(spending
        ? [tx`
            INSERT INTO budget_transactions (user_id, type, amount, description, date)
            VALUES (${user.id}, 'expense', ${spending.amount}, ${spending.description}, ${spending.date})
            RETURNING id
          `]
        : []),
    ])

    const vaultRow = (results[0] as { id: number }[])[0]
    return NextResponse.json({
      vault_item_id: vaultRow.id,
      tasks_added: tasks.length,
      spending_added: Boolean(spending),
      storage_ready: isR2Configured(),
    })
  } catch (error) {
    console.error("[vault/photo] save failed:", error)
    return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 })
  }
}
