import { NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"
import { getUserFromSession } from "@/lib/auth"
import { z } from "zod"

const sql = neon(process.env.DATABASE_URL!)

const executeSchema = z.object({
  id: z.number().int().positive(),
})

function isMissingTable(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  const msg = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || err.code === "42703" || msg.includes("does not exist")
}

/**
 * Execute a previously-confirmed agent action.
 *
 * Contract:
 *   - The action must already exist in agent_action_events with status='confirmed'.
 *   - The user must own the action.
 *   - Execution dispatches to a tool handler keyed by `tool_name`.
 *
 * Current state: tool dispatch is not yet implemented because no Agent tools
 * have been registered. The route is a structural stub that:
 *   - validates ownership and confirmation state
 *   - records the attempt by flipping status to 'failed' with a clear error
 *
 * When tools are added, replace the "tool dispatch not implemented" branch
 * with a registry lookup in `lib/agent-tools.ts` and the actual handler call.
 */
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = executeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", code: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 })
  }
  const { id } = parsed.data

  try {
    const rows = await sql`
      SELECT id, tool_name, resource_type, payload, status
      FROM agent_action_events
      WHERE id = ${id} AND user_id = ${user.id}
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Action not found", code: "NOT_FOUND" }, { status: 404 })
    }
    const action = rows[0]
    if (action.status !== "confirmed") {
      return NextResponse.json(
        { error: `Action is in status '${String(action.status)}', not 'confirmed'`, code: "INVALID_STATE" },
        { status: 409 },
      )
    }

    // Tool dispatch is not yet implemented. Record the attempt as a failure
    // so the audit trail accurately reflects that no write happened.
    const errorMsg = `No handler registered for tool '${String(action.tool_name)}'. Tool registry is not yet implemented; see lib/agent-tools.ts (planned).`
    await sql`
      UPDATE agent_action_events
      SET status = 'failed', error = ${errorMsg}, executed_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
    `
    return NextResponse.json(
      { error: errorMsg, code: "TOOL_NOT_IMPLEMENTED" },
      { status: 501 },
    )
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "agent_action_events migration not applied", code: "MIGRATION_REQUIRED" }, { status: 503 })
    }
    throw err
  }
}
