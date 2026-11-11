"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BookOpenText,
  CheckSquare,
  FileText,
  FolderPlus,
  Inbox,
  Link2,
  Map,
  Paintbrush,
  Plus,
  Shield,
  Sparkles,
  Target,
  Timer,
  Users,
  Wand2,
  Zap,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { HubGrid, HubHero, type HubCard } from "@/components/hub-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type WorkspaceTab = "plan" | "capture" | "visual" | "systems"

const planCards: HubCard[] = [
  {
    title: "Tasks",
    description: "Your list, board, calendar and habits. Waiting and Later live here too.",
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
    title: "Focus Goal",
    description: "Keep one intense goal visible when you need deep focus.",
    href: "/nuke",
    icon: Zap,
    badge: "Deep focus",
  },
  {
    title: "Focus Timer",
    description: "Use a lightweight timer for focused work sessions.",
    href: "/pomodoro",
    icon: Timer,
    badge: "Utility",
    priority: "secondary",
  },
]

const captureCards: HubCard[] = [
  {
    title: "Capture Inbox",
    description: "Jot it down, or let AI sort it into tasks and events.",
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
    title: "Journal Shortcut",
    description: "Jump to daily reflection, gratitude, and tomorrow setup.",
    href: "/journal",
    icon: BookOpenText,
    badge: "Daily",
  },
  {
    title: "Quick Add",
    description: "Use the top-bar or mobile plus button anywhere in LifeSort.",
    href: "/inbox",
    icon: Plus,
    badge: "Always available",
    priority: "secondary",
  },
]

const visualCards: HubCard[] = [
  {
    title: "Whiteboard",
    description: "Sketch, map plans, and collaborate visually in realtime.",
    href: "/whiteboard",
    icon: Paintbrush,
    priority: "primary",
  },
  {
    title: "Spaces",
    description: "Group related notes, whiteboards, tasks, links, projects, and systems by context.",
    href: "/spaces",
    icon: Map,
    priority: "primary",
  },
]

const systemsCards: HubCard[] = [
  {
    title: "Custom Sections",
    description: "Create structured lists for anything LifeSort does not model yet.",
    href: "/custom-sections",
    icon: FolderPlus,
    priority: "primary",
  },
  {
    title: "Smart Templates",
    description: "Apply prebuilt life systems after previewing their items.",
    href: "/templates",
    icon: Sparkles,
    priority: "primary",
  },
  {
    title: "AI Template Builder",
    description: "Generate an editable LifeSort system from a prompt, then preview before creating.",
    href: "/templates?mode=ai",
    icon: Wand2,
    priority: "secondary",
  },
  {
    title: "People",
    description: "Relationships, contacts, birthdays, reminders, and follow-ups.",
    href: "/people",
    icon: Users,
    priority: "secondary",
  },
  {
    title: "Life Vault",
    description: "Important documents, renewals, warranties, and records.",
    href: "/vault",
    icon: Shield,
    priority: "secondary",
  },
]

const tabCopy: Record<WorkspaceTab, { title: string; description: string; cards: HubCard[] }> = {
  plan: {
    title: "Plan active work",
    description: "Tasks, goals, projects, Focus Goal and Focus Timer live here.",
    cards: planCards,
  },
  capture: {
    title: "Capture and sort inputs",
    description: "Use this area when something needs to be saved, parsed, or organized later.",
    cards: captureCards,
  },
  visual: {
    title: "Map ideas visually",
    description: "Whiteboards and Spaces help you plan beyond lists.",
    cards: visualCards,
  },
  systems: {
    title: "Build reusable systems",
    description: "Templates, custom structures, people, and vault records keep LifeSort extensible.",
    cards: systemsCards,
  },
}

function readInitialTab(): WorkspaceTab {
  if (typeof window === "undefined") return "plan"
  const tab = new URL(window.location.href).searchParams.get("tab")
  // "follow-ups" folded into Tasks (Stage 1 step 3), so old links land on the plan tab.
  return tab === "capture" || tab === "visual" || tab === "systems" || tab === "plan" ? tab : "plan"
}

export default function WorkspacePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("plan")

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: supports deep-linking to a
    // specific tab via ?tab=, overriding the default "plan".
    setActiveTab(readInitialTab())
  }, [])

  const changeTab = (tab: string) => {
    const next = tab as WorkspaceTab
    setActiveTab(next)
    router.replace(`/workspace?tab=${next}`, { scroll: false })
  }

  return (
    <DashboardLayout title="Workspace" subtitle="Plan, capture, visual tools, systems, and follow-ups">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <HubHero title="Workspace" description={tabCopy[activeTab].description} />

        <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
          <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1 sm:inline-flex sm:w-auto">
            <TabsTrigger value="plan" className="min-w-max flex-1 sm:flex-none">Tasks & Goals</TabsTrigger>
            <TabsTrigger value="capture" className="min-w-max flex-1 sm:flex-none">Inbox & Ideas</TabsTrigger>
            <TabsTrigger value="visual" className="min-w-max flex-1 sm:flex-none">Boards & Spaces</TabsTrigger>
            <TabsTrigger value="systems" className="min-w-max flex-1 sm:flex-none">Templates & Routines</TabsTrigger>
          </TabsList>

          {(["plan", "capture", "visual", "systems"] as WorkspaceTab[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="section-enter space-y-5 md:space-y-6">
              <HubGrid cards={tabCopy[tab].cards} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
