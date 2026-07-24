// Shared canonical TypeScript types for LifeSort's core objects, mirroring
// scripts/schema.sql. AI_BUILD_PLAN.md Phase 0 "shared object types" item --
// today most pages define their own narrower ad-hoc local type instead of a
// shared one (e.g. app/tasks/page.tsx's local `interface Task`). This file
// is purely additive: it does not replace or require updating any existing
// per-page type. New or touched code should prefer importing from here over
// redefining these shapes locally; existing per-page types are not migrated
// as part of adding this file.
//
// Some core object types predate this file and already live in their own lib
// module (because they carry logic alongside the type, not just a shape).
// They're re-exported here so this stays the one import surface for "the
// core object types" as a whole.
export type {
  DomainAttention,
  DomainHealthStatus,
  DomainImportance,
  DomainReviewFrequency,
  DomainStatus,
  LifeArea,
} from "@/lib/life-areas"
export type { HydratedSpaceItem, Space, SpaceItemType } from "@/lib/spaces"
export type { Whiteboard, WhiteboardRole, WhiteboardVisibility } from "@/lib/whiteboards"
export type { Session, User } from "@/lib/auth"
export type { ItemRelationship, ItemRelationshipType, RelationType } from "@/lib/item-relationships"

export type TaskStatus = "inbox" | "next" | "in_progress" | "waiting" | "someday" | "completed" | "cancelled"

