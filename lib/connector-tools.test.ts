import { describe, expect, it, vi } from "vitest"

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))
vi.mock("@/lib/db", () => ({ sql }))

import { CONNECTOR_TOOLS, inboxTitle, itemUrl, parseItemId, runConnectorTool } from "@/lib/connector-tools"

describe("connector tools", () => {
  it("offers search and fetch, plus today, tasks and two ways to add", () => {
    expect(CONNECTOR_TOOLS.map((tool) => tool.name)).toEqual(["search", "fetch", "get_today", "list_tasks", "add_to_inbox", "add_task"])
    const writers = CONNECTOR_TOOLS.filter((tool) => !tool.annotations.readOnlyHint).map((tool) => tool.name)
    expect(writers).toEqual(["add_to_inbox", "add_task"])
    expect(CONNECTOR_TOOLS.every((tool) => tool.annotations.destructiveHint === false)).toBe(true)
  })

  it("reads item ids and builds links", () => {
    expect(parseItemId("task:12")).toEqual({ kind: "task", id: 12 })
    expect(parseItemId("note:4")).toEqual({ kind: "note", id: 4 })
    expect(parseItemId("journal:1")).toBeNull()
    expect(parseItemId("task:abc")).toBeNull()
    expect(itemUrl("https://lifesort.vercel.app", "note", 4)).toBe("https://lifesort.vercel.app/library?tab=notes&note=4")
  })

  it("titles an Inbox item by its first line", () => {
    expect(inboxTitle("Call the plumber\nabout the kitchen tap")).toBe("Call the plumber")
    expect(inboxTitle("x".repeat(300))).toHaveLength(255)
  })

  it("turns bad arguments into a tool error without touching the database", async () => {
    const empty = await runConnectorTool("u1", "https://x", "search", { query: "  " })
    expect(empty.isError).toBe(true)
    const badDate = await runConnectorTool("u1", "https://x", "add_task", { title: "Pay rent", due_date: "next friday" })
    expect(badDate).toMatchObject({ isError: true })
    expect(badDate.text).toContain("due_date")
    const badId = await runConnectorTool("u1", "https://x", "fetch", { id: "journal:3" })
    expect(badId).toMatchObject({ isError: true, text: "Use an id from search, like task:12." })
    expect(sql).not.toHaveBeenCalled()
  })
})
