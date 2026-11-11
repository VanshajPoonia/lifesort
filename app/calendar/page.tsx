import { redirect } from "next/navigation"

import { redirectTarget } from "@/lib/redirect-target"

// Calendar is a tab of Tasks since Stage 1 step 3 (2026-11-11).
export default async function CalendarRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(redirectTarget("/tasks", await searchParams, { tab: "calendar" }))
}