export type Task = {
  id: number
  user_id: string
  title: string
  description: string | null
  priority: string | null
  due_date: string | null
  due_time: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  duration_minutes: number | null
  status: TaskStatus
  reminder_at: string | null
  completed: boolean | null
  category: string | null
  highlight_of_day: boolean | null
  email_reminder: boolean | null
  reminder_days: number | null
  reminder_sent: boolean | null
  goal_id: number | null
  life_area_id: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type TaskChecklistItem = {
  id: number
  task_id: number
  user_id: string
  title: string
  completed: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type Goal = {
  id: number
  user_id: string
  title: string
  description: string | null
  category: string | null
  target_date: string | null
  progress: number | null
  status: string | null
  priority: string | null
  target_value: number | null
  current_value: number | null
  value_unit: string | null
  email_reminder: boolean | null
  reminder_days: number | null
  reminder_sent: boolean | null
  life_area_id: number | null
  created_at: string
  updated_at: string
}

export type ProjectStatus = "active" | "paused" | "completed" | "archived"
export type ProjectPriority = "low" | "medium" | "high"

export type Project = {
  id: number
  user_id: string
  title: string
  description: string | null
  life_area_id: number | null
  status: ProjectStatus
  priority: ProjectPriority
  start_date: string | null
  due_date: string | null
  progress: number
  created_at: string
  updated_at: string
}

export type Note = {
  id: number
  user_id: string
  title: string | null
  content: string | null
  folder_id: number | null
  tags: string[]
  is_pinned: boolean | null
  life_area_id: number | null
  created_at: string
  updated_at: string
}

export type Person = {
  id: number
  user_id: string
  name: string
  relationship_type: string
  email: string | null
  phone: string | null
  birthday: string | null
  location: string | null
  notes: string | null
  life_area_id: number | null
  tags: string[]
  avatar_color: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type VaultItemCategory =
  | "documents"
  | "subscriptions"
  | "warranty"
  | "insurance"
  | "vehicle"
  | "home"
  | "medical"
  | "education"
  | "work"
  | "other"

export type VaultItem = {
  id: number
  user_id: string
  title: string
  category: VaultItemCategory
  description: string | null
  notes: string | null
  start_date: string | null
  expiry_date: string | null
  renewal_date: string | null
  reminder_date: string | null
  url: string | null
  life_area_id: number | null
  tags: string[]
  created_at: string
  updated_at: string
}

export type WishlistItem = {
  id: number
  user_id: string
  title: string
  description: string | null
  price: number | null
  url: string | null
  image_url: string | null
  priority: string | null
  category: string | null
  purchased: boolean | null
  life_area_id: number | null
  created_at: string
  updated_at: string
}

export type SomedayItemCategory =
  | "idea"
  | "project"
  | "purchase"
  | "travel"
  | "learning"
  | "relationship"
  | "finance"
  | "health"
  | "other"
export type SomedayItemStatus = "someday" | "promoted" | "archived"
export type SomedayPromotedType = "project" | "goal" | "task" | "wishlist_item" | "note"

export type SomedayItem = {
  id: number
  user_id: string
  title: string
  description: string | null
  category: SomedayItemCategory
  life_area_id: number | null
  review_date: string | null
  status: SomedayItemStatus
  promoted_type: SomedayPromotedType | null
  promoted_id: number | null
  created_at: string
  updated_at: string
}

export type InboxObjectType =
  | "task"
  | "goal"
  | "note"
  | "project"
  | "habit"
  | "wishlist_item"
  | "vault_item"
  | "calendar_event"
export type InboxItemStatus = "unsorted" | "converted" | "archived"
export type InboxItemSource = "manual" | "quick_add" | "ai_capture"

export type InboxItem = {
  id: number
  user_id: string
  title: string
  raw_text: string
  suggested_type: InboxObjectType | null
  status: InboxItemStatus
  life_area_id: number | null
  source: InboxItemSource
  converted_type: InboxObjectType | null
  converted_id: number | null
  created_at: string
  updated_at: string
}

export type WaitingOnType =
  | "person"
  | "company"
  | "school"
  | "bank"
  | "government"
  | "delivery"
  | "refund"
  | "job"
  | "other"
export type WaitingItemStatus = "waiting" | "follow_up_needed" | "resolved" | "cancelled"

export type WaitingItem = {
  id: number
  user_id: string
  title: string
  description: string | null
  waiting_on_name: string
  waiting_on_type: WaitingOnType
  status: WaitingItemStatus
  expected_date: string | null
  follow_up_date: string | null
  life_area_id: number | null
  project_id: number | null
  person_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type CommitmentType = "personal" | "work" | "school" | "family" | "friend" | "client" | "financial" | "other"
export type CommitmentStatus = "open" | "at_risk" | "completed" | "missed" | "cancelled"

export type Commitment = {
  id: number
  user_id: string
  title: string
  description: string | null
  committed_to: string
  commitment_type: CommitmentType
  due_date: string | null
  status: CommitmentStatus
  life_area_id: number | null
  project_id: number | null
  person_id: number | null
  related_task_id: number | null
  created_at: string
  updated_at: string
}

export type MaintenanceCategory =
  | "home"
  | "vehicle"
  | "health"
  | "finance"
  | "digital"
  | "school"
  | "work"
  | "business"
  | "other"
export type MaintenanceRecurrence = "weekly" | "monthly" | "quarterly" | "yearly" | "custom"
export type MaintenanceStatus = "active" | "paused" | "completed"

export type MaintenanceItem = {
  id: number
  user_id: string
  title: string
  category: MaintenanceCategory
  recurrence: MaintenanceRecurrence
  custom_interval_days: number | null
  next_due_date: string | null
  last_completed_date: string | null
  reminder_days_before: number
  life_area_id: number | null
  vault_item_id: number | null
  notes: string | null
  status: MaintenanceStatus
  created_at: string
  updated_at: string
}

export type CustomSection = {
  id: number
  user_id: string
  title: string
  icon: string | null
  color: string | null
  position: number | null
  life_area_id: number | null
  created_at: string
  updated_at: string
}

export type JournalEnergyLevel = "low" | "medium" | "high"

export type DailyJournalEntry = {
  id: number
  user_id: string
  journal_date: string
  mood: number | null
  gratitude: string[]
  affirmation_text: string | null
  affirmation_pinned_until: string | null
  work_todo: string[]
  personal_todo: string[]
  family_todo: string[]
  what_went_well: string | null
  what_could_be_better: string | null
  notes_from_today: string | null
  how_to_make_tomorrow_better: string | null
  work_stars: number | null
  work_stars_note: string | null
  personal_stars: number | null
  personal_stars_note: string | null
  family_stars: number | null
  family_stars_note: string | null
  tomorrow_focus: string | null
  tomorrow_avoid: string | null
  energy_level: JournalEnergyLevel | null
  tags: string[]
  locked_at: string | null
  life_area_id: number | null
  created_at: string
  updated_at: string
}

export type Investment = {
  id: number
  user_id: string
  name: string
  type: string | null
  symbol: string | null
  amount: number | null
  current_value: number | null
  cached_price: number | null
  last_price_fetch: string | null
  purchase_date: string | null
  notes: string | null
  estimated_return_rate: number | null
  wishlist_item_id: number | null
  quantity: number | null
  life_area_id: number | null
  created_at: string
  updated_at: string
}

export type IncomeSource = {
  id: number
  user_id: string
  source_name: string
  amount: number
  frequency: string | null
  category: string | null
  next_payment_date: string | null
  active: boolean | null
  life_area_id: number | null
  created_at: string
  updated_at: string
}

export type BudgetCategory = {
  id: number
  user_id: string
  name: string
  color: string | null
  icon: string | null
  budget_limit: number | null
  life_area_id: number | null
  created_at: string
}
