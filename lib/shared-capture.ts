// Params the manifest share_target sends to /inbox.
export const shareParams = ["shared_title", "shared_text", "shared_url"] as const

// Builds the capture text from what another app shared. Apps often repeat the link
// inside the text, so a part already contained in another part is dropped.
export function sharedCapture(params: Pick<URLSearchParams, "get">) {
  const kept: string[] = []
  for (const key of shareParams) {
    const part = params.get(key)?.trim()
    if (!part || kept.some((existing) => existing.includes(part))) continue
    for (let index = kept.length - 1; index >= 0; index -= 1) {
      if (part.includes(kept[index])) kept.splice(index, 1)
    }
    kept.push(part)
  }
  return kept.join("\n")
}
