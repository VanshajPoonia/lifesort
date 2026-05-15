"use client"

import { useMemo, useState } from "react"
import type { ElementType } from "react"
import {
  Calendar,
  CheckSquare,
  DollarSign,
  FileText,
  Heart,
  Link2,
  Target,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type QuickAddType =
  | "task"
  | "goal"
  | "note"
  | "wishlist"
  | "link"
  | "income"
  | "investment"
  | "calendar-event"

type FieldType = "text" | "textarea" | "number" | "date" | "time" | "select" | "url"

type QuickAddField = {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
}

type QuickAddConfig = {
  type: QuickAddType
  label: string
  description: string
  endpoint: string
  eventType: string
  icon: ElementType
  fields: QuickAddField[]
  buildPayload: (values: Record<string, string>) => Record<string, unknown>
}

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

const categoryOptions = [
  { value: "personal", label: "Personal" },
  { value: "career", label: "Career" },
  { value: "health", label: "Health" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
]

const incomeTypeOptions = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
]

const frequencyOptions = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one-time", label: "One-time" },
]

const investmentTypeOptions = [
  { value: "stock", label: "Stock" },
  { value: "crypto", label: "Crypto" },
  { value: "fund", label: "Fund" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
]

function numericValue(value: string) {
  if (!value.trim()) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

const quickAddConfigs: QuickAddConfig[] = [
  {
    type: "task",
    label: "Task",
    description: "Capture a to-do",
    endpoint: "/api/tasks",
    eventType: "task",
    icon: CheckSquare,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, placeholder: "Finish project outline" },
      { name: "due_date", label: "Due date", type: "date" },
      { name: "priority", label: "Priority", type: "select", options: priorityOptions },
    ],
    buildPayload: (values) => ({
      title: values.title,
      due_date: values.due_date || null,
      priority: values.priority || "medium",
    }),
  },
  {
    type: "goal",
    label: "Goal",
    description: "Start a goal",
    endpoint: "/api/goals",
    eventType: "goal",
    icon: Target,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, placeholder: "Run a 10K" },
      { name: "category", label: "Category", type: "select", options: categoryOptions },
      { name: "target_date", label: "Target date", type: "date" },
      { name: "priority", label: "Priority", type: "select", options: priorityOptions },
    ],
    buildPayload: (values) => ({
      title: values.title,
      category: values.category || "personal",
      target_date: values.target_date || null,
      priority: values.priority || "medium",
      status: "active",
    }),
  },
  {
    type: "note",
    label: "Note",
    description: "Save a thought",
    endpoint: "/api/notes",
    eventType: "note",
    icon: FileText,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, placeholder: "Meeting idea" },
      { name: "content", label: "Content", type: "textarea", placeholder: "Write a few lines..." },
    ],
    buildPayload: (values) => ({ title: values.title, content: values.content || "" }),
  },
  {
    type: "wishlist",
    label: "Wishlist",
    description: "Save something to buy",
    endpoint: "/api/wishlist",
    eventType: "wishlist",
    icon: Heart,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, placeholder: "Desk lamp" },
      { name: "price", label: "Price", type: "number", placeholder: "49.99" },
      { name: "link", label: "URL", type: "url", placeholder: "https://..." },
    ],
    buildPayload: (values) => ({
      title: values.title,
      price: numericValue(values.price),
      link: values.link || null,
      category: "general",
      priority: "medium",
    }),
  },
  {
    type: "link",
    label: "Link",
    description: "Bookmark a URL",
    endpoint: "/api/links",
    eventType: "link",
    icon: Link2,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, placeholder: "Useful article" },
      { name: "url", label: "URL", type: "url", required: true, placeholder: "https://..." },
    ],
    buildPayload: (values) => ({ title: values.title, url: values.url, link_type: "link" }),
  },
  {
    type: "income",
    label: "Income",
    description: "Add a source",
    endpoint: "/api/income",
    eventType: "income",
    icon: DollarSign,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "Paycheck" },
      { name: "type", label: "Type", type: "select", required: true, options: incomeTypeOptions },
      { name: "amount", label: "Amount", type: "number", placeholder: "3000" },
      { name: "frequency", label: "Frequency", type: "select", options: frequencyOptions },
    ],
    buildPayload: (values) => ({
      name: values.name,
      type: values.type || "other",
      amount: numericValue(values.amount) || 0,
      frequency: values.frequency || "monthly",
      active: true,
    }),
  },
  {
    type: "investment",
    label: "Investment",
    description: "Track an asset",
    endpoint: "/api/investments",
    eventType: "investment",
    icon: TrendingUp,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "Index fund" },
      { name: "type", label: "Type", type: "select", required: true, options: investmentTypeOptions },
      { name: "amount", label: "Amount", type: "number", placeholder: "500" },
      { name: "symbol", label: "Symbol", type: "text", placeholder: "VOO" },
    ],
    buildPayload: (values) => ({
      name: values.name,
      type: values.type || "other",
      amount: numericValue(values.amount) || 0,
      symbol: values.symbol || null,
    }),
  },
  {
    type: "calendar-event",
    label: "Calendar",
    description: "Schedule an event",
    endpoint: "/api/calendar-events",
    eventType: "calendar-event",
    icon: Calendar,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, placeholder: "Dentist appointment" },
      { name: "event_date", label: "Date", type: "date", required: true },
      { name: "start_time", label: "Start", type: "time", required: true },
      { name: "end_time", label: "End", type: "time", required: true },
    ],
    buildPayload: (values) => ({
      title: values.title,
      event_date: values.event_date,
      start_time: values.start_time,
      end_time: values.end_time,
    }),
  },
]

