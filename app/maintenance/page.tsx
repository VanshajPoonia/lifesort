"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MaintenancePage() {
  return (
    <DashboardLayout title="Life Maintenance" subtitle="Recurring renewals, checkups, repairs, reviews, and admin.">
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Items</CardTitle>
          <CardDescription>Track recurring responsibilities that keep life running.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Maintenance tracking is being set up.</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
