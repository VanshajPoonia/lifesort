import { redirect } from "next/navigation"

import { redirectTarget } from "@/lib/redirect-target"

// Maintenance folded into Tasks in Stage 1 step 3 (2026-11-11).
export default async function MaintenanceRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { life_area_id: lifeAreaId } = await searchParams
  redirect(redirectTarget("/tasks", typeof lifeAreaId === "string" ? { life_area_id: lifeAreaId } : {}, {}))
}
