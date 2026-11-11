"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { CalendarView } from "@/components/tasks/calendar-view"

export default function CalendarPage() {
  return (
    <DashboardLayout>
      <CalendarView />
    </DashboardLayout>
  )
}
