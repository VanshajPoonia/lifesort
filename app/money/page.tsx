"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Heart,
  type LucideIcon,
  Loader2,
  PiggyBank,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

import type { CashFlowChartItem } from "@/app/budget/charts"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AppEmptyState } from "@/components/empty-state"
import { HubHero } from "@/components/hub-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, normalizeCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

type MoneyTab = "overview" | "budget" | "income" | "investments" | "wishlist"

type IncomeSource = {
  amount?: number | string | null
  frequency?: string | null
  active?: boolean | null
}

type BudgetCategoryUsage = {
  id: number
  name: string
  color?: string | null
  icon?: string | null
  budget_limit: number | string
  spent: number | string
  percent_used: number | string
  remaining: number | string
}

type BudgetData = {
  categories?: unknown[]
  transactions?: unknown[]
  goals?: Array<{ wishlist_item_id?: number | string | null }>
  cash_flow?: CashFlowChartItem[]
  category_usage?: BudgetCategoryUsage[]
  summary?: {
    income?: number | string | null
    expenses?: number | string | null
    balance?: number | string | null
  }
}

type Investment = {
  name?: string | null
  type?: string | null
  symbol?: string | null
  amount?: number | string | null
  current_value?: number | string | null
}

type WishlistItem = {
  id: number
  title: string
  price?: number | string | null
  priority?: "low" | "medium" | "high" | string | null
  purchased?: boolean | null
}

type VaultItem = {
  id: number
  title: string
  expiry_date?: string | null
  renewal_date?: string | null
}

type Liability = {
  id: number
  name: string
  balance: number
  interest_rate: number
  monthly_payment: number
  due_date: string | null
}

type MoneySummary = {
  income: IncomeSource[]
  budget: BudgetData | null
  investments: Investment[]
  wishlist: WishlistItem[]
  vault: VaultItem[]
  liabilities: Liability[]
}

const BudgetPanel = dynamic(() => import("@/components/money/budget-panel").then((mod) => mod.BudgetPanel), {
  ssr: false,
  loading: () => <MoneyTabFallback />,
})
const IncomePanel = dynamic(() => import("@/components/money/income-panel").then((mod) => mod.IncomePanel), {
  ssr: false,
  loading: () => <MoneyTabFallback />,
})
const InvestmentsPanel = dynamic(() => import("@/components/money/investments-panel").then((mod) => mod.InvestmentsPanel), {
  ssr: false,
  loading: () => <MoneyTabFallback />,
})
const WishlistPanel = dynamic(() => import("@/components/money/wishlist-panel").then((mod) => mod.WishlistPanel), {
  ssr: false,
  loading: () => <MoneyTabFallback />,
})
const CashFlowBarChart = dynamic(() => import("@/app/budget/charts").then((mod) => mod.CashFlowBarChart), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
})

const tabCopy: Record<MoneyTab, { title: string; description: string }> = {
  overview: {
    title: "Financial dashboard",
    description: "A real overview of cash flow, budget pressure, upcoming bills, savings goals, and estimated net worth.",
  },
  budget: {
    title: "Budget",
    description: "Categories, transactions, goals, and spending context.",
  },
  income: {
    title: "Income",
    description: "Track income sources, payment timing, and active status.",
  },
  investments: {
    title: "Investments",
    description: "Monitor positions, prices, returns, and finance-related assets.",
  },
  wishlist: {
    title: "Wishlist",
    description: "Plan purchases, savings ideas, priorities, and bought items.",
  },
}

const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }

function MoneyTabFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}

function readInitialTab(): MoneyTab {
  if (typeof window === "undefined") return "overview"
  const tab = new URL(window.location.href).searchParams.get("tab")
  return tab === "budget" || tab === "income" || tab === "investments" || tab === "wishlist" || tab === "overview" ? tab : "overview"
}

function toNumber(value: unknown) {
  const number = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0
  return Number.isFinite(number) ? number : 0
}

