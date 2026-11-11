"use client"

import { CoachChat } from "@/components/coach/coach-chat"
import { DashboardLayout } from "@/components/dashboard-layout"

// The full Coach view. Every page can also open Coach as a side panel from the header.
export default function AIChatPage() {
  return (
    <DashboardLayout>
      <CoachChat variant="page" />
    </DashboardLayout>
  )
}
