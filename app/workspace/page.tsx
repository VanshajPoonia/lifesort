import { redirect } from "next/navigation"

// Workspace was split into the seven places in Stage 1 step 8 (2026-11-11).
// Each old tab lands where its things live now.
const destinations: Record<string, string> = {
  plan: "/tasks",
  capture: "/inbox",
  visual: "/library?tab=whiteboards",
  systems: "/templates",
  "follow-ups": "/tasks?status=waiting",
}

export default async function WorkspaceRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tab } = await searchParams
  redirect(destinations[typeof tab === "string" ? tab : "plan"] ?? "/tasks")
}
