"use client"

import React, { useMemo } from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ChartContainer } from "@/components/ui/chart"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Calculator,
  Trash2,
  DollarSign,
  ShoppingCart,
  Home,
  Car,
  Utensils,
  Plane,
  Heart,
  Gamepad2,
  Smartphone,
  GraduationCap,
  ArrowRight,
  Loader2,
  BarChart3,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Category {
  id: number
  name: string
  color: string
  icon: string
  budget_limit: number
}

interface Transaction {
  id: number
  category_id: number | null
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  type: "income" | "expense"
  amount: number
  description: string
  date: string
}

interface BudgetGoal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
}

interface Summary {
  income: number
  expenses: number
  balance: number
}

interface IncomeSource {
  id: number
  source_name: string
  category: string
  amount: number
  frequency: string
  active: boolean
}

interface WishlistItem {
  id: number
  title: string
  price: number
  purchased: boolean
}

interface Investment {
  id: number
  name: string
  type: string
  amount: number
  current_value: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  shopping: <ShoppingCart className="h-4 w-4" />,
  home: <Home className="h-4 w-4" />,
  car: <Car className="h-4 w-4" />,
  food: <Utensils className="h-4 w-4" />,
  travel: <Plane className="h-4 w-4" />,
  health: <Heart className="h-4 w-4" />,
  entertainment: <Gamepad2 className="h-4 w-4" />,
  tech: <Smartphone className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  other: <Wallet className="h-4 w-4" />,
}

const PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toMonthly(src: IncomeSource): number {
  if (!src.active) return 0
  switch (src.frequency) {
    case "weekly":    return src.amount * 52 / 12
    case "bi-weekly": return src.amount * 26 / 12
    case "monthly":   return src.amount
    case "quarterly": return src.amount / 3
    case "yearly":    return src.amount / 12
    default:          return src.amount
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<BudgetGoal[]>([])
  const [summary, setSummary] = useState<Summary>({ income: 0, expenses: 0, balance: 0 })
  const [loading, setLoading] = useState(true)

  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])

  // Dialogs
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)

  // Forms
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: "expense",
    amount: "",
    description: "",
    category_id: "",
    date: new Date().toISOString().split("T")[0],
  })
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    color: "#3B82F6",
    icon: "other",
    budget_limit: "",
  })
  const [goalForm, setGoalForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
    deadline: "",
  })

  // Calculator
  const [calcDisplay, setCalcDisplay] = useState("0")
  const [calcPrevious, setCalcPrevious] = useState<string | null>(null)
  const [calcOperator, setCalcOperator] = useState<string | null>(null)

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchBudgetData()
    fetchIncomeData()
    fetchWishlistData()
    fetchInvestmentsData()
  }, [])

  const fetchBudgetData = async () => {
    try {
      const res = await fetch("/api/budget")
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
        setTransactions(data.transactions || [])
        setGoals(data.goals || [])
        setSummary(data.summary || { income: 0, expenses: 0, balance: 0 })
      }
    } catch (err) {
      console.error("Error fetching budget data:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchIncomeData = async () => {
    try {
      const res = await fetch("/api/income")
      if (res.ok) setIncomeSources(await res.json() || [])
    } catch (err) {
      console.error("Error fetching income:", err)
    }
  }

  const fetchWishlistData = async () => {
    try {
      const res = await fetch("/api/wishlist")
      if (res.ok) setWishlistItems(await res.json() || [])
    } catch (err) {
      console.error("Error fetching wishlist:", err)
    }
  }

  const fetchInvestmentsData = async () => {
    try {
      const res = await fetch("/api/investments")
      if (res.ok) setInvestments(await res.json() || [])
    } catch (err) {
      console.error("Error fetching investments:", err)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const monthlyIncome = useMemo(
    () => incomeSources.reduce((acc, s) => acc + toMonthly(s), 0),
    [incomeSources]
  )

  const wishlistTotal = useMemo(
    () => wishlistItems.filter(i => !i.purchased).reduce((acc, i) => acc + (i.price || 0), 0),
    [wishlistItems]
  )

  const investmentsTotal = useMemo(
    () => investments.reduce((acc, i) => acc + (i.current_value || i.amount || 0), 0),
    [investments]
  )

  const investmentsCost = useMemo(
    () => investments.reduce((acc, i) => acc + (i.amount || 0), 0),
    [investments]
  )

  const goalsSaved = useMemo(
    () => goals.reduce((acc, g) => acc + (g.current_amount || 0), 0),
    [goals]
  )

  // Net worth: investments at current value + savings goals − unpurchased wishlist
  const netWorth = investmentsTotal + goalsSaved - wishlistTotal

  const monthlySurplus = monthlyIncome - summary.expenses
  const savingsRate = monthlyIncome > 0 ? (monthlySurplus / monthlyIncome) * 100 : 0

  const wishlistMonths = (() => {
    if (wishlistTotal <= 0) return null
    if (monthlySurplus <= 0) return null
    return Math.ceil(wishlistTotal / monthlySurplus)
  })()

  // Category spending bar chart data
  const categoryChartData = useMemo(() => {
    return categories.map(cat => {
      const spent = transactions
        .filter(t => t.category_id === cat.id && t.type === "expense")
        .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0)
      return {
        name: cat.name.length > 11 ? cat.name.slice(0, 11) + "…" : cat.name,
        Spent: parseFloat(spent.toFixed(2)),
        Budget: cat.budget_limit > 0 ? cat.budget_limit : undefined,
        color: cat.color || "#3B82F6",
      }
    }).filter(d => d.Spent > 0 || (d.Budget ?? 0) > 0)
  }, [categories, transactions])

  // Expense breakdown pie data
  const expensePieData = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {}
    for (const t of transactions) {
      if (t.type !== "expense") continue
      const key = t.category_name || "Uncategorized"
      map[key] = { name: key, value: (map[key]?.value ?? 0) + parseFloat(String(t.amount)) }
    }
    return Object.values(map)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [transactions])

  // ── Mutations ──────────────────────────────────────────────────────────────────

  const handleAddTransaction = async () => {
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "transaction",
          ...transactionForm,
          amount: parseFloat(transactionForm.amount),
          category_id: transactionForm.category_id ? parseInt(transactionForm.category_id) : null,
        }),
      })
      if (res.ok) {
        setShowTransactionDialog(false)
        setTransactionForm({ transaction_type: "expense", amount: "", description: "", category_id: "", date: new Date().toISOString().split("T")[0] })
        fetchBudgetData()
      }
    } catch (err) {
      console.error("Error adding transaction:", err)
    }
  }

  const handleAddCategory = async () => {
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "category",
          ...categoryForm,
          budget_limit: categoryForm.budget_limit ? parseFloat(categoryForm.budget_limit) : 0,
        }),
      })
      if (res.ok) {
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", color: "#3B82F6", icon: "other", budget_limit: "" })
        fetchBudgetData()
      }
    } catch (err) {
      console.error("Error adding category:", err)
    }
  }

  const handleAddGoal = async () => {
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "goal",
          ...goalForm,
          target_amount: parseFloat(goalForm.target_amount),
          current_amount: goalForm.current_amount ? parseFloat(goalForm.current_amount) : 0,
        }),
      })
      if (res.ok) {
        setShowGoalDialog(false)
        setGoalForm({ name: "", target_amount: "", current_amount: "", deadline: "" })
        fetchBudgetData()
      }
    } catch (err) {
      console.error("Error adding goal:", err)
    }
  }

  const handleDeleteTransaction = async (id: number) => {
    try {
      await fetch(`/api/budget?type=transaction&id=${id}`, { method: "DELETE" })
      fetchBudgetData()
    } catch (err) {
      console.error("Error deleting transaction:", err)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    try {
      await fetch(`/api/budget?type=goal&id=${id}`, { method: "DELETE" })
      fetchBudgetData()
    } catch (err) {
      console.error("Error deleting goal:", err)
    }
  }

  // ── Calculator ─────────────────────────────────────────────────────────────────

  const calcInput = (value: string) => {
    setCalcDisplay(prev => (prev === "0" || prev === "Error") ? value : prev + value)
  }
  const calcOperation = (op: string) => {
    setCalcPrevious(calcDisplay)
    setCalcOperator(op)
    setCalcDisplay("0")
  }
  const calcEquals = () => {
    if (!calcPrevious || !calcOperator) return
    const prev = parseFloat(calcPrevious)
    const curr = parseFloat(calcDisplay)
    const results: Record<string, number> = { "+": prev + curr, "-": prev - curr, "*": prev * curr, "/": curr !== 0 ? prev / curr : 0 }
    setCalcDisplay(String(results[calcOperator] ?? 0))
    setCalcPrevious(null)
    setCalcOperator(null)
  }
  const calcClear = () => { setCalcDisplay("0"); setCalcPrevious(null); setCalcOperator(null) }
  const useCalcResult = () => { setTransactionForm(prev => ({ ...prev, amount: calcDisplay })); setShowCalculator(false) }

  // ── Render ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout title="Finance Hub" subtitle="Your complete financial picture">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const hasAnyData = monthlyIncome > 0 || summary.expenses > 0 || investmentsTotal > 0 || wishlistTotal > 0

  return (
    <DashboardLayout title="Finance Hub" subtitle="Your complete financial picture">

      {/* ── Top summary cards ── */}
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
            <div className="rounded-full bg-green-500/20 p-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${fmt(monthlyIncome)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              From {incomeSources.filter(s => s.active).length} active source{incomeSources.filter(s => s.active).length !== 1 ? "s" : ""}
            </p>
            {summary.income > 0 && (
              <p className="mt-2 text-xs text-green-600">+${fmt(summary.income)} recorded this month</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <div className="rounded-full bg-red-500/20 p-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">${fmt(summary.expenses)}</div>
            <p className="mt-1 text-xs text-muted-foreground">This month's tracked spending</p>
            {monthlyIncome > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Of income used</span>
                  <span className="font-medium">{Math.min(100, (summary.expenses / monthlyIncome * 100)).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(100, (summary.expenses / monthlyIncome * 100))} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Surplus</CardTitle>
            <div className="rounded-full bg-blue-500/20 p-2">
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${monthlySurplus >= 0 ? "text-green-600" : "text-red-600"}`}>
              {monthlySurplus >= 0 ? "" : "-"}${fmt(Math.abs(monthlySurplus))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Income minus expenses</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-blue-500/20 pt-3">
              <div>
                <p className="text-xs text-muted-foreground">Savings rate</p>
                <p className="text-sm font-medium">{savingsRate > 0 ? savingsRate.toFixed(0) : 0}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Daily budget</p>
                <p className="text-sm font-medium">${monthlySurplus > 0 ? (monthlySurplus / 30).toFixed(2) : "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Secondary stats + Net Worth ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Investments</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${fmt(investmentsTotal)}</div>
            <p className="text-xs text-muted-foreground">{investments.length} position{investments.length !== 1 ? "s" : ""}</p>
            {investmentsCost > 0 && (
              <p className={`mt-1 text-xs font-medium ${investmentsTotal >= investmentsCost ? "text-green-600" : "text-red-600"}`}>
                {investmentsTotal >= investmentsCost ? "+" : ""}${fmt(investmentsTotal - investmentsCost)} vs cost
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Wishlist</CardTitle>
            <Heart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${fmt(wishlistTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {wishlistItems.filter(i => !i.purchased).length} item{wishlistItems.filter(i => !i.purchased).length !== 1 ? "s" : ""} pending
            </p>
            {wishlistMonths !== null && (
              <p className="mt-1 text-xs text-pink-500">≈ {wishlistMonths} month{wishlistMonths !== 1 ? "s" : ""} of surplus</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Savings Goals</CardTitle>
            <PiggyBank className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{goals.length}</div>
            <p className="text-xs text-muted-foreground">${fmt(goalsSaved)} saved toward goals</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Est. Net Worth</CardTitle>
            <BarChart3 className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${netWorth >= 0 ? "text-violet-600" : "text-red-600"}`}>
              {netWorth >= 0 ? "" : "-"}${fmt(Math.abs(netWorth))}
            </div>
            <p className="text-xs text-muted-foreground">Investments + savings − wishlist</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick links ── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        {[
          { href: "/income",      label: "Income Sources",  desc: `${incomeSources.length} source${incomeSources.length !== 1 ? "s" : ""}`,   icon: <TrendingUp className="h-4 w-4 text-green-500" /> },
          { href: "/investments", label: "Investments",     desc: `${investments.length} position${investments.length !== 1 ? "s" : ""}`,      icon: <BarChart3 className="h-4 w-4 text-emerald-500" /> },
          { href: "/wishlist",    label: "Wishlist",        desc: `${wishlistItems.filter(i=>!i.purchased).length} item${wishlistItems.filter(i=>!i.purchased).length !== 1 ? "s" : ""} pending`, icon: <Heart className="h-4 w-4 text-pink-500" /> },
          { href: "#categories",  label: "Budget Categories", desc: `${categories.length} categor${categories.length !== 1 ? "ies" : "y"}`, icon: <ShoppingCart className="h-4 w-4 text-purple-500" /> },
        ].map(({ href, label, desc, icon }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {icon}
                  <div>
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── No finance data empty state ── */}
      {!hasAnyData && (
        <Card className="mb-6 border-dashed">
          <CardContent className="py-10">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Wallet className="h-6 w-6" /></EmptyMedia>
                <EmptyTitle>Start tracking your finances</EmptyTitle>
                <EmptyDescription>
                  Add income sources, log transactions, and track investments to see your full financial picture.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setShowTransactionDialog(true)} className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Add Transaction
                </Button>
                <Link href="/income">
                  <Button size="sm" variant="outline" className="gap-2">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Add Income
                  </Button>
                </Link>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      )}

      {/* ── Main tabs ── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCalculator(true)}>
              <Calculator className="h-4 w-4 mr-2" />
              Calculator
            </Button>
            <Button size="sm" onClick={() => setShowTransactionDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Spending by category bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending vs Budget</CardTitle>
                <CardDescription>By category this month</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryChartData.length === 0 ? (
                  <Empty className="py-6">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><BarChart3 className="h-5 w-5" /></EmptyMedia>
                      <EmptyTitle>No category data yet</EmptyTitle>
                      <EmptyDescription>Add categories and log transactions to see spending.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer config={{}} className="h-56">
                    <BarChart data={categoryChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip formatter={(value: number) => [`$${fmt(value)}`]} />
                      <Bar dataKey="Spent" radius={[4, 4, 0, 0]}>
                        {categoryChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                      <Bar dataKey="Budget" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Expense breakdown pie chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expense Breakdown</CardTitle>
                <CardDescription>Where your money goes</CardDescription>
              </CardHeader>
              <CardContent>
                {expensePieData.length === 0 ? (
                  <Empty className="py-6">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><TrendingDown className="h-5 w-5" /></EmptyMedia>
                      <EmptyTitle>No expenses recorded</EmptyTitle>
                      <EmptyDescription>Log expense transactions to see your spending breakdown.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer config={{}} className="h-56">
                    <PieChart>
                      <Pie
                        data={expensePieData}
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
                        {expensePieData.map((_, index) => (
                          <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${fmt(value)}`]} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Income vs Expenses summary bar */}
          {(monthlyIncome > 0 || summary.expenses > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Income vs Expenses</CardTitle>
                <CardDescription>Monthly overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Income</span>
                    <span className="font-medium text-green-600">${fmt(monthlyIncome)}</span>
                  </div>
                  <Progress value={100} className="h-3 [&>div]:bg-green-500" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="font-medium text-red-600">${fmt(summary.expenses)}</span>
                  </div>
                  <Progress
                    value={monthlyIncome > 0 ? Math.min(100, (summary.expenses / monthlyIncome) * 100) : 0}
                    className="h-3 [&>div]:bg-red-500"
                  />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Surplus</span>
                    <span className={`font-medium ${monthlySurplus >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      ${fmt(Math.max(0, monthlySurplus))}
                    </span>
                  </div>
                  <Progress
                    value={monthlyIncome > 0 ? Math.max(0, Math.min(100, (monthlySurplus / monthlyIncome) * 100)) : 0}
                    className="h-3 [&>div]:bg-blue-500"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Transactions tab ── */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest income and expenses</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Wallet className="h-5 w-5" /></EmptyMedia>
                    <EmptyTitle>No transactions yet</EmptyTitle>
                    <EmptyDescription>Log your first income or expense to start tracking.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" onClick={() => setShowTransactionDialog(true)} className="gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      Add Transaction
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <div className="space-y-2">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: t.category_color && t.category_color !== "#gray" ? t.category_color : "#9CA3AF" }}
                        >
                          {CATEGORY_ICONS[t.category_icon || "other"] ?? <Wallet className="h-4 w-4 text-white" />}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{t.description || t.category_name || "Uncategorized"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()}{t.category_name ? ` · ${t.category_name}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold tabular-nums ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                          {t.type === "income" ? "+" : "−"}${parseFloat(String(t.amount)).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTransaction(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Categories tab ── */}
        <TabsContent value="categories" className="space-y-4" id="categories">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCategoryDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>

          {categories.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ShoppingCart className="h-5 w-5" /></EmptyMedia>
                <EmptyTitle>No categories yet</EmptyTitle>
                <EmptyDescription>Create spending categories to track your budget limits.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setShowCategoryDialog(true)} className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Add Category
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => {
                const spent = transactions
                  .filter(t => t.category_id === cat.id && t.type === "expense")
                  .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0)
                const percentage = cat.budget_limit > 0 ? (spent / cat.budget_limit) * 100 : 0
                const over = percentage > 100

                return (
                  <Card key={cat.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: cat.color }}>
                          {CATEGORY_ICONS[cat.icon] ?? <Wallet className="h-4 w-4 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="truncate text-base">{cat.name}</CardTitle>
                        </div>
                        {over && <Badge variant="destructive" className="shrink-0 text-[10px]">Over</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">${spent.toFixed(2)}</div>
                      {cat.budget_limit > 0 ? (
                        <>
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>spent</span>
                            <span>${cat.budget_limit.toFixed(2)} limit</span>
                          </div>
                          <Progress value={Math.min(percentage, 100)} className={`h-2 ${over ? "[&>div]:bg-destructive" : ""}`} />
                          {over && <p className="mt-1 text-xs text-destructive">Over by ${(spent - cat.budget_limit).toFixed(2)}</p>}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No limit set</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Goals tab ── */}
        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowGoalDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Savings Goal
            </Button>
          </div>

          {goals.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon"><PiggyBank className="h-5 w-5" /></EmptyMedia>
                <EmptyTitle>No savings goals yet</EmptyTitle>
                <EmptyDescription>Set a savings target and track how close you are.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setShowGoalDialog(true)} className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Add Goal
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map((goal) => {
                const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0
                const remaining = Math.max(0, goal.target_amount - goal.current_amount)
                const monthsLeft = monthlySurplus > 0 && remaining > 0 ? Math.ceil(remaining / monthlySurplus) : null

                return (
                  <Card key={goal.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PiggyBank className="h-5 w-5 text-amber-500" />
                          <CardTitle className="text-base">{goal.name}</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteGoal(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">${parseFloat(String(goal.current_amount)).toFixed(2)}</span>
                        <span className="text-muted-foreground">${parseFloat(String(goal.target_amount)).toFixed(2)}</span>
                      </div>
                      <Progress value={pct} className="h-3 mb-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{pct.toFixed(0)}% complete</span>
                        <span className="flex gap-3">
                          {goal.deadline && <span>Due {new Date(goal.deadline).toLocaleDateString()}</span>}
                          {monthsLeft !== null && <span>~{monthsLeft}mo at current rate</span>}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Transaction Dialog ── */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={transactionForm.transaction_type === "expense" ? "default" : "outline"}
                onClick={() => setTransactionForm(prev => ({ ...prev, transaction_type: "expense" }))}
              >
                <TrendingDown className="h-4 w-4 mr-2" /> Expense
              </Button>
              <Button
                variant={transactionForm.transaction_type === "income" ? "default" : "outline"}
                onClick={() => setTransactionForm(prev => ({ ...prev, transaction_type: "income" }))}
              >
                <TrendingUp className="h-4 w-4 mr-2" /> Income
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" placeholder="0.00" className="pl-9" value={transactionForm.amount}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, amount: e.target.value }))} />
                </div>
                <Button variant="outline" size="icon" onClick={() => setShowCalculator(true)}>
                  <Calculator className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={transactionForm.category_id} onValueChange={(v) => setTransactionForm(prev => ({ ...prev, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="What was this for?" value={transactionForm.description}
                onChange={(e) => setTransactionForm(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={transactionForm.date}
                onChange={(e) => setTransactionForm(prev => ({ ...prev, date: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleAddTransaction} disabled={!transactionForm.amount}>
              Add Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Category Dialog ── */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="e.g., Groceries" value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
                  <Button key={key} variant={categoryForm.icon === key ? "default" : "outline"} size="icon"
                    onClick={() => setCategoryForm(prev => ({ ...prev, icon: key }))}>
                    {icon}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PALETTE.map((color) => (
                  <button key={color}
                    className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${categoryForm.color === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryForm(prev => ({ ...prev, color }))} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly Budget Limit (optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" placeholder="0.00" className="pl-9" value={categoryForm.budget_limit}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, budget_limit: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={handleAddCategory} disabled={!categoryForm.name}>Add Category</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Goal Dialog ── */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Savings Goal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Name</Label>
              <Input placeholder="e.g., Emergency Fund" value={goalForm.name}
                onChange={(e) => setGoalForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Target Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" placeholder="0.00" className="pl-9" value={goalForm.target_amount}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, target_amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Current Amount (optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" placeholder="0.00" className="pl-9" value={goalForm.current_amount}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, current_amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Date (optional)</Label>
              <Input type="date" value={goalForm.deadline}
                onChange={(e) => setGoalForm(prev => ({ ...prev, deadline: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleAddGoal} disabled={!goalForm.name || !goalForm.target_amount}>
              Add Goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Calculator Dialog ── */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader><DialogTitle>Calculator</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="rounded-lg bg-muted p-4 text-right font-mono text-2xl">{calcDisplay}</div>
            <div className="grid grid-cols-4 gap-2">
              {["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"].map((btn) => (
                <Button key={btn} variant={["/","*","-","+","="].includes(btn) ? "secondary" : "outline"} className="h-12 text-lg"
                  onClick={() => btn === "=" ? calcEquals() : ["/","*","-","+"].includes(btn) ? calcOperation(btn) : calcInput(btn)}>
                  {btn}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={calcClear}>Clear</Button>
              <Button className="flex-1" onClick={useCalcResult}>Use Result</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
