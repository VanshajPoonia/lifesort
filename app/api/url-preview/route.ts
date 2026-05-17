import { NextRequest, NextResponse } from "next/server"
import { safeFetch, SafeFetchError } from "@/lib/safe-fetch"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // YouTube → return canonical thumbnail without fetching anything.
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const youtubeMatch = url.match(youtubeRegex)
    if (youtubeMatch) {
      const videoId = youtubeMatch[1]
      return NextResponse.json({
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        title: "YouTube Video",
        type: "youtube",
      })
    }

    // Vimeo → return canonical thumbnail without fetching anything.
    const vimeoRegex = /vimeo\.com\/(\d+)/
    const vimeoMatch = url.match(vimeoRegex)
    if (vimeoMatch) {
      return NextResponse.json({
        thumbnail: `https://vumbnail.com/${vimeoMatch[1]}.jpg`,
        title: "Vimeo Video",
        type: "vimeo",
      })
    }

    // For any other URL, route through the SSRF-safe fetcher. This blocks
    // private/loopback/metadata IPs, requires https://, caps response size,
    // and enforces a request timeout.
    let result
    try {
      result = await safeFetch(url, { maxBytes: 1_000_000, timeoutMs: 5_000 })
    } catch (err) {
      if (err instanceof SafeFetchError) {
        // Stable error codes for the client to handle distinctly.
        const status = err.code === "PRIVATE_IP_BLOCKED" || err.code === "UNSUPPORTED_PROTOCOL" ? 400 : 502
        return NextResponse.json({ error: err.message, code: err.code, type: "website" }, { status })
      }
      return NextResponse.json({ error: "Failed to fetch preview", type: "website" }, { status: 502 })
    }

    const html = result.text

    const ogImageMatch =
      html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/) ||
      html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*name="twitter:image"/)

    const ogTitleMatch =
      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/)
    const titleMatch = html.match(/<title>([^<]*)<\/title>/)

    let thumbnail = ogImageMatch ? ogImageMatch[1] : null
    if (thumbnail && !thumbnail.startsWith("http")) {
      const urlObj = new URL(url)
      thumbnail = thumbnail.startsWith("/")
        ? `${urlObj.protocol}//${urlObj.host}${thumbnail}`
        : `${urlObj.protocol}//${urlObj.host}/${thumbnail}`
    }

    return NextResponse.json({
      thumbnail,
      title: ogTitleMatch ? ogTitleMatch[1] : titleMatch ? titleMatch[1] : null,
      type: "website",
    })
  } catch (error) {
    console.error("[url-preview] Unexpected error:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 500 })
  }
}