const defaultValues: Record<QuickAddType, Record<string, string>> = {
  task: { priority: "medium" },
  goal: { category: "personal", priority: "medium" },
  note: {},
  wishlist: {},
  link: {},
  income: { type: "salary", frequency: "monthly" },
  investment: { type: "stock" },
  "calendar-event": {},
}

interface QuickAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickAddModal({ open, onOpenChange }: QuickAddModalProps) {
  const { toast } = useToast()
  const [activeType, setActiveType] = useState<QuickAddType>("task")
  const [values, setValues] = useState<Record<string, string>>(defaultValues.task)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const config = useMemo(() => quickAddConfigs.find((item) => item.type === activeType) || quickAddConfigs[0], [activeType])

  const handleTypeChange = (type: QuickAddType) => {
    setActiveType(type)
    setValues(defaultValues[type] || {})
    setError("")
  }

  const setField = (field: string, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setError("")
  }

  const validate = () => {
    const missing = config.fields.find((field) => field.required && !values[field.name]?.trim())
    if (missing) {
      return `${missing.label} is required.`
    }

    return ""
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.buildPayload(values)),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || `Failed to create ${config.label.toLowerCase()}.`)
      }

      window.dispatchEvent(
        new CustomEvent("lifesort:quick-add-created", {
          detail: { type: config.eventType, item: data },
        }),
      )

      toast({
        title: `${config.label} added`,
        description: "Saved to LifeSort.",
      })
      setValues(defaultValues[activeType] || {})
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Quick Add</DialogTitle>
          <DialogDescription>Add common LifeSort items without leaving this page.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {quickAddConfigs.map((item) => {
              const Icon = item.icon
              const isActive = item.type === activeType

              return (
                <Button
                  key={item.type}
                  type="button"
                  variant={isActive ? "secondary" : "ghost"}
                  className="h-auto justify-start gap-3 px-3 py-3 text-left"
                  onClick={() => handleTypeChange(item.type)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </Button>
              )
            })}
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmit()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {config.fields.map((field) => (
                <div key={field.name} className={field.type === "textarea" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                  <Label htmlFor={`quick-add-${field.name}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  {field.type === "select" ? (
                    <Select value={values[field.name] || ""} onValueChange={(value) => setField(field.name, value)}>
                      <SelectTrigger id={`quick-add-${field.name}`}>
                        <SelectValue placeholder={field.placeholder || field.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      id={`quick-add-${field.name}`}
                      value={values[field.name] || ""}
                      onChange={(event) => setField(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      className="min-h-[110px]"
                    />
                  ) : (
                    <Input
                      id={`quick-add-${field.name}`}
                      type={field.type}
                      value={values[field.name] || ""}
                      onChange={(event) => setField(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      step={field.type === "number" ? "0.01" : undefined}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : `Add ${config.label}`}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
