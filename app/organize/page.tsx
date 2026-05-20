import { redirect } from "next/navigation"

type OrganizeSearchParams = Promise<{
  tab?: string | string[]
}>

const legacyTabMap: Record<string, string> = {
  plan: "plan",
  capture: "capture",
  admin: "systems",
  visual: "visual",
  systems: "systems",
  "follow-ups": "follow-ups",
}

export default async function OrganizeCompatibilityPage({
  searchParams,
}: {
  searchParams: OrganizeSearchParams
}) {
  const params = await searchParams
  const rawTab = Array.isArray(params?.tab) ? params.tab[0] : params?.tab
  const tab = rawTab ? legacyTabMap[rawTab] : null

  redirect(tab ? `/workspace?tab=${tab}` : "/workspace")
}
