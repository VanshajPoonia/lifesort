"use client"

import { useState } from "react"
import { Bell, Mail } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ReminderSettingsProps {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  reminderDays: number
  onReminderDaysChange: (days: number) => void
  showCustomOption?: boolean
  className?: string
}

export function ReminderSettings({
  enabled,
  onEnabledChange,
  reminderDays,
  onReminderDaysChange,
  showCustomOption = true,
  className = "",
}: ReminderSettingsProps) {
  return (
    <div className={`rounded-lg border border-border bg-muted/30 p-4 space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="reminder-enabled"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="mt-1 rounded border-muted-foreground accent-primary"
        />
        <div className="flex-1">
          <Label htmlFor="reminder-enabled" className="text-sm font-medium cursor-pointer flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Send me an email reminder
          </Label>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Mail className="h-3 w-3" />
            we will email you before your deadline
          </p>
        </div>
      </div>
      
      {enabled && (
        <div className="pl-6 space-y-2">
          <Label className="text-xs text-muted-foreground">Remind me</Label>
          <Select
            value={reminderDays.toString()}
            onValueChange={(value) => onReminderDaysChange(parseInt(value))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day before</SelectItem>
              <SelectItem value="2">2 days before</SelectItem>
              <SelectItem value="3">3 days before</SelectItem>
              <SelectItem value="5">5 days before</SelectItem>
              <SelectItem value="7">1 week before</SelectItem>
              <SelectItem value="14">2 weeks before</SelectItem>
              <SelectItem value="30">1 month before</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
