// "Life Domain" in the product (AI_LIFE_DOMAINS_SPEC.md); this module stays named
// life-areas until the deferred Phase-1 table/file rename lands (spec section 2).
export type DomainStatus = "active" | "paused" | "archived" | "hidden"
export type DomainImportance = "low" | "medium" | "high"
export type DomainAttention = "low" | "medium" | "high"
export type DomainReviewFrequency = "weekly" | "monthly" | "quarterly" | "custom" | "none"
export type DomainHealthStatus = "thriving" | "stable" | "needs_attention" | "paused" | "not_assessed"

export type LifeArea = {
  id: string
  user_id?: string
  name: string
  icon: string
  color: string
  description: string | null
  sort_order: number
  status: DomainStatus
  importance: DomainImportance | null
  desired_attention: DomainAttention | null
  review_frequency: DomainReviewFrequency
  health_status: DomainHealthStatus
  parent_domain_id: string | null
  definition_of_success: string | null
  current_concerns: string | null
  long_term_vision: string | null
  current_focus: string | null
  boundaries: string | null
  is_ai_excluded: boolean
  requires_reauth: boolean
  created_at?: string
  updated_at?: string
}

export const DOMAIN_STATUS_OPTIONS: { value: DomainStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
  { value: "hidden", label: "Hidden" },
]

export const DOMAIN_IMPORTANCE_OPTIONS: { value: DomainImportance; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

export const DOMAIN_ATTENTION_OPTIONS: { value: DomainAttention; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

export const DOMAIN_REVIEW_FREQUENCY_OPTIONS: { value: DomainReviewFrequency; label: string }[] = [
  { value: "none", label: "No scheduled review" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "custom", label: "Custom" },
]

export const DOMAIN_HEALTH_STATUS_OPTIONS: { value: DomainHealthStatus; label: string }[] = [
  { value: "not_assessed", label: "Not assessed" },
  { value: "thriving", label: "Thriving" },
  { value: "stable", label: "Stable" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "paused", label: "Paused" },
]

export const DEFAULT_LIFE_AREAS = [
  { name: "Work", icon: "Briefcase", color: "#2563EB", description: "Career, job responsibilities, and professional projects" },
  { name: "School", icon: "GraduationCap", color: "#7C3AED", description: "Classes, coursework, exams, and academic planning" },
  { name: "Finance", icon: "Wallet", color: "#059669", description: "Money, budgets, income, investing, and financial goals" },
  { name: "Health", icon: "HeartPulse", color: "#DC2626", description: "Medical care, wellness, appointments, and health habits" },
  { name: "Fitness", icon: "Dumbbell", color: "#EA580C", description: "Training, movement, strength, and physical goals" },
  { name: "Family", icon: "Home", color: "#DB2777", description: "Family responsibilities, plans, and relationships" },
  { name: "Friends", icon: "Users", color: "#0891B2", description: "Friendships, social plans, and community" },
  { name: "Personal", icon: "User", color: "#4F46E5", description: "Personal admin, routines, and self-management" },
  { name: "Learning", icon: "BookOpen", color: "#9333EA", description: "Skills, reading, courses, and curiosity" },
  { name: "Business", icon: "Building2", color: "#0F766E", description: "Business ideas, operations, clients, and growth" },
  { name: "Home", icon: "House", color: "#CA8A04", description: "Home projects, maintenance, chores, and space planning" },
  { name: "Travel", icon: "Plane", color: "#0284C7", description: "Trips, itineraries, packing, and places to go" },
  { name: "Creativity", icon: "Palette", color: "#C026D3", description: "Creative projects, art, writing, and making things" },
]

export const LIFE_AREA_ICONS = [
  "Briefcase",
  "GraduationCap",
  "Wallet",
  "HeartPulse",
  "Dumbbell",
  "Home",
  "Users",
  "User",
  "BookOpen",
  "Building2",
  "House",
  "Plane",
  "Palette",
  "Target",
  "Sparkles",
  "Calendar",
]

export const LIFE_AREA_COLORS = [
  "#2563EB",
  "#7C3AED",
  "#059669",
  "#DC2626",
  "#EA580C",
  "#DB2777",
  "#0891B2",
  "#4F46E5",
  "#9333EA",
  "#0F766E",
  "#CA8A04",
  "#0284C7",
  "#C026D3",
]

// Builds a minimal LifeArea from denormalized name/icon/color columns stored directly
// on another table's row (used when the full domain record isn't in the fetched list,
// e.g. it was deleted or the caller only loaded item-level data).
export function denormalizedLifeArea(input: { id: string; name: string; icon?: string | null; color?: string | null }): LifeArea {
  return {
    id: input.id,
    name: input.name,
    icon: input.icon || "Target",
    color: input.color || "#64748B",
    description: null,
    sort_order: 0,
    status: "active",
    importance: null,
    desired_attention: null,
    review_frequency: "none",
    health_status: "not_assessed",
    parent_domain_id: null,
    definition_of_success: null,
    current_concerns: null,
    long_term_vision: null,
    current_focus: null,
    boundaries: null,
    is_ai_excluded: false,
    requires_reauth: false,
  }
}

export function normalizeLifeAreaId(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "none") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

export function normalizeLifeArea(raw: Record<string, unknown>): LifeArea {
  return {
    id: String(raw.id),
    user_id: typeof raw.user_id === "string" ? raw.user_id : undefined,
    name: typeof raw.name === "string" ? raw.name : "Untitled domain",
    icon: typeof raw.icon === "string" ? raw.icon : "Target",
    color: typeof raw.color === "string" ? raw.color : "#2563EB",
    description: typeof raw.description === "string" ? raw.description : null,
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : 0,
    status: (typeof raw.status === "string" ? raw.status : "active") as DomainStatus,
    importance: (typeof raw.importance === "string" ? raw.importance : null) as DomainImportance | null,
    desired_attention: (typeof raw.desired_attention === "string" ? raw.desired_attention : null) as DomainAttention | null,
    review_frequency: (typeof raw.review_frequency === "string" ? raw.review_frequency : "none") as DomainReviewFrequency,
    health_status: (typeof raw.health_status === "string" ? raw.health_status : "not_assessed") as DomainHealthStatus,
    parent_domain_id: raw.parent_domain_id === null || raw.parent_domain_id === undefined ? null : String(raw.parent_domain_id),
    definition_of_success: optionalText(raw.definition_of_success),
    current_concerns: optionalText(raw.current_concerns),
    long_term_vision: optionalText(raw.long_term_vision),
    current_focus: optionalText(raw.current_focus),
    boundaries: optionalText(raw.boundaries),
    is_ai_excluded: raw.is_ai_excluded === true,
    requires_reauth: raw.requires_reauth === true,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  }
}
