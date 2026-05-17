import { Loader2 } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"

export default function InboxLoading() {
  return (
    <DashboardLayout title="Inbox">
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    </DashboardLayout>
  )
}
