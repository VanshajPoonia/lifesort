"use client"

// Isolated to this file so next/dynamic can exclude it from the server bundle.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer } from "@/components/ui/chart"

export interface CategoryChartItem {
  name: string
  Spent: number
  Budget?: number
  color: string
}

export interface PieChartItem {
  name: string
  value: number
}

const PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
]

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function SpendingBarChart({ data }: { data: CategoryChartItem[] }) {
  return (
    <ChartContainer config={{}} className="h-56">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
        <Tooltip formatter={(value: number) => [`$${fmt(value)}`]} />
        <Bar dataKey="Spent" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
        <Bar dataKey="Budget" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

export function ExpensePieChart({ data }: { data: PieChartItem[] }) {
  return (
    <ChartContainer config={{}} className="h-56">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }: { name: string; percent: number }) =>
            percent > 0.05 ? `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%` : ""
          }
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`$${fmt(value)}`]} />
      </PieChart>
    </ChartContainer>
  )
}
