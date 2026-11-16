import { NextResponse } from "next/server"
import { z } from "zod"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { MAX_IMPORT_TASKS } from "@/lib/task-import"

const importSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(255),
        description: z.string().max(5000).nullable(),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        priority: z.enum(["low", "medium", "high"]),
        completed: z.boolean(),
      }),
    )
    .min(1)
    .max(MAX_IMPORT_TASKS),
})

const BATCH = 200

// POST /api/import/tasks { tasks }: adds tasks parsed in the browser by lib/task-import.ts.
// All or nothing: the batches run in one transaction.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = importSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Those tasks don't look right. Try exporting the file again." }, { status: 400 })
  }

  const { tasks } = parsed.data
  try {
    await sql.transaction((tx) => {
      const queries = []
      for (let start = 0; start < tasks.length; start += BATCH) {
        const batch = tasks.slice(start, start + BATCH)
        queries.push(tx`
          INSERT INTO tasks (user_id, title, description, priority, due_date, status, completed, sort_order)
          SELECT ${user.id}, t.title, t.description, t.priority, t.due_date,
            CASE WHEN t.completed THEN 'completed' ELSE 'next' END, t.completed, 0
          FROM unnest(
            ${batch.map((task) => task.title)}::text[],
            ${batch.map((task) => task.description)}::text[],
            ${batch.map((task) => task.priority)}::text[],
            ${batch.map((task) => task.due_date)}::date[],
            ${batch.map((task) => task.completed)}::boolean[]
          ) AS t(title, description, priority, due_date, completed)
        `)
      }
      return queries
    })
    return NextResponse.json({ created: tasks.length }, { status: 201 })
  } catch (error) {
    console.error("[import/tasks] POST error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't import those tasks." }, { status: 500 })
  }
}
