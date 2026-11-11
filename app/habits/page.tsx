"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { HabitsView } from "@/components/tasks/habits-view"

export default function HabitsPage() {
  return (
    <DashboardLayout>
      <HabitsView />
    </DashboardLayout>
  )
}
