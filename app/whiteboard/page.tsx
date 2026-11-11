import { redirect } from "next/navigation"

import { redirectTarget } from "@/lib/redirect-target"

// Whiteboard is a tab of Library since Stage 1 step 6 (2026-11-11).
export default async function WhiteboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(redirectTarget("/library", await searchParams, { tab: "whiteboards" }))
}
