"use client"

import { Bell, Shield, Users, Wrench } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { FavoritesTodo, HubGrid, HubHero } from "@/components/hub-page"

const adminCards = [
  {
    title: "People",
    description: "Relationships, contacts, birthdays, reminders, and follow-ups.",
    href: "/people",
    icon: Users,
  },
  {
    title: "Life Vault",
    description: "Important documents, renewals, warranties, and records.",
    href: "/vault",
    icon: Shield,
  },
  {
    title: "Life Maintenance",
    description: "Recurring admin, repairs, checkups, renewals, and reviews.",
    href: "/maintenance",
    icon: Wrench,
    statusKey: "maintenanceOverdue",
    statusLabel: "overdue",
    zeroLabel: "Clear",
  },
  {
    title: "Reminders",
    description: "Important notifications for due dates, habits, and deadlines.",
    href: "/notifications",
    icon: Bell,
    statusKey: "unreadNotifications",
    statusLabel: "unread",
    zeroLabel: "Clear",
  },
]

export default function LifeAdminHubPage() {
  return (
    <DashboardLayout title="Life Admin" subtitle="People, vault, maintenance, and reminders">
      <div className="space-y-6">
        <HubHero
          eyebrow="Life Admin"
          title="Handle the background responsibilities"
          description="This is the hub for the recurring, relational, and administrative parts of life that should not disappear into a long sidebar."
        />
        <HubGrid cards={adminCards} />
        <FavoritesTodo />
      </div>
    </DashboardLayout>
  )
}
