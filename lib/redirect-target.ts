type SearchParams = Record<string, string | string[] | undefined>

// The address the person actually used (Vercel sets the forwarded headers), which
// OAuth metadata and redirect addresses must repeat exactly.
export function requestOrigin(request: Request) {
  const url = new URL(request.url)
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "")
  return `${proto}://${host}`
}

// Where login sends people back to: a path on this site only, never another host.
export function safeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/"
  return next
}

// Builds the URL an old route redirects to, keeping its query string
// (for example ?life_area_id=) and adding the params the new place needs.
export function redirectTarget(path: string, searchParams: SearchParams, extra: Record<string, string> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
    else if (typeof value === "string") params.set(key, value)
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
