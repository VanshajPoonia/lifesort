export type LifeArea = {
  id: string
  user_id?: string
  name: string
  icon: string
  color: string
  description: string | null
  sort_order: number
  created_at?: string
  updated_at?: string
}

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

export function normalizeLifeAreaId(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "none") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function normalizeLifeArea(raw: Record<string, unknown>): LifeArea {
  return {
    id: String(raw.id),
    user_id: typeof raw.user_id === "string" ? raw.user_id : undefined,
    name: typeof raw.name === "string" ? raw.name : "Untitled area",
    icon: typeof raw.icon === "string" ? raw.icon : "Target",
    color: typeof raw.color === "string" ? raw.color : "#2563EB",
    description: typeof raw.description === "string" ? raw.description : null,
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : 0,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  }
}
