import { Briefcase, Dumbbell, FileText, GraduationCap, House, Plane, Search, Sparkles, Wallet, type LucideIcon } from "lucide-react"

import type { KitDefinition } from "@/lib/life-kits"

const icons: Record<KitDefinition["icon"], LucideIcon> = {
  GraduationCap,
  Briefcase,
  House,
  Dumbbell,
  Wallet,
  Search,
  Plane,
  FileText,
  Sparkles,
}

export function KitIcon({ name, className }: { name: KitDefinition["icon"]; className?: string }) {
  const Icon = icons[name] ?? FileText
  return <Icon className={className} aria-hidden="true" />
}

// The person's own date as YYYY-MM-DD. Kits are planned on it, not the server's UTC date.
export function localToday() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
