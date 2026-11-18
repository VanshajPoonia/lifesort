import { describe, expect, it, vi } from "vitest"

import { handleMcpMessage, type ToolDefinition } from "@/lib/mcp"

const tools: ToolDefinition[] = [
  {
    name: "echo",
    title: "Echo",
    description: "Says it back",
    inputSchema: { type: "object", properties: { text: { type: "string" } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
]

describe("handleMcpMessage", () => {
  it("agrees on a protocol version it knows, or offers its newest", async () => {
    const run = vi.fn()
    const known = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, tools, run)
    expect(known).toMatchObject({ id: 1, result: { protocolVersion: "2025-03-26", serverInfo: { name: "lifesort" } } })
    const unknown = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, tools, run)
    expect(unknown).toMatchObject({ result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } } } })
  })

  it("answers notifications with nothing", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, tools, vi.fn())).toBeNull()
  })

  it("lists tools and answers ping", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: "a", method: "tools/list" }, tools, vi.fn())).toEqual({ jsonrpc: "2.0", id: "a", result: { tools } })
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "ping" }, tools, vi.fn())).toEqual({ jsonrpc: "2.0", id: 3, result: {} })
  })

  it("runs a tool with its arguments and wraps the result", async () => {
    const run = vi.fn().mockResolvedValue({ text: "hi", structured: { said: "hi" } })
    const reply = await handleMcpMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo", arguments: { text: "hi" } } }, tools, run)
    expect(run).toHaveBeenCalledWith("echo", { text: "hi" })
    expect(reply).toEqual({
      jsonrpc: "2.0",
      id: 4,
      result: { content: [{ type: "text", text: "hi" }], structuredContent: { said: "hi" }, isError: false },
    })
  })

  it("rejects unknown tools, unknown methods and bad messages", async () => {
    const run = vi.fn()
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } }, tools, run)).toMatchObject({ error: { code: -32602 } })
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 6, method: "resources/list" }, tools, run)).toMatchObject({ error: { code: -32601 } })
    expect(await handleMcpMessage({ hello: "world" }, tools, run)).toMatchObject({ id: null, error: { code: -32600 } })
    expect(run).not.toHaveBeenCalled()
  })
})