function monthlyAmount(source: IncomeSource) {
  const amount = toNumber(source.amount)
  switch ((source.frequency || "monthly").toLowerCase()) {
    case "daily":
      return amount * 30
    case "weekly":
      return amount * 4.333
    case "biweekly":
    case "bi-weekly":
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

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function daysUntil(dateString: string) {
  const today = new Date(`${localDateString()}T00:00:00`)
  const dueDate = new Date(`${dateString.slice(0, 10)}T00:00:00`)
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000)
}

function nextBillDate(item: VaultItem) {
  const candidates = [item.renewal_date, item.expiry_date]
    .filter((date): date is string => Boolean(date))
    .map((date) => date.slice(0, 10))
    .filter((date) => {
      const days = daysUntil(date)
      return days >= 0 && days <= 30
    })
    .sort()
  return candidates[0] || null
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

function emptyLiabilityForm() {
  return {
    id: null as number | null,
    name: "",
    balance: "",
    interest_rate: "",
    monthly_payment: "",
    due_date: "",
  }
}

export default function MoneyHubPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<MoneyTab>("overview")
  const [summary, setSummary] = useState<MoneySummary | null>(null)
  const [preferredCurrency, setPreferredCurrency] = useState("USD")
  const [loading, setLoading] = useState(true)
  const [liabilityForm, setLiabilityForm] = useState(emptyLiabilityForm)
  const [savingLiability, setSavingLiability] = useState(false)

  useEffect(() => {
    setActiveTab(readInitialTab())
  }, [])

  const loadSummary = async () => {
    setLoading(true)
    const [profile, income, budget, investments, wishlist, vault, liabilities] = await Promise.all([
      safeFetch<{ preferred_currency?: string }>("/api/profile"),
      safeFetch<IncomeSource[]>("/api/income"),
      safeFetch<BudgetData>("/api/budget"),
      safeFetch<Investment[]>("/api/investments"),
      safeFetch<WishlistItem[]>("/api/wishlist"),
      safeFetch<VaultItem[]>("/api/vault"),
      safeFetch<Liability[]>("/api/liabilities"),
    ])

    setPreferredCurrency(normalizeCurrency(profile?.preferred_currency))
    setSummary({
      income: Array.isArray(income) ? income : [],
      budget,
      investments: Array.isArray(investments) ? investments : [],
      wishlist: Array.isArray(wishlist) ? wishlist : [],
      vault: Array.isArray(vault) ? vault : [],
      liabilities: Array.isArray(liabilities) ? liabilities : [],
    })
    setLoading(false)
  }

  useEffect(() => {
    loadSummary()
  }, [])

  const stats = useMemo(() => {
    const incomeFromSources = summary?.income
      .filter((source) => source.active !== false)
      .reduce((total, source) => total + monthlyAmount(source), 0) ?? 0
    const budgetIncome = toNumber(summary?.budget?.summary?.income)
    const monthlyIncome = incomeFromSources > 0 ? incomeFromSources : budgetIncome
    const monthlyExpenses = toNumber(summary?.budget?.summary?.expenses)
    const budgetBalance = toNumber(summary?.budget?.summary?.balance)
    const portfolio = summary?.investments.reduce((total, item) => total + (toNumber(item.current_value) || toNumber(item.amount)), 0) ?? 0
    const liabilities = summary?.liabilities.reduce((total, item) => total + toNumber(item.balance), 0) ?? 0
    const assets = portfolio + budgetBalance
    const netWorth = assets - liabilities
    const monthlySurplus = monthlyIncome - monthlyExpenses
    const savingsRate = monthlyIncome > 0 ? (monthlySurplus / monthlyIncome) * 100 : null
    const hasData = Boolean(
      summary &&
        (summary.income.length > 0 ||
          (summary.budget?.categories?.length || 0) > 0 ||
          (summary.budget?.transactions?.length || 0) > 0 ||
          summary.investments.length > 0 ||
          summary.wishlist.length > 0 ||
          summary.vault.length > 0 ||
          summary.liabilities.length > 0),
    )

    return { monthlyIncome, monthlyExpenses, budgetBalance, portfolio, liabilities, assets, netWorth, savingsRate, hasData }
  }, [summary])

  const cashFlow = useMemo(() => summary?.budget?.cash_flow || [], [summary])

  const budgetHealth = useMemo(() => {
    return (summary?.budget?.category_usage || [])
      .filter((category) => toNumber(category.budget_limit) > 0 && toNumber(category.percent_used) >= 70)
      .sort((a, b) => toNumber(b.percent_used) - toNumber(a.percent_used))
  }, [summary])

  const upcomingBills = useMemo(() => {
    return (summary?.vault || [])
      .map((item) => {
        const dueDate = nextBillDate(item)
        return dueDate ? { ...item, dueDate, days: daysUntil(dueDate) } : null
      })
      .filter((item): item is VaultItem & { dueDate: string; days: number } => Boolean(item))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
  }, [summary])

  const wishlistGoals = useMemo(() => {
    return (summary?.wishlist || [])
      .filter((item) => !item.purchased && toNumber(item.price) > 0)
      .sort((a, b) => (priorityWeight[b.priority || "medium"] || 2) - (priorityWeight[a.priority || "medium"] || 2) || toNumber(b.price) - toNumber(a.price))
      .slice(0, 3)
  }, [summary])

  const moneyScore = useMemo(() => {
    const usage = summary?.budget?.category_usage || []
    const budgetScore = usage.length
      ? Math.round(
          (usage.reduce((sum, category) => {
            const limit = toNumber(category.budget_limit)
            const spent = toNumber(category.spent)
            if (limit <= 0) return sum
            return sum + (spent <= limit ? 1 : Math.max(0, limit / spent))
          }, 0) / usage.length) * 30,
        )
      : 0
    const savingsScore = stats.savingsRate === null ? 0 : stats.savingsRate >= 20 ? 25 : stats.savingsRate >= 10 ? 15 : 5
    const portfolioScore = summary?.investments.length ? 15 : 0
    const linkedWishlistScore = summary?.budget?.goals?.some((goal) => goal.wishlist_item_id) ? 10 : 0
    const today = localDateString()
    const hasOverdueLiabilities = (summary?.liabilities || []).some((liability) => liability.balance > 0 && liability.due_date && liability.due_date < today)
    const liabilityScore = hasOverdueLiabilities ? 0 : 20
    const hasScoreData = Boolean(usage.length || stats.monthlyIncome > 0 || summary?.investments.length || summary?.budget?.goals?.some((goal) => goal.wishlist_item_id) || summary?.liabilities.length)
    return {
      value: Math.max(0, Math.min(100, budgetScore + savingsScore + portfolioScore + linkedWishlistScore + liabilityScore)),
      hasData: hasScoreData,
    }
  }, [stats.monthlyIncome, stats.savingsRate, summary])

  const changeTab = (tab: string) => {
    const next = tab as MoneyTab
    setActiveTab(next)
    router.replace(`/money?tab=${next}`, { scroll: false })
  }

  const saveLiability = async () => {
    if (!liabilityForm.name.trim()) return
    setSavingLiability(true)
    try {
      const response = await fetch("/api/liabilities", {
        method: liabilityForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: liabilityForm.id,
          name: liabilityForm.name,
          balance: Number(liabilityForm.balance || 0),
          interest_rate: Number(liabilityForm.interest_rate || 0),
          monthly_payment: Number(liabilityForm.monthly_payment || 0),
          due_date: liabilityForm.due_date || null,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not save liability")
      toast({ title: liabilityForm.id ? "Liability updated" : "Liability added" })
      setLiabilityForm(emptyLiabilityForm())
      await loadSummary()
    } catch (error) {
      toast({
        title: "Could not save liability",
        description: error instanceof Error ? error.message : "Try again from Money.",
        variant: "destructive",
      })
    } finally {
      setSavingLiability(false)
    }
  }

  const deleteLiability = async (id: number) => {
    try {
      const response = await fetch("/api/liabilities", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) throw new Error("Could not delete liability")
      toast({ title: "Liability deleted" })
      await loadSummary()
    } catch (error) {
      toast({
        title: "Could not delete liability",
        description: error instanceof Error ? error.message : "Try again from Money.",
        variant: "destructive",
      })
    }
  }

  return (
    <DashboardLayout title="Money" subtitle="Budget, income, investments, and wishlist">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <HubHero
          eyebrow="Money"
          title={tabCopy[activeTab].title}
          description={tabCopy[activeTab].description}
        />

        <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
          <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1 sm:inline-flex sm:w-auto">
            <TabsTrigger value="overview" className="min-w-24 flex-1 sm:flex-none">Overview</TabsTrigger>
            <TabsTrigger value="budget" className="min-w-24 flex-1 sm:flex-none">Budget</TabsTrigger>
            <TabsTrigger value="income" className="min-w-24 flex-1 sm:flex-none">Income</TabsTrigger>
            <TabsTrigger value="investments" className="min-w-32 flex-1 sm:flex-none">Investments</TabsTrigger>
            <TabsTrigger value="wishlist" className="min-w-24 flex-1 sm:flex-none">Wishlist</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="section-enter space-y-5 md:space-y-6">
            {loading ? (
              <MoneyDashboardSkeleton />
            ) : stats.hasData ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MoneyScoreCard score={moneyScore.value} hasData={moneyScore.hasData} />
                  <MetricCard
                    icon={Wallet}
                    title="Estimated Net Worth"
                    value={formatCurrency(stats.netWorth, preferredCurrency)}
                    hint={`${formatCurrency(stats.assets, preferredCurrency)} assets - ${formatCurrency(stats.liabilities, preferredCurrency)} liabilities`}
                    emphasize
                  />
                  <MetricCard
                    icon={PiggyBank}
                    title="Savings Rate"
                    value={stats.savingsRate === null ? "No income data" : `${stats.savingsRate.toFixed(0)}%`}
                    hint={`${formatCurrency(stats.monthlyIncome, preferredCurrency)} income - ${formatCurrency(stats.monthlyExpenses, preferredCurrency)} expenses`}
                    status={stats.savingsRate === null ? "neutral" : stats.savingsRate >= 20 ? "good" : stats.savingsRate >= 10 ? "warning" : "danger"}
                  />
                  <MetricCard
                    icon={TrendingUp}
                    title="Portfolio"
                    value={formatCurrency(stats.portfolio, preferredCurrency)}
                    hint="Current investment value"
                  />
                  <MetricCard
                    icon={CreditCard}
                    title="Liabilities"
                    value={formatCurrency(stats.liabilities, preferredCurrency)}
                    hint={`${summary?.liabilities.length || 0} debt item${summary?.liabilities.length === 1 ? "" : "s"}`}
                  />
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                  <Card className="surface-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BadgeDollarSign className="h-5 w-5 text-primary" />
                        Cash Flow
                      </CardTitle>
                      <CardDescription>Income and expenses over the last 6 months.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {cashFlow.length > 0 ? (
                        <CashFlowBarChart data={cashFlow} currency={preferredCurrency} />
                      ) : (
                        <AppEmptyState icon={BadgeDollarSign} title="No cash flow yet" hint="Add budget transactions to see monthly income and expenses." className="border-dashed bg-background/70" />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="surface-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        Budget Health
                      </CardTitle>
                      <CardDescription>Categories at 70% or more of their monthly limit.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {budgetHealth.length === 0 ? (
                        <div className="rounded-md border border-success/20 bg-success/10 p-4 text-sm text-success">
                          <CheckCircle2 className="mb-2 h-5 w-5" />
                          All budgets on track
                        </div>
                      ) : (
                        budgetHealth.map((category) => (
                          <div key={category.id} className="rounded-md border bg-muted/25 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{category.name}</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(category.remaining, preferredCurrency)} remaining</p>
                              </div>
                              <span className={cn("text-sm font-semibold", toNumber(category.percent_used) >= 100 ? "text-destructive" : "text-warning")}>
                                {toNumber(category.percent_used).toFixed(0)}%
                              </span>
                            </div>
                            <Progress value={Math.min(100, toNumber(category.percent_used))} className="mt-3 h-2" />
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card className="surface-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        Upcoming Bills
                      </CardTitle>
                      <CardDescription>Vault renewals and expiries due in the next 30 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {upcomingBills.length === 0 ? (
                        <AppEmptyState icon={CalendarClock} title="No bills due soon" hint="Vault items with renewal or expiry dates will appear here." className="border-dashed bg-background/70 p-5" />
                      ) : (
                        upcomingBills.map((bill) => (
                          <div key={bill.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/25 p-3 text-sm">
                            <div>
                              <p className="font-medium">{bill.title}</p>
                              <p className="text-xs text-muted-foreground">Due {new Date(`${bill.dueDate}T00:00:00`).toLocaleDateString()}</p>
                            </div>
                            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                              {bill.days === 0 ? "Today" : `${bill.days}d`}
                            </span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="surface-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-rose-500" />
                        Wishlist Savings Goals
                      </CardTitle>
                      <CardDescription>Approximate progress using current budget balance.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {wishlistGoals.length === 0 ? (
                        <AppEmptyState icon={Heart} title="No wishlist goals yet" hint="Unpurchased wishlist items with prices will appear here." className="border-dashed bg-background/70 p-5" />
                      ) : (
                        wishlistGoals.map((item) => {
                          const price = toNumber(item.price)
                          const progress = price > 0 ? Math.min(100, (Math.max(0, stats.budgetBalance) / price) * 100) : 0
                          return (
                            <div key={item.id} className="rounded-md border bg-muted/25 p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item.title}</p>
                                  <p className="text-xs text-muted-foreground">{formatCurrency(price, preferredCurrency)}</p>
                                </div>
                                <span className="text-sm font-semibold">{progress.toFixed(0)}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          )
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-destructive" />
                      Liabilities
                    </CardTitle>
                    <CardDescription>Minimal debt tracking used by the estimated net worth calculation.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-5">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="liability-name">Name</Label>
                        <Input id="liability-name" value={liabilityForm.name} onChange={(event) => setLiabilityForm((current) => ({ ...current, name: event.target.value }))} placeholder="Student Loan" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="liability-balance">Balance</Label>
                        <Input id="liability-balance" type="number" value={liabilityForm.balance} onChange={(event) => setLiabilityForm((current) => ({ ...current, balance: event.target.value }))} placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="liability-rate">Interest %</Label>
                        <Input id="liability-rate" type="number" value={liabilityForm.interest_rate} onChange={(event) => setLiabilityForm((current) => ({ ...current, interest_rate: event.target.value }))} placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="liability-payment">Monthly</Label>
                        <Input id="liability-payment" type="number" value={liabilityForm.monthly_payment} onChange={(event) => setLiabilityForm((current) => ({ ...current, monthly_payment: event.target.value }))} placeholder="0.00" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="liability-due">Due date</Label>
                        <Input id="liability-due" type="date" value={liabilityForm.due_date} onChange={(event) => setLiabilityForm((current) => ({ ...current, due_date: event.target.value }))} />
                      </div>
                      <div className="flex items-end gap-2 md:col-span-3">
                        <Button onClick={saveLiability} disabled={savingLiability || !liabilityForm.name.trim()} className="gap-2">
                          {savingLiability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          {liabilityForm.id ? "Update Liability" : "Add Liability"}
                        </Button>
                        {liabilityForm.id && (
                          <Button variant="outline" onClick={() => setLiabilityForm(emptyLiabilityForm())}>Cancel</Button>
                        )}
                      </div>
                    </div>

                    {summary?.liabilities.length === 0 ? (
                      <AppEmptyState icon={CreditCard} title="No liabilities tracked" hint="Add debts here to subtract them from estimated net worth." className="border-dashed bg-background/70 p-5" />
                    ) : (
                      <div className="divide-y rounded-md border">
                        {summary?.liabilities.map((liability) => (
                          <div key={liability.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium">{liability.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(liability.balance, preferredCurrency)} balance · {liability.interest_rate}% APR · {formatCurrency(liability.monthly_payment, preferredCurrency)} / mo
                                {liability.due_date ? ` · due ${new Date(`${liability.due_date}T00:00:00`).toLocaleDateString()}` : ""}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLiabilityForm({
                                  id: liability.id,
                                  name: liability.name,
                                  balance: String(liability.balance),
                                  interest_rate: String(liability.interest_rate),
                                  monthly_payment: String(liability.monthly_payment),
                                  due_date: liability.due_date || "",
                                })}
                              >
                                Edit
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteLiability(liability.id)} aria-label={`Delete ${liability.name}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <AppEmptyState
                icon={Wallet}
                title="No money data yet"
                hint="Budget, income, investments, wishlist, Vault bills, and liabilities will appear here once you add real records."
                primaryAction={{ label: "Open Budget", href: "/money?tab=budget" }}
                secondaryAction={{ label: "Add Income", href: "/money?tab=income" }}
                className="border-dashed bg-background/70"
              />
            )}
          </TabsContent>

          <TabsContent value="budget" className="section-enter">
            <BudgetPanel preferredCurrency={preferredCurrency} />
          </TabsContent>
          <TabsContent value="income" className="section-enter">
            <IncomePanel preferredCurrency={preferredCurrency} />
          </TabsContent>
          <TabsContent value="investments" className="section-enter">
            <InvestmentsPanel preferredCurrency={preferredCurrency} />
          </TabsContent>
          <TabsContent value="wishlist" className="section-enter">
            <WishlistPanel preferredCurrency={preferredCurrency} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

function MoneyDashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}

function MoneyScoreCard({ score, hasData }: { score: number; hasData: boolean }) {
  return (
    <Card className="surface-card border-primary/30 bg-primary/5">
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${hasData ? score : 0}%, hsl(var(--muted)) ${hasData ? score : 0}% 100%)` }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card">
            <span className="text-xl font-bold">{hasData ? score : "--"}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Money Score</p>
          <p className="mt-1 text-sm font-medium">{hasData ? "Financial health signal" : "No financial data yet"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Budget, savings, investing, goals, and debt.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({
  icon: Icon,
  title,
  value,
  hint,
  emphasize = false,
  status = "neutral",
}: {
  icon: LucideIcon
  title: string
  value: string
  hint: string
  emphasize?: boolean
  status?: "neutral" | "good" | "warning" | "danger"
}) {
  return (
    <Card className={cn("surface-card", emphasize && "border-primary/30 bg-primary/5")}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tracking-normal",
                status === "good" && "text-success",
                status === "warning" && "text-warning",
                status === "danger" && "text-destructive",
              )}
            >
              {value}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
