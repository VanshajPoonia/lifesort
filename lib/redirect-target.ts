type SearchParams = Record<string, string | string[] | undefined>

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
