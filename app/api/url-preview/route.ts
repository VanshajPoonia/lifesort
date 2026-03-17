import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Check if it's a YouTube URL
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

    // Check if it's a Vimeo URL
    const vimeoRegex = /vimeo\.com\/(\d+)/
    const vimeoMatch = url.match(vimeoRegex)
    if (vimeoMatch) {
      return NextResponse.json({
        thumbnail: `https://vumbnail.com/${vimeoMatch[1]}.jpg`,
        title: "Vimeo Video",
        type: "vimeo",
      })
    }

    // For other URLs (including Facebook, Instagram, etc.), try to fetch og:image
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      const html = await response.text()
      
      // Extract og:image (try multiple patterns)
      const ogImageMatch = 
        html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ||
        html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/) ||
        html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"/) ||
        html.match(/<meta[^>]*content="([^"]*)"[^>]*name="twitter:image"/)
      
      // Extract title
      const ogTitleMatch = 
        html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
        html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/)
      const titleMatch = html.match(/<title>([^<]*)<\/title>/)

      // For Facebook specifically
      let thumbnail = ogImageMatch ? ogImageMatch[1] : null
      
      // Handle relative URLs
      if (thumbnail && !thumbnail.startsWith('http')) {
        const urlObj = new URL(url)
        thumbnail = thumbnail.startsWith('/') 
          ? `${urlObj.protocol}//${urlObj.host}${thumbnail}`
          : `${urlObj.protocol}//${urlObj.host}/${thumbnail}`
      }

      return NextResponse.json({
        thumbnail,
        title: ogTitleMatch ? ogTitleMatch[1] : (titleMatch ? titleMatch[1] : null),
        type: "website",
      })
    } catch (fetchError) {
      console.error("[v0] Error fetching URL preview:", fetchError)
      return NextResponse.json({
        thumbnail: null,
        title: null,
        type: "website",
      })
    }
  } catch (error) {
    console.error("[v0] Error in URL preview:", error)
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 500 })
  }
}
