import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"

import {
  emailToInbox,
  linkCodeFrom,
  newAddressToken,
  newLinkCode,
  parseWhatsAppMessages,
  textToInbox,
  tokenFromRecipients,
  verifyMetaSignature,
  verifySvixSignature,
} from "@/lib/capture"
import { waMeLink } from "@/lib/capture-links"

const SECRET = `whsec_${Buffer.from("a test signing key for lifesort").toString("base64")}`

function svixSign(id: string, timestamp: string, body: string) {
  const key = Buffer.from(SECRET.slice(6), "base64")
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`
}

describe("addresses and codes", () => {
  it("makes lowercase address tokens and readable link codes", () => {
    expect(newAddressToken()).toMatch(/^[a-z2-9]{12}$/)
    expect(newLinkCode()).toMatch(/^[A-Z2-9]{6}$/)
    expect(newAddressToken()).not.toBe(newAddressToken())
  })

  it("finds the token among recipients", () => {
    const domain = "abc123.resend.app"
    expect(tokenFromRecipients(["someone@else.com", "Inbox <k3x9pm7qa2hd@ABC123.resend.app>"], domain)).toBe("k3x9pm7qa2hd")
    expect(tokenFromRecipients(["k3x9pm7qa2hd+receipts@abc123.resend.app"], domain)).toBe("k3x9pm7qa2hd")
    expect(tokenFromRecipients(["k3x9pm7qa2hd@other.app"], domain)).toBeNull()
    expect(tokenFromRecipients(["short@abc123.resend.app"], domain)).toBeNull()
    expect(tokenFromRecipients("k3x9pm7qa2hd@abc123.resend.app", domain)).toBeNull()
  })

  it("reads a link code with or without the word link", () => {
    expect(linkCodeFrom("K7P2QX")).toBe("K7P2QX")
    expect(linkCodeFrom("  link k7p2qx ")).toBe("K7P2QX")
    expect(linkCodeFrom("buy milk")).toBeNull()
    expect(linkCodeFrom("K7P2QX please")).toBeNull()
  })

  it("builds a wa.me link from a display number", () => {
    expect(waMeLink("+1 (555) 010-2030", "K7P2QX")).toBe("https://wa.me/15550102030?text=K7P2QX")
  })
})

describe("signatures", () => {
  const body = JSON.stringify({ type: "email.received" })
  const now = 1_800_000_000

  it("accepts a correct Svix signature among several", () => {
    const signature = `v1,bm9wZQ== ${svixSign("msg_1", String(now), body)}`
    expect(verifySvixSignature({ id: "msg_1", timestamp: String(now), signature }, body, SECRET, now)).toBe(true)
  })

  it("rejects a changed body, an old timestamp or missing headers", () => {
    const signature = svixSign("msg_1", String(now), body)
    expect(verifySvixSignature({ id: "msg_1", timestamp: String(now), signature }, `${body} `, SECRET, now)).toBe(false)
    expect(verifySvixSignature({ id: "msg_1", timestamp: String(now), signature }, body, SECRET, now + 600)).toBe(false)
    expect(verifySvixSignature({ id: null, timestamp: String(now), signature }, body, SECRET, now)).toBe(false)
  })

  it("checks Meta's sha256 header", () => {
    const header = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`
    expect(verifyMetaSignature(body, header, "app-secret")).toBe(true)
    expect(verifyMetaSignature(body, header, "other-secret")).toBe(false)
    expect(verifyMetaSignature(body, null, "app-secret")).toBe(false)
  })
})

describe("turning messages into Inbox items", () => {
  it("uses the subject as the title and keeps the sender", () => {
    expect(emailToInbox({ subject: "Fwd: Electricity bill", text: "Due on the 25th", from: "me@example.com" })).toEqual({
      title: "Electricity bill",
      rawText: "Due on the 25th\n\nSent by me@example.com",
    })
  })

  it("falls back to the HTML body and its first line", () => {
    expect(emailToInbox({ subject: "", text: null, html: "<p>Call the bank</p><p>About the card</p>" })).toEqual({
      title: "Call the bank",
      rawText: "Call the bank\nAbout the card",
    })
  })

  it("titles a text message by its first line", () => {
    expect(textToInbox("  Buy stamps\nand envelopes ")).toEqual({ title: "Buy stamps", rawText: "Buy stamps\nand envelopes" })
  })

  it("reads text and other messages from a WhatsApp webhook", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          field: "messages",
          value: {
            messages: [
              { from: "919812345678", id: "wamid.1", type: "text", text: { body: "Book the car service" } },
              { from: "919812345678", id: "wamid.2", type: "image", image: { id: "x" } },
            ],
          },
        }, { field: "messages", value: { statuses: [{ id: "wamid.0", status: "read" }] } }],
      }],
    }
    expect(parseWhatsAppMessages(payload)).toEqual([
      { from: "919812345678", id: "wamid.1", type: "text", text: "Book the car service" },
      { from: "919812345678", id: "wamid.2", type: "image", text: null },
    ])
    expect(parseWhatsAppMessages({ nonsense: true })).toEqual([])
  })
})
