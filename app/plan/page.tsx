"use client"

import {
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Clock,
  Flame,
  FolderPlus,
  Lightbulb,
  Target,
  Timer,
  Zap,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { FavoritesTodo, HubGrid, HubHero } from "@/components/hub-page"

const planCards = [
  {
    title: "Tasks",
    description: "Daily actions, due dates, priorities, and linked goal work.",
    href: "/tasks",
    icon: CheckSquare,
    statusKey: "overdueTasks",
    statusLabel: "overdue",
    zeroLabel: "Clear",
  },
  {
    title: "Goals",
    description: "Track outcomes, progress, target dates, and life-area focus.",
    href: "/goals",
    icon: Target,
  },
  {
    title: "Projects",
    description: "Organize larger life efforts with linked records and activity.",
    href: "/projects",
    icon: FolderPlus,
  },
  {
    title: "Habits & Routines",
    description: "Keep recurring practices and routines visible.",
    href: "/habits",
    icon: Flame,
    statusKey: "habitsDueToday",
    statusLabel: "due",
    zeroLabel: "Clear",
  },
  {
    title: "Calendar",
    description: "See events, deadlines, and synced schedule context.",
    href: "/calendar",
    icon: CalendarDays,
    statusKey: "calendarToday",
    statusLabel: "today",
  },
  {
    title: "Waiting For",
    description: "Track replies, approvals, deliveries, refunds, and follow-ups.",
    href: "/waiting",
    icon: Clock,
    statusKey: "waitingFollowUpsDue",
    statusLabel: "due",
    zeroLabel: "Clear",
  },
  {
    title: "Commitments",
    description: "Keep promises and obligations you made to yourself or others.",
    href: "/commitments",
    icon: ClipboardCheck,
    statusKey: "commitmentsDueSoon",
    statusLabel: "due soon",
    zeroLabel: "Clear",
  },
  {
    title: "Someday / Maybe",
    description: "Hold ideas and possibilities without making them active yet.",
    href: "/someday",
    icon: Lightbulb,
    statusKey: "somedayReviewDue",
    statusLabel: "to review",
    zeroLabel: "Clear",
  },
  {
    title: "Nuke Goal",
    description: "Keep one intense goal visible when you need deep focus.",
    href: "/nuke",
    icon: Zap,
    badge: "Focus",
  },
  {
    title: "Pomodoro",
    description: "Use a lightweight timer for focused work sessions.",
    href: "/pomodoro",
    icon: Timer,
    badge: "Utility",
  },
]

export default function PlanHubPage() {
  return (
    <DashboardLayout title="Plan" subtitle="Tasks, goals, projects, habits, and commitments">
      <div className="space-y-6">
        <HubHero
          eyebrow="Plan"
          title="Choose the planning surface you need"
          description="Use this hub when you are deciding what to do, what to maintain momentum on, and what needs a follow-up."
        />
        <HubGrid cards={planCards} />
        <FavoritesTodo />
      </div>
    </DashboardLayout>
  )
}
