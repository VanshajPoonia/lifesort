import { Loader2 } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"

export default function RulesLoading() {
  return (
    <DashboardLayout title="Personal Operating Rules" subtitle="Preferences and constraints for LifeSort planning">
      <Card>
        <CardContent className="flex min-h-[320px] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your rules...
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
