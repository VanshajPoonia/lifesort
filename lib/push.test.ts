import { beforeEach, describe, expect, it, vi } from "vitest"

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))
const { sendNotification, setVapidDetails } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ sql }))
vi.mock("web-push", () => ({ default: { sendNotification, setVapidDetails } }))

const payload = { title: "LifeSort", body: "Pay rent is due tomorrow", url: "/" }

async function loadPush() {
  vi.resetModules()
  return import("@/lib/push")
}

describe("sendPushToUser", () => {
  beforeEach(() => {
    sql.mockReset()
    sendNotification.mockReset()
    setVapidDetails.mockReset()
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key")
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key")
    vi.stubEnv("VAPID_SUBJECT", "https://lifesort.example")
  })

  it("does nothing when the VAPID keys are missing", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "")
    const { sendPushToUser } = await loadPush()

    const result = await sendPushToUser("user-1", payload)

    expect(result).toEqual({ sent: 0, removed: 0, failed: 0 })
    expect(sql).not.toHaveBeenCalled()
  })

  it("sends to each device and records the success", async () => {
    sql.mockResolvedValueOnce([{ id: 1, endpoint: "https://push.example/1", p256dh: "a", auth: "b" }]).mockResolvedValue([])
    sendNotification.mockResolvedValue({ statusCode: 201 })
    const { sendPushToUser } = await loadPush()

    const result = await sendPushToUser("user-1", payload)

    expect(result).toEqual({ sent: 1, removed: 0, failed: 0 })
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example/1", keys: { p256dh: "a", auth: "b" } },
      JSON.stringify(payload),
      { TTL: 43200 },
    )
    expect(sql.mock.calls[1][0].join("")).toContain("last_success_at")
  })

  it("deletes a device the push service says is gone", async () => {
    sql.mockResolvedValueOnce([{ id: 7, endpoint: "https://push.example/7", p256dh: "a", auth: "b" }]).mockResolvedValue([])
    sendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }))
    const { sendPushToUser } = await loadPush()

    const result = await sendPushToUser("user-1", payload)

    expect(result).toEqual({ sent: 0, removed: 1, failed: 0 })
    expect(sql.mock.calls[1][0].join("")).toContain("DELETE FROM push_subscriptions")
    expect(sql.mock.calls[1][1]).toBe(7)
  })

  it("keeps a device after other errors and counts the failure", async () => {
    sql.mockResolvedValueOnce([{ id: 3, endpoint: "https://push.example/3", p256dh: "a", auth: "b" }])
    sendNotification.mockRejectedValue(Object.assign(new Error("Server error"), { statusCode: 500 }))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { sendPushToUser } = await loadPush()

    const result = await sendPushToUser("user-1", payload)

    expect(result).toEqual({ sent: 0, removed: 0, failed: 1 })
    expect(sql).toHaveBeenCalledTimes(1)
  })
})
