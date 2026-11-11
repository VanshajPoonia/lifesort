import { redirect } from "next/navigation"

import { redirectTarget } from "@/lib/redirect-target"

// People is a tab of Library since Stage 1 step 6 (2026-11-11).
export default async function PeopleRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(redirectTarget("/library", await searchParams, { tab: "people" }))
}
