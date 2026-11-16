import type { PushPayload } from "@/lib/push"

export type ReminderPushItem = {
  title: string
  type: "goal" | "task" | "event"
  reminder_days: number
}

function whenText(days: number) {
  if (days <= 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `Due in ${days} days`
}

// One push per person per morning, however many reminders they have.
export function reminderPushPayload(items: ReminderPushItem[]): PushPayload | null {
  if (items.length === 0) return null
  if (items.length === 1) {
    const [item] = items
    return {
      title: whenText(item.reminder_days),
      body: item.title,
      url: item.type === "goal" ? "/goals" : "/tasks",
      tag: "daily-reminders",
    }
  }
  const names = items.slice(0, 3).map((item) => item.title)
  const more = items.length - names.length
  return {
    title: `${items.length} things coming up`,
    body: more > 0 ? `${names.join(", ")} and ${more} more` : names.join(", "),
    url: "/",
    tag: "daily-reminders",
  }
}
