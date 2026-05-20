const RICH_TEXT_TAG_RE = /<\/?(p|h[1-6]|ul|ol|li|blockquote|hr|strong|em|u|s|a|br|code|pre)\b/i
const BLOCK_BREAK_RE = /<\/(p|h[1-6]|li|blockquote)>/gi
const UNSAFE_BLOCK_RE = /<(script|style|iframe|object|embed|meta|link)\b[\s\S]*?<\/\1>/gi
const UNSAFE_VOID_TAG_RE = /<(script|style|iframe|object|embed|meta|link)\b[^>]*\/?>/gi
const EVENT_ATTRIBUTE_RE = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi
const URL_ATTRIBUTE_RE = /\s+(href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi

export function isRichTextHtml(value?: string | null) {
  return Boolean(value && RICH_TEXT_TAG_RE.test(value))
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function isSafeRichTextUrl(value: string) {
  const unquoted = value.replace(/^["']|["']$/g, "")
  const decoded = decodeBasicEntities(unquoted).trim()
  if (!decoded) return false
  if (decoded.startsWith("/") || decoded.startsWith("#")) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
    return /^(https?:|mailto:|tel:)/i.test(decoded)
  }
  return true
}

export function sanitizeRichTextHtml(value: string) {
  return value
    .replace(UNSAFE_BLOCK_RE, "")
    .replace(UNSAFE_VOID_TAG_RE, "")
    .replace(EVENT_ATTRIBUTE_RE, "")
    .replace(URL_ATTRIBUTE_RE, (match, _attribute: string, rawValue: string) => {
      return isSafeRichTextUrl(rawValue) ? match : ""
    })
}

export function plainTextToRichTextHtml(value?: string | null) {
  const text = value || ""
  if (!text.trim()) return ""

  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

export function normalizeRichTextForEditor(value?: string | null) {
  if (!value) return ""
  return isRichTextHtml(value) ? sanitizeRichTextHtml(value) : plainTextToRichTextHtml(value)
}

export function richTextToPlainText(value?: string | null) {
  if (!value) return ""

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n")
    .replace(BLOCK_BREAK_RE, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export const stripRichText = richTextToPlainText

export function richTextCharacterCount(value?: string | null) {
  return richTextToPlainText(value).length
}
