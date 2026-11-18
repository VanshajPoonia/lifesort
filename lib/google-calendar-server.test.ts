import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Responder = (text: string, values: unknown[]) => unknown[]

const { sql, state } = vi.hoisted(() => {
  const state = { calls: [] as { text: string; values: unknown[] }[], respond: (() => []) as Responder }
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim()
    state.calls.push({ text, values })
    return Promise.resolve(state.respond(text, values))
  }
  return { sql, state }
})

vi.mock("@/lib/db", () => ({ sql }))
vi.mock("@/lib/token-crypto", () => ({ decryptToken: (value: string | null) => value, encryptToken: (value: string | null) => value }))

import { applyGoogleChanges, syncItemToGoogle } from "@/lib/google-calendar-server"
import { GOOGLE_EVENTS_SCOPE } from "@/lib/google-sync"

const integration = {
  id: 1,
  user_id: "u1",
  access_token: "token",
  refresh_token: "refresh",
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  scope: `openid ${GOOGLE_EVENTS_SCOPE}`,
  time_zone: "Asia/Kolkata",
  sync_to_google: true,
}

const eventRow = {
  id: 5, title: "Dentist", description: null, location: null,
  event_date: "2026-11-20", start_time: "09:30:00", end_time: "10:00:00",
}

const fetchMock = vi.fn()

function reply(status: number, body: unknown = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status })
}

beforeEach(() => {
  state.calls = []
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const ran = (fragment: string) => state.calls.filter((call) => call.text.includes(fragment))

describe("syncItemToGoogle", () => {
  it("does nothing while sync is off", async () => {
    state.respond = () => []
    await syncItemToGoogle("u1", "event", 5)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("creates a Google event and links it", async () => {
    state.respond = (text) => {
      if (text.includes("FROM calendar_integrations")) return [integration]
      if (text.includes("FROM calendar_events")) return [eventRow]
      return []
    }
    fetchMock.mockResolvedValueOnce(reply(200, { id: "g1", updated: "2026-11-18T10:00:00Z" }))
    await syncItemToGoogle("u1", "event", 5)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body).start).toEqual({ dateTime: "2026-11-20T09:30:00", timeZone: "Asia/Kolkata" })
    const link = ran("INSERT INTO calendar_sync_links")[0]
    expect(link.values).toEqual(["u1", "event", 5, "g1", "2026-11-18T10:00:00Z"])
  })

  it("creates a new copy when the linked one is gone from Google", async () => {
    state.respond = (text) => {
      if (text.includes("FROM calendar_integrations")) return [integration]
      if (text.includes("FROM calendar_events")) return [eventRow]
      if (text.includes("FROM calendar_sync_links")) return [{ item_type: "event", item_id: 5, google_event_id: "old", google_updated_at: null }]
      return []
    }
    fetchMock.mockResolvedValueOnce(reply(410)).mockResolvedValueOnce(reply(200, { id: "g2", updated: "2026-11-18T11:00:00Z" }))
    await syncItemToGoogle("u1", "event", 5)
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["PATCH", "POST"])
    expect(ran("INSERT INTO calendar_sync_links")[0].values[3]).toBe("g2")
  })

  it("deletes the Google copy when a task loses its time slot", async () => {
    state.respond = (text) => {
      if (text.includes("FROM calendar_integrations")) return [integration]
      if (text.includes("FROM tasks")) return [{ id: 9, title: "Report", scheduled_date: "2026-11-20", scheduled_time: null, duration_minutes: 30 }]
      if (text.includes("FROM calendar_sync_links")) return [{ item_type: "task", item_id: 9, google_event_id: "g9", google_updated_at: null }]
      return []
    }
    fetchMock.mockResolvedValueOnce(reply(204))
    await syncItemToGoogle("u1", "task", 9)
    expect(fetchMock.mock.calls[0][0]).toContain("/events/g9")
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
    expect(ran("DELETE FROM calendar_sync_links")).toHaveLength(1)
  })

  it("keeps the link when Google refuses the delete", async () => {
    state.respond = (text) => {
      if (text.includes("FROM calendar_integrations")) return [integration]
      if (text.includes("FROM calendar_sync_links")) return [{ item_type: "event", item_id: 5, google_event_id: "g5", google_updated_at: null }]
      return []
    }
    fetchMock.mockResolvedValueOnce(reply(500))
    await syncItemToGoogle("u1", "event", 5)
    expect(ran("DELETE FROM calendar_sync_links")).toHaveLength(0)
  })
})

describe("applyGoogleChanges", () => {
  it("applies a move made in Google and hides LifeSort's own copy", async () => {
    state.respond = (text) => {
      if (text.includes("FROM calendar_sync_links")) {
        return [{ item_type: "event", item_id: 5, google_event_id: "g1", google_updated_at: "2026-11-18T10:00:00Z" }]
      }
      if (text.includes("FROM calendar_events")) return [eventRow]
      return []
    }
    const result = await applyGoogleChanges("u1", "Asia/Kolkata", [
      {
        id: "g1",
        summary: "Dentist",
        updated: "2026-11-18T12:00:00Z",
        start: { dateTime: "2026-11-21T09:30:00+05:30" },
        end: { dateTime: "2026-11-21T10:00:00+05:30" },
      },
      { id: "theirs", summary: "Lunch", start: { dateTime: "2026-11-21T12:00:00Z" }, end: { dateTime: "2026-11-21T13:00:00Z" } },
    ])
    expect(result.pulled).toBe(1)
    expect([...result.ours]).toEqual(["g1"])
    const update = ran("UPDATE calendar_events")[0]
    expect(update.values.slice(0, 4)).toEqual(["Dentist", "2026-11-21", "09:30", "10:00"])
    expect(ran("UPDATE calendar_sync_links")[0].values[0]).toBe("2026-11-18T12:00:00Z")
  })

  it("leaves items alone when Google hasn't changed them since the last push", async () => {
    state.respond = (text) => {
      if (text.includes("FROM calendar_sync_links")) {
        return [{ item_type: "event", item_id: 5, google_event_id: "g1", google_updated_at: "2026-11-18T12:00:00Z" }]
      }
      return []
    }
    const result = await applyGoogleChanges("u1", "UTC", [{ id: "g1", updated: "2026-11-18T12:00:00Z" }])
    expect(result.pulled).toBe(0)
    expect(ran("UPDATE")).toHaveLength(0)
  })
})
