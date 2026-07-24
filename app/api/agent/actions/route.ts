import { NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"
import { getUserFromSession } from "@/lib/auth"
import { z } from "zod"

const sql = neon(process.env.DATABASE_URL!)

export type AgentActionStatus = "pending" | "confirmed" | "rejected" | "executed" | "failed"

export type AgentAction = {
  id: number
  agent_run_id: string | null
  tool_name: string
  resource_type: string | null
  resource_id: string | null
  payload: Record<string, unknown>
  status: AgentActionStatus
  error: string | null
  created_at: string
  executed_at: string | null
}

function isMissingTable(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  const msg = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || err.code === "42703" || msg.includes("does not exist")
}

const createSchema = z.object({
  tool_name: z.string().min(1).max(100),
  agent_run_id: z.string().uuid().optional(),
  resource_type: z.string().max(50).optional(),
  resource_id: z.string().max(500).optional(),
  payload: z.record(z.unknown()).default({}),
})

const updateSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["confirmed", "rejected"]),
})

export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const runId = searchParams.get("agent_run_id")
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "100") || 100)

  try {
    let rows: Record<string, unknown>[]
    if (status && runId) {
      rows = await sql`
        SELECT id, agent_run_id, tool_name, resource_type, resource_id,
               payload, status, error, created_at, executed_at
        FROM agent_action_events
        WHERE user_id = ${user.id} AND status = ${status} AND agent_run_id = ${runId}
        ORDER BY created_at DESC LIMIT ${limit}
      `
    } else if (status) {
      rows = await sql`
        SELECT id, agent_run_id, tool_name, resource_type, resource_id,
               payload, status, error, created_at, executed_at
        FROM agent_action_events
        WHERE user_id = ${user.id} AND status = ${status}
        ORDER BY created_at DESC LIMIT ${limit}
      `
    } else if (runId) {
      rows = await sql`
        SELECT id, agent_run_id, tool_name, resource_type, resource_id,
               payload, status, error, created_at, executed_at
        FROM agent_action_events
        WHERE user_id = ${user.id} AND agent_run_id = ${runId}
        ORDER BY created_at DESC LIMIT ${limit}
      `
    } else {
      rows = await sql`
        SELECT id, agent_run_id, tool_name, resource_type, resource_id,
               payload, status, error, created_at, executed_at
        FROM agent_action_events
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC LIMIT ${limit}
      `
    }
    return NextResponse.json({ actions: rows.map(mapRow) })
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ actions: [] })
    throw err
  }
}

export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", code: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 })
  }
  const { tool_name, agent_run_id, resource_type, resource_id, payload } = parsed.data

  try {
    const rows = await sql`
      INSERT INTO agent_action_events (user_id, agent_run_id, tool_name, resource_type, resource_id, payload, status)
      VALUES (${user.id}, ${agent_run_id ?? null}, ${tool_name}, ${resource_type ?? null}, ${resource_id ?? null}, ${JSON.stringify(payload)}::jsonb, 'pending')
      RETURNING id, agent_run_id, tool_name, resource_type, resource_id, payload, status, error, created_at, executed_at
    `
    return NextResponse.json({ action: mapRow(rows[0]) }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "agent_action_events migration not applied", code: "MIGRATION_REQUIRED" }, { status: 503 })
    }
    throw err
  }
}

export async function PUT(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", code: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 })
  }
  const { id, status } = parsed.data

  try {
    const rows = await sql`
      UPDATE agent_action_events
      SET status = ${status}
      WHERE id = ${id} AND user_id = ${user.id} AND status = 'pending'
      RETURNING id, agent_run_id, tool_name, resource_type, resource_id, payload, status, error, created_at, executed_at
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found or not pending", code: "NOT_FOUND_OR_FINAL" }, { status: 404 })
    }
    return NextResponse.json({ action: mapRow(rows[0]) })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "agent_action_events migration not applied", code: "MIGRATION_REQUIRED" }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const idParam = searchParams.get("id")
  const id = idParam ? parseInt(idParam, 10) : NaN
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id query param required", code: "VALIDATION_FAILED" }, { status: 400 })
  }

  try {
    const rows = await sql`
      DELETE FROM agent_action_events
      WHERE id = ${id} AND user_id = ${user.id} AND status IN ('pending', 'rejected', 'failed')
      RETURNING id
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found or already executed", code: "NOT_FOUND_OR_EXECUTED" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "agent_action_events migration not applied", code: "MIGRATION_REQUIRED" }, { status: 503 })
    }
    throw err
  }
}

function mapRow(r: Record<string, unknown>): AgentAction {
  return {
    id: Number(r.id),
    agent_run_id: r.agent_run_id ? String(r.agent_run_id) : null,
    tool_name: String(r.tool_name ?? ""),
    resource_type: r.resource_type ? String(r.resource_type) : null,
    resource_id: r.resource_id ? String(r.resource_id) : null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: String(r.status ?? "pending") as AgentActionStatus,
    error: r.error ? String(r.error) : null,
    created_at: new Date(r.created_at as string).toISOString(),
    executed_at: r.executed_at ? new Date(r.executed_at as string).toISOString() : null,
  }
}
