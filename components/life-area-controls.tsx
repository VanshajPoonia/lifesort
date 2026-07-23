"use client"

import {
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Home,
  House,
  Palette,
  Plane,
  Sparkles,
  Target,
  User,
  Users,
  Wallet,
} from "lucide-react"

import type { LifeArea } from "@/lib/life-areas"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const iconMap = {
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Home,
  House,
  Palette,
  Plane,
  Sparkles,
  Target,
  User,
  Users,
  Wallet,
}

export function LifeAreaIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = iconMap[(name || "Target") as keyof typeof iconMap] || Target
  return <Icon className={className} />
}

export function LifeAreaBadge({
  area,
  fallback = "Unassigned",
}: {
  area?: LifeArea | null
  fallback?: string
}) {
  if (!area) {
    return <Badge variant="outline">{fallback}</Badge>
  }

  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: area.color }} />
      {area.name}
    </Badge>
  )
}

export function LifeAreaSelect({
  areas,
  value,
  onChange,
  placeholder = "No life domain",
}: {
  areas: LifeArea[]
  value?: string | number | null
  onChange: (value: string | null) => void
  placeholder?: string
}) {
  const selected = value === null || value === undefined || value === "" ? "none" : String(value)

  return (
    <Select value={selected} onValueChange={(next) => onChange(next === "none" ? null : next)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {areas.map((area) => (
          <SelectItem key={area.id} value={area.id}>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: area.color }} />
              {area.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
