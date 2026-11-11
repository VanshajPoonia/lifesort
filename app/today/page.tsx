import { redirect } from "next/navigation"

// Today and Home merged into "/" (Stage 1, 2026-11-11). Keep old links and the week tab working.
export default async function TodayRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tab } = await searchParams
  redirect(tab === "week" ? "/?tab=week" : "/")
}
