import { redirect } from "next/navigation"

import { redirectTarget } from "@/lib/redirect-target"

// Insights was the old name for Reflect. Reflect owns the code since 2026-11-16.
export default async function InsightsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(redirectTarget("/reflect", await searchParams))
}
