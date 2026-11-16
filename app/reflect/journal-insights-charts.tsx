"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Entry = {
  journal_date: string
  mood: number | null
  work_stars: number | null
  personal_stars: number | null
  family_stars: number | null
  gratitude: string[]
}

function dateString(date: Date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function average(values: Array<number | null>) {
  const nums = values.filter((value): value is number => typeof value === "number")
  if (!nums.length) return null
  return Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 10) / 10
}

export function JournalMoodTrend({ entries }: { entries: Entry[] }) {
  const byDate = new Map(entries.map((entry) => [entry.journal_date, entry]))
  const start = addDays(new Date(), -29)
  const data = Array.from({ length: 30 }, (_, index) => {
    const date = dateString(addDays(start, index))
    return { date: date.slice(5), mood: byDate.get(date)?.mood ?? null }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
        <Tooltip />
        <Line type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function JournalRatingBreakdown({ entries }: { entries: Entry[] }) {
  const start = addDays(new Date(), -55)
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const weekStart = addDays(start, index * 7)
    const weekEnd = addDays(weekStart, 6)
    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const weekEntries = entries.filter((entry) => entry.journal_date >= dateString(weekStart) && entry.journal_date <= dateString(weekEnd))
    return {
      week: label,
      Work: average(weekEntries.map((entry) => entry.work_stars)),
      Personal: average(weekEntries.map((entry) => entry.personal_stars)),
      Family: average(weekEntries.map((entry) => entry.family_stars)),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={weeks}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
        <Tooltip />
        <Bar dataKey="Work" fill="hsl(var(--primary))" />
        <Bar dataKey="Personal" fill="hsl(var(--success))" />
        <Bar dataKey="Family" fill="hsl(var(--warning))" />
      </BarChart>
    </ResponsiveContainer>
  )
}
