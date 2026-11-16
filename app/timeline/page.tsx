import { redirect } from "next/navigation"

import { redirectTarget } from "@/lib/redirect-target"

// Timeline is a tab of Reflect since 2026-11-16.
export default async function TimelineRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(redirectTarget("/reflect", await searchParams, { tab: "timeline" }))
}
