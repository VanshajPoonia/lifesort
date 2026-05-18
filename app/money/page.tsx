"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart, PiggyBank, Target, TrendingUp, Wallet } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { FavoritesTodo, HubGrid, HubHero, type HubCard } from "@/components/hub-page"
import { AppEmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type IncomeSource = {
  amount?: number | string | null
  frequency?: string | null
  active?: boolean | null
}

type BudgetData = {
  categories?: unknown[]
  transactions?: unknown[]
  summary?: {
    income?: number | string | null
    expenses?: number | string | null
    balance?: number | string | null
  }
}

type Investment = {
  amount?: number | string | null
  current_value?: number | string | null
}

type WishlistItem = {
  price?: number | string | null
  purchased?: boolean | null
}

type MoneySummary = {
  income: IncomeSource[]
  budget: BudgetData | null
  investments: Investment[]
  wishlist: WishlistItem[]
}

const moneyCards: HubCard[] = [
  {
    title: "Overview",
    description: "Use this page as the finance hub before jumping into a specific money tool.",
    href: "/money",
    icon: Wallet,
    badge: "Current page",
    priority: "primary",
  },
  {
    title: "Budget",
    description: "Categories, transactions, goals, and spending context.",
    href: "/budget",
    icon: Wallet,
    badge: "Budget tool",
    priority: "primary",
  },
  {
    title: "Income",
    description: "Track income sources, payment timing, and active status.",
    href: "/income",
    icon: Target,
    badge: "Income tool",
    priority: "primary",
  },
  {
    title: "Investments",
    description: "Monitor positions, prices, returns, and finance-related assets.",
    href: "/investments",
    icon: TrendingUp,
    badge: "Portfolio",
  },
  {
    title: "Wishlist",
    description: "Plan purchases, savings ideas, priorities, and bought items.",
    href: "/wishlist",
    icon: Heart,
    badge: "Savings",
  },
]

function toNumber(value: unknown) {
  const number = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0
  return Number.isFinite(number) ? number : 0
}

function monthlyAmount(source: IncomeSource) {
  const amount = toNumber(source.amount)
  switch ((source.frequency || "monthly").toLowerCase()) {
    case "weekly":
      return amount * 4.333
    case "biweekly":
      return amount * 2.166
    case "yearly":
    case "annually":
      return amount / 12
    case "quarterly":
      return amount / 3
    case "monthly":
    default:
      return amount
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export default function MoneyHubPage() {
  const [summary, setSummary] = useState<MoneySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadSummary() {
      setLoading(true)
      const [income, budget, investments, wishlist] = await Promise.all([
        safeFetch<IncomeSource[]>("/api/income"),
        safeFetch<BudgetData>("/api/budget"),
        safeFetch<Investment[]>("/api/investments"),
        safeFetch<WishlistItem[]>("/api/wishlist"),
      ])
      if (!cancelled) {
        setSummary({
          income: Array.isArray(income) ? income : [],
          budget,
          investments: Array.isArray(investments) ? investments : [],
          wishlist: Array.isArray(wishlist) ? wishlist : [],
        })
        setLoading(false)
      }
    }

    loadSummary()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const monthlyIncome = summary?.income
      .filter((source) => source.active !== false)
      .reduce((total, source) => total + monthlyAmount(source), 0) ?? 0
    const budgetBalance = toNumber(summary?.budget?.summary?.balance)
    const portfolio = summary?.investments.reduce((total, item) => total + (toNumber(item.current_value) || toNumber(item.amount)), 0) ?? 0
    const wishlist = summary?.wishlist.filter((item) => !item.purchased).reduce((total, item) => total + toNumber(item.price), 0) ?? 0
    const hasData = Boolean(
      summary &&
        (summary.income.length > 0 ||
          (summary.budget?.categories?.length || 0) > 0 ||
          (summary.budget?.transactions?.length || 0) > 0 ||
          summary.investments.length > 0 ||
          summary.wishlist.length > 0),
    )

    return { monthlyIncome, budgetBalance, portfolio, wishlist, hasData }
  }, [summary])

  return (
    <DashboardLayout title="Money" subtitle="Budget, income, investments, and wishlist">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <HubHero
          eyebrow="Money"
          title="Keep financial decisions in one place"
          description="Jump into the money tools without crowding the main sidebar with every finance module."
        />
        <Card className="surface-card section-enter">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  Money summary
                </CardTitle>
                <CardDescription>Real values from your finance modules. Empty sources stay labeled as no data.</CardDescription>
              </div>
              {!loading && <Badge variant="outline">{stats.hasData ? "Tracked data" : "No data"}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
            ) : stats.hasData ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile label="Monthly income" value={summary?.income.length ? formatCurrency(stats.monthlyIncome) : "No data"} />
                <SummaryTile label="Budget balance" value={summary?.budget ? formatCurrency(stats.budgetBalance) : "No data"} />
                <SummaryTile label="Portfolio" value={summary?.investments.length ? formatCurrency(stats.portfolio) : "No data"} />
                <SummaryTile label="Wishlist" value={summary?.wishlist.length ? formatCurrency(stats.wishlist) : "No data"} />
              </div>
            ) : (
              <AppEmptyState
                icon={Wallet}
                title="No money data yet"
                hint="Budget, income, investments, and wishlist totals will appear here once you add real records."
                primaryAction={{ label: "Open Budget", href: "/budget" }}
                secondaryAction={{ label: "Add Income", href: "/income" }}
                className="border-dashed bg-background/70"
              />
            )}
          </CardContent>
        </Card>
        <HubGrid cards={moneyCards} />
        <FavoritesTodo />
      </div>
    </DashboardLayout>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
