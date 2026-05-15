"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReminderSettings } from "@/components/reminder-settings"

interface AddGoalDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (goal: {
    title: string
    description: string
    category: string
    target_date: string
    status: string
    priority: string
    email_reminder?: boolean
    reminder_days?: number
    target_value?: number | null
    current_value?: number | null
    value_unit?: string | null
  }) => Promise<void>
}

export function AddGoalDialog({ open, onClose, onAdd }: AddGoalDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "personal",
    target_date: "",
    status: "active",
    priority: "medium",
    email_reminder: true,
    reminder_days: 3,
    target_value: null as number | null,
    current_value: null as number | null,
    value_unit: "",
  })
  const [useNumericTracking, setUseNumericTracking] = useState(false)
  const [noDeadline, setNoDeadline] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState("")

  const handleSubmit = async () => {
    if (!formData.title.trim()) return
    
    if (!noDeadline && !formData.target_date) {
      setDateError("Please set a deadline or select 'No deadline'")
      return
    }
    setDateError("")

    setIsSubmitting(true)
    try {
      await onAdd({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        status: formData.status,
        priority: formData.priority,
        target_date: noDeadline ? "" : formData.target_date,
        email_reminder: noDeadline ? false : formData.email_reminder,
        reminder_days: noDeadline ? 3 : formData.reminder_days,
        target_value: useNumericTracking ? formData.target_value : null,
        current_value: useNumericTracking ? (formData.current_value ?? 0) : null,
        value_unit: useNumericTracking ? formData.value_unit : null,
      })
      setFormData({
        title: "",
        description: "",
        category: "personal",
        target_date: "",
        status: "active",
        priority: "medium",
        email_reminder: true,
        reminder_days: 3,
        target_value: null,
        current_value: null,
        value_unit: "",
      })
      setNoDeadline(false)
      setUseNumericTracking(false)
      onClose()
    } catch (error) {
      console.error("Failed to add goal:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-background">
        <DialogHeader>
          <DialogTitle>Add New Goal</DialogTitle>
          <DialogDescription>
            Create a new goal to track your progress and achieve your dreams
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Goal Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Learn Spanish, Run a Marathon"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your goal and what you want to achieve..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="text-foreground min-h-[100px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="career">Career</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">Target Date *</Label>
              <Input
                id="target_date"
                type="date"
                value={formData.target_date}
                onChange={(e) => {
                  setFormData({ ...formData, target_date: e.target.value })
                  setNoDeadline(false)
                  setDateError("")
                }}
                disabled={noDeadline}
                className="text-foreground"
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="no-deadline"
                  checked={noDeadline}
                  onChange={(e) => {
                    setNoDeadline(e.target.checked)
                    if (e.target.checked) {
                      setFormData({ ...formData, target_date: "" })
                      setDateError("")
                    }
                  }}
                  className="rounded border-muted-foreground"
                />
                <Label htmlFor="no-deadline" className="text-sm text-muted-foreground cursor-pointer">
                  No deadline
                </Label>
              </div>
              {dateError && <p className="text-sm text-destructive">{dateError}</p>}
            </div>
          </div>
          
          {/* Numeric Tracking Option */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-numeric"
                checked={useNumericTracking}
                onChange={(e) => setUseNumericTracking(e.target.checked)}
                className="rounded border-muted-foreground"
              />
              <Label htmlFor="use-numeric" className="text-sm cursor-pointer">
                Track progress with numbers
              </Label>
            </div>
            
            {useNumericTracking && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="space-y-1">
                  <Label htmlFor="target_value" className="text-xs text-muted-foreground">Target</Label>
                  <Input
                    id="target_value"
                    type="number"
                    min="1"
                    placeholder="e.g., 100"
                    value={formData.target_value ?? ""}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      target_value: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="current_value" className="text-xs text-muted-foreground">Starting at</Label>
                  <Input
                    id="current_value"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.current_value ?? ""}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      current_value: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="value_unit" className="text-xs text-muted-foreground">Unit</Label>
                  <Input
                    id="value_unit"
                    type="text"
                    placeholder="e.g., pages"
                    value={formData.value_unit}
                    onChange={(e) => setFormData({ ...formData, value_unit: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Email Reminder Option */}
          {!noDeadline && formData.target_date && (
            <ReminderSettings
              enabled={formData.email_reminder}
              reminderDays={formData.reminder_days}
              onEnabledChange={(enabled) => setFormData({ ...formData, email_reminder: enabled })}
              onReminderDaysChange={(days) => setFormData({ ...formData, reminder_days: days })}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!formData.title.trim() || isSubmitting || (!noDeadline && !formData.target_date)}
          >
            {isSubmitting ? "Adding..." : "Add Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
