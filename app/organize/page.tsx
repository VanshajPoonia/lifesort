"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileText,
  Flame,
  FolderPlus,
  Inbox,
  Link2,
  Lightbulb,
  Plus,
  Shield,
  Sparkles,
  Target,
  Timer,
  Users,
  Wand2,
  Wrench,
  Zap,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { FavoritesTodo, HubGrid, HubHero, type HubCard } from "@/components/hub-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type OrganizeTab = "plan" | "capture" | "admin"

const planCards: HubCard[] = [
  {
    title: "Tasks",
    description: "Daily actions, due dates, priorities, and linked goal work.",
    href: "/tasks",
    icon: CheckSquare,
    statusKey: "overdueTasks",
    statusLabel: "overdue",
    zeroLabel: "0 overdue",
    priority: "primary",
  },
  {
    title: "Goals",
    description: "Track outcomes, progress, target dates, and life-area focus.",
    href: "/goals",
    icon: Target,
    priority: "primary",
  },
  {
    title: "Projects",
    description: "Organize larger life efforts with linked records and activity.",
    href: "/projects",
    icon: FolderPlus,
    priority: "primary",
  },
  {
    title: "Habits & Routines",
    description: "Keep recurring practices and routines visible.",
    href: "/habits",
    icon: Flame,
    statusKey: "habitsDueToday",
    statusLabel: "today",
    zeroLabel: "0 today",
    priority: "primary",
  },
  {
    title: "Calendar",
    description: "See events, deadlines, and synced schedule context.",
    href: "/calendar",
    icon: CalendarDays,
    statusKey: "calendarToday",
    statusLabel: "today",
    zeroLabel: "0 today",
  },
  {
    title: "Waiting For",
    description: "Track replies, approvals, deliveries, refunds, and follow-ups.",
    href: "/waiting",
    icon: Clock,
    statusKey: "waitingFollowUpsDue",
    statusLabel: "due",
    zeroLabel: "0 due",
  },
  {
    title: "Commitments",
    description: "Keep promises and obligations visible.",
    href: "/commitments",
    icon: ClipboardCheck,
    statusKey: "commitmentsDueSoon",
    statusLabel: "due soon",
    zeroLabel: "0 pending",
  },
  {
    title: "Someday / Maybe",
    description: "Hold future ideas without making them active yet.",
    href: "/someday",
    icon: Lightbulb,
    statusKey: "somedayReviewDue",
    statusLabel: "to review",
    zeroLabel: "0 to review",
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
    priority: "secondary",
  },
]

const captureCards: HubCard[] = [
  {
    title: "AI Capture",
    description: "Parse messy text into editable draft actions.",
    href: "/capture",
    icon: Wand2,
    badge: "Primary",
    priority: "primary",
  },
  {
    title: "Universal Life Inbox",
    description: "Save unsorted thoughts before deciding where they belong.",
    href: "/inbox",
    icon: Inbox,
    statusKey: "unsortedInbox",
    statusLabel: "unsorted",
    zeroLabel: "0 unsorted",
    priority: "primary",
  },
  {
    title: "Notes",
    description: "Capture knowledge, folders, tags, and reference material.",
    href: "/notes",
    icon: FileText,
    priority: "primary",
  },
  {
    title: "Links",
    description: "Save URLs, folders, resources, and visual bookmarks.",
    href: "/links",
    icon: Link2,
  },
  {
    title: "Custom Sections",
    description: "Create structured lists for anything LifeSort does not model yet.",
    href: "/custom-sections",
    icon: FolderPlus,
  },
  {
    title: "Smart Templates",
    description: "Apply prebuilt life systems after previewing their items.",
    href: "/templates",
    icon: Sparkles,
    badge: "Systems",
  },
  {
    title: "Daily Content",
    description: "Quotes, jokes, games, history, and daily lightness.",
    href: "/daily-content",
    icon: Lightbulb,
    badge: "Utility",
    priority: "secondary",
  },
  {
    title: "Quick Add",
    description: "Use the top-bar or mobile plus button anywhere in LifeSort.",
    href: "/capture",
    icon: Plus,
    badge: "Always available",
    priority: "secondary",
  },
]

const adminCards: HubCard[] = [
  {
    title: "People / Relationships",
    description: "Relationships, contacts, birthdays, reminders, and follow-ups.",
    href: "/people",
    icon: Users,
    priority: "primary",
  },
  {
    title: "Life Vault",
    description: "Important documents, renewals, warranties, and records.",
    href: "/vault",
    icon: Shield,
    priority: "primary",
  },
  {
    title: "Life Maintenance",
    description: "Recurring admin, repairs, checkups, renewals, and reviews.",
    href: "/maintenance",
    icon: Wrench,
    statusKey: "maintenanceOverdue",
    statusLabel: "overdue",
    zeroLabel: "0 overdue",
    priority: "primary",
  },
  {
    title: "Notification Center",
    description: "Notification Center for due dates, habits, and deadlines.",
    href: "/notifications",
    icon: Bell,
    statusKey: "unreadNotifications",
    statusLabel: "unread",
    zeroLabel: "0 unread",
  },
]

const tabCopy: Record<OrganizeTab, { title: string; description: string; cards: HubCard[] }> = {
  plan: {
    title: "Plan active work",
    description: "Tasks, goals, projects, habits, dates, and promises live here.",
    cards: planCards,
  },
  capture: {
    title: "Capture and sort inputs",
    description: "Use this area when something needs to be saved, parsed, or organized later.",
    cards: captureCards,
  },
  admin: {
    title: "Maintain the background systems",
    description: "People, documents, recurring maintenance, and reminders stay together.",
    cards: adminCards,
  },
}

function readInitialTab(): OrganizeTab {
  if (typeof window === "undefined") return "plan"
  const tab = new URL(window.location.href).searchParams.get("tab")
  return tab === "capture" || tab === "admin" || tab === "plan" ? tab : "plan"
}

export default function OrganizePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<OrganizeTab>("plan")

  useEffect(() => {
    setActiveTab(readInitialTab())
  }, [])

  const changeTab = (tab: string) => {
    const next = tab as OrganizeTab
    setActiveTab(next)
    router.replace(`/organize?tab=${next}`, { scroll: false })
  }

  return (
    <DashboardLayout title="Organize" subtitle="Plan, capture, and life admin in one workspace">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <HubHero
          eyebrow="Organize"
          title={tabCopy[activeTab].title}
          description={tabCopy[activeTab].description}
        />

        <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
          <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1 sm:inline-flex sm:w-auto">
            <TabsTrigger value="plan" className="min-w-24 flex-1 sm:flex-none">Plan</TabsTrigger>
            <TabsTrigger value="capture" className="min-w-24 flex-1 sm:flex-none">Capture</TabsTrigger>
            <TabsTrigger value="admin" className="min-w-24 flex-1 sm:flex-none">Admin</TabsTrigger>
          </TabsList>

          {(["plan", "capture", "admin"] as OrganizeTab[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="section-enter space-y-5 md:space-y-6">
              <HubGrid cards={tabCopy[tab].cards} />
              <FavoritesTodo />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
