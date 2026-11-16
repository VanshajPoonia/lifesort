import { describe, expect, it } from "vitest"

import { sharedCapture } from "./shared-capture"

const params = (values: Record<string, string>) => new URLSearchParams(values)

describe("sharedCapture", () => {
  it("returns an empty string when nothing was shared", () => {
    expect(sharedCapture(params({}))).toBe("")
  })

  it("joins title, text and link on separate lines", () => {
    expect(sharedCapture(params({ shared_title: "Rent", shared_text: "Pay by Friday", shared_url: "https://example.com/rent" }))).toBe(
      "Rent\nPay by Friday\nhttps://example.com/rent",
    )
  })

  it("drops a link that is already inside the text", () => {
    expect(sharedCapture(params({ shared_text: "Read this https://example.com/a", shared_url: "https://example.com/a" }))).toBe(
      "Read this https://example.com/a",
    )
  })

  it("drops an earlier part that a later part contains", () => {
    expect(sharedCapture(params({ shared_title: "Recipe", shared_text: "Recipe for dal" }))).toBe("Recipe for dal")
  })

  it("ignores blank values", () => {
    expect(sharedCapture(params({ shared_title: "  ", shared_url: "https://example.com" }))).toBe("https://example.com")
  })
})
