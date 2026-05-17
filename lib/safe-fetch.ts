import { promises as dns } from "dns"

/**
 * SSRF-safe fetch wrapper.
 *
 * Performs the following defenses before issuing the request:
 *   1. Require https:// (no http, file, ftp, gopher, data, javascript, etc.)
 *   2. Resolve hostname to all A/AAAA records
 *   3. Reject if any resolved IP is in a private / loopback / link-local /
 *      unique-local range, or is a known cloud-metadata endpoint
 *   4. Cap response size mid-stream (default 1 MB)
 *   5. Enforce request timeout (default 5 s)
 *
 * On rejection the function throws a `SafeFetchError` with a stable `code` so
 * callers can surface clean error responses without leaking internals.
 */

export class SafeFetchError extends Error {
  constructor(
    public readonly code:
      | "INVALID_URL"
      | "UNSUPPORTED_PROTOCOL"
      | "DNS_FAILURE"
      | "PRIVATE_IP_BLOCKED"
      | "TIMEOUT"
      | "RESPONSE_TOO_LARGE"
      | "FETCH_FAILED",
    message: string,
  ) {
    super(message)
    this.name = "SafeFetchError"
  }
}

export interface SafeFetchOptions {
  maxBytes?: number
  timeoutMs?: number
  headers?: Record<string, string>
  userAgent?: string
}

const DEFAULT_MAX_BYTES = 1_000_000
const DEFAULT_TIMEOUT_MS = 5_000

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    result = result * 256 + n
  }
  return result
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe
  // 10.0.0.0/8
  if (n >= 0x0a000000 && n <= 0x0affffff) return true
  // 172.16.0.0/12
  if (n >= 0xac100000 && n <= 0xac1fffff) return true
  // 192.168.0.0/16
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true
  // 127.0.0.0/8 (loopback)
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true
  // 169.254.0.0/16 (link-local, includes AWS/GCP/Azure metadata 169.254.169.254)
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true
  // 0.0.0.0/8 (current network)
  if (n >= 0x00000000 && n <= 0x00ffffff) return true
  // 100.64.0.0/10 (CGNAT)
  if (n >= 0x64400000 && n <= 0x647fffff) return true
  // 192.0.0.0/24 (IETF protocol assignments)
  if (n >= 0xc0000000 && n <= 0xc00000ff) return true
  // 198.18.0.0/15 (benchmarking)
  if (n >= 0xc6120000 && n <= 0xc613ffff) return true
  // 224.0.0.0/4 (multicast)
  if (n >= 0xe0000000 && n <= 0xefffffff) return true
  // 240.0.0.0/4 (reserved)
  if (n >= 0xf0000000 && n <= 0xffffffff) return true
  return false
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  // ::1 (loopback)
  if (lower === "::1") return true
  // :: (unspecified)
  if (lower === "::") return true
  // fc00::/7 (unique-local)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true
  // fe80::/10 (link-local)
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true
  // ff00::/8 (multicast)
  if (lower.startsWith("ff")) return true
  // ::ffff:0:0/96 (IPv4-mapped) — recurse via the embedded IPv4
  const mapped = lower.match(/^::ffff:([0-9.]+)$/) || lower.match(/^::ffff:[0-9a-f]+:([0-9.]+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])
  return false
}

async function assertPublicHost(hostname: string): Promise<void> {
  // Direct IP literal in the hostname
  if (/^[0-9.]+$/.test(hostname)) {
    if (isPrivateIpv4(hostname)) {
      throw new SafeFetchError("PRIVATE_IP_BLOCKED", "Private/loopback IP")
    }
    return
  }
  if (hostname.includes(":")) {
    if (isPrivateIpv6(hostname)) {
      throw new SafeFetchError("PRIVATE_IP_BLOCKED", "Private/loopback IPv6")
    }
    return
  }
  // Hostname → resolve to all A/AAAA addresses
  let addresses: { address: string; family: number }[]
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new SafeFetchError("DNS_FAILURE", "DNS lookup failed")
  }
  if (addresses.length === 0) {
    throw new SafeFetchError("DNS_FAILURE", "No DNS records")
  }
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new SafeFetchError("PRIVATE_IP_BLOCKED", "Hostname resolves to private IPv4")
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new SafeFetchError("PRIVATE_IP_BLOCKED", "Hostname resolves to private IPv6")
    }
  }
}

export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<{ status: number; headers: Headers; text: string }> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SafeFetchError("INVALID_URL", "Invalid URL")
  }

  if (url.protocol !== "https:") {
    throw new SafeFetchError("UNSUPPORTED_PROTOCOL", "Only https:// is allowed")
  }

  await assertPublicHost(url.hostname)

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      headers: {
        "User-Agent": options.userAgent ?? "Mozilla/5.0 (compatible; LifeSortPreviewBot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
      redirect: "manual", // refuse follow-redirects; caller must handle if needed
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === "AbortError") {
      throw new SafeFetchError("TIMEOUT", "Request timed out")
    }
    throw new SafeFetchError("FETCH_FAILED", "Fetch failed")
  }

  // Stream-read up to maxBytes
  let text = ""
  try {
    const reader = response.body?.getReader()
    if (!reader) {
      text = await response.text()
      if (text.length > maxBytes) {
        text = text.slice(0, maxBytes)
      }
    } else {
      const decoder = new TextDecoder("utf-8", { fatal: false })
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > maxBytes) {
          reader.cancel().catch(() => {})
          throw new SafeFetchError("RESPONSE_TOO_LARGE", "Response exceeds size cap")
        }
        text += decoder.decode(value, { stream: true })
      }
      text += decoder.decode()
    }
  } finally {
    clearTimeout(timeoutId)
  }

  return { status: response.status, headers: response.headers, text }
}
