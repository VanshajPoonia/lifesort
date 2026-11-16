import { redirect } from "next/navigation"

import { redirectTarget } from "@/lib/redirect-target"

// Rules is a tab of Settings since 2026-11-16.
export default async function RulesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(redirectTarget("/settings", await searchParams, { tab: "rules" }))
}
