"use client"

import React from "react"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Calculator,
  Trash2,
  Edit,
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
  X,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

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

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"]

export default function BudgetPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<BudgetGoal[]>([])
  const [summary, setSummary] = useState<Summary>({ income: 0, expenses: 0, balance: 0 })
  const [loading, setLoading] = useState(true)
  
  // Income, Wishlist, Investments from other tabs
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [wishlistTotal, setWishlistTotal] = useState(0)
  const [investmentsTotal, setInvestmentsTotal] = useState(0)

  // Dialogs
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)

  // Form states
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

  // Calculator state
  const [calcDisplay, setCalcDisplay] = useState("0")
  const [calcPrevious, setCalcPrevious] = useState<string | null>(null)
  const [calcOperator, setCalcOperator] = useState<string | null>(null)

  useEffect(() => {
    fetchBudgetData()
    fetchIncomeData()
    fetchWishlistData()
    fetchInvestmentsData()
  }, [])

  const fetchIncomeData = async () => {
    try {
      const response = await fetch("/api/income")
      if (response.ok) {
        const data = await response.json()
        setIncomeSources(data || [])
        // Calculate monthly income
        const monthly = (data || []).reduce((acc: number, src: IncomeSource) => {
          if (!src.active) return acc
          switch (src.frequency) {
            case "weekly": return acc + (src.amount * 4)
            case "bi-weekly": return acc + (src.amount * 2)
            case "monthly": return acc + src.amount
            case "quarterly": return acc + (src.amount / 3)
            case "yearly": return acc + (src.amount / 12)
            default: return acc + src.amount
          }
        }, 0)
        setMonthlyIncome(monthly)
      }
    } catch (error) {
      console.error("Error fetching income:", error)
    }
  }

  const fetchWishlistData = async () => {
    try {
      const response = await fetch("/api/wishlist")
      if (response.ok) {
        const data = await response.json()
        setWishlistItems(data || [])
        const total = (data || []).filter((i: WishlistItem) => !i.purchased).reduce((acc: number, i: WishlistItem) => acc + (i.price || 0), 0)
        setWishlistTotal(total)
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error)
    }
  }

  const fetchInvestmentsData = async () => {
    try {
      const response = await fetch("/api/investments")
      if (response.ok) {
        const data = await response.json()
        setInvestments(data || [])
        const total = (data || []).reduce((acc: number, i: Investment) => acc + (i.current_value || i.amount || 0), 0)
        setInvestmentsTotal(total)
      }
    } catch (error) {
      console.error("Error fetching investments:", error)
    }
  }

  const fetchBudgetData = async () => {
    try {
      const response = await fetch("/api/budget")
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
        setTransactions(data.transactions || [])
        setGoals(data.goals || [])
        setSummary(data.summary || { income: 0, expenses: 0, balance: 0 })
      }
    } catch (error) {
      console.error("Error fetching budget data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTransaction = async () => {
    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "transaction",
          ...transactionForm,
          amount: parseFloat(transactionForm.amount),
          category_id: transactionForm.category_id ? parseInt(transactionForm.category_id) : null,
        }),
      })

      if (response.ok) {
        setShowTransactionDialog(false)
        setTransactionForm({
          transaction_type: "expense",
          amount: "",
          description: "",
          category_id: "",
          date: new Date().toISOString().split("T")[0],
        })
        fetchBudgetData()
      }
    } catch (error) {
      console.error("Error adding transaction:", error)
    }
  }

  const handleAddCategory = async () => {
    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "category",
          ...categoryForm,
          budget_limit: categoryForm.budget_limit ? parseFloat(categoryForm.budget_limit) : 0,
        }),
      })

      if (response.ok) {
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", color: "#3B82F6", icon: "other", budget_limit: "" })
        fetchBudgetData()
      }
    } catch (error) {
      console.error("Error adding category:", error)
    }
  }

  const handleAddGoal = async () => {
    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "goal",
          ...goalForm,
          target_amount: parseFloat(goalForm.target_amount),
          current_amount: goalForm.current_amount ? parseFloat(goalForm.current_amount) : 0,
        }),
      })

      if (response.ok) {
        setShowGoalDialog(false)
        setGoalForm({ name: "", target_amount: "", current_amount: "", deadline: "" })
        fetchBudgetData()
      }
    } catch (error) {
      console.error("Error adding goal:", error)
    }
  }

  const handleDeleteTransaction = async (id: number) => {
    try {
      await fetch(`/api/budget?type=transaction&id=${id}`, { method: "DELETE" })
      fetchBudgetData()
    } catch (error) {
      console.error("Error deleting transaction:", error)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    try {
      await fetch(`/api/budget?type=goal&id=${id}`, { method: "DELETE" })
      fetchBudgetData()
    } catch (error) {
      console.error("Error deleting goal:", error)
    }
  }

  // Calculator functions
  const calcInput = (value: string) => {
    if (calcDisplay === "0" || calcDisplay === "Error") {
      setCalcDisplay(value)
    } else {
      setCalcDisplay(calcDisplay + value)
    }
  }

  const calcOperation = (op: string) => {
    setCalcPrevious(calcDisplay)
    setCalcOperator(op)
    setCalcDisplay("0")
  }

  const calcEquals = () => {
    if (!calcPrevious || !calcOperator) return
    const prev = parseFloat(calcPrevious)
    const current = parseFloat(calcDisplay)
    let result = 0

    switch (calcOperator) {
      case "+": result = prev + current; break
      case "-": result = prev - current; break
      case "*": result = prev * current; break
      case "/": result = current !== 0 ? prev / current : 0; break
    }

    setCalcDisplay(result.toString())
    setCalcPrevious(null)
    setCalcOperator(null)
  }

  const calcClear = () => {
    setCalcDisplay("0")
    setCalcPrevious(null)
    setCalcOperator(null)
  }

  const useCalcResult = () => {
    setTransactionForm(prev => ({ ...prev, amount: calcDisplay }))
    setShowCalculator(false)
  }

  if (loading) {
    return (
      <DashboardLayout title="Budget" subtitle="Track your finances">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Budget" subtitle="Track your income and expenses">
      {/* Financial Overview - Main Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
            <div className="p-2 rounded-full bg-green-500/20">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">From {incomeSources.filter(s => s.active).length} active sources</p>
            <div className="mt-3 pt-3 border-t border-green-500/20">
              <p className="text-xs text-green-600">Transactions: +${summary.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <div className="p-2 rounded-full bg-red-500/20">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">${summary.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">This month's spending</p>
            {monthlyIncome > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Budget used</span>
                  <span className="font-medium">{Math.min(100, (summary.expenses / monthlyIncome * 100)).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(100, (summary.expenses / monthlyIncome * 100))} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <div className="p-2 rounded-full bg-blue-500/20">
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${summary.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${summary.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Available this month</p>
            <div className="mt-3 pt-3 border-t border-blue-500/20 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Savings Rate</p>
                <p className="text-sm font-medium">{monthlyIncome > 0 ? ((summary.balance / monthlyIncome) * 100).toFixed(0) : 0}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Daily Budget</p>
                <p className="text-sm font-medium">${summary.balance > 0 ? (summary.balance / 30).toFixed(2) : "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Cards - Wishlist & Investments */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Wishlist Total</CardTitle>
            <Heart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${wishlistTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{wishlistItems.filter(i => !i.purchased).length} items remaining</p>
            {monthlyIncome > 0 && wishlistTotal > 0 && (
              <p className="text-xs text-pink-500 mt-2">~{Math.ceil(wishlistTotal / (monthlyIncome - summary.expenses))} months to afford all</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Investments</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${investmentsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{investments.length} total investments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Savings Goals</CardTitle>
            <PiggyBank className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{goals.length}</div>
            <p className="text-xs text-muted-foreground">
              ${goals.reduce((acc, g) => acc + g.current_amount, 0).toLocaleString()} saved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <ShoppingCart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">Budget categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="goals">Savings Goals</TabsTrigger>
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

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest income and expenses</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions yet. Add your first one!</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: t.category_color || "#gray" }}
                        >
                          {CATEGORY_ICONS[t.category_icon || "other"] || <Wallet className="h-4 w-4 text-white" />}
                        </div>
                        <div>
                          <p className="font-medium">{t.description || t.category_name || "Uncategorized"}</p>
                          <p className="text-sm text-muted-foreground">{new Date(t.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                          {t.type === "income" ? "+" : "-"}${parseFloat(String(t.amount)).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(t.id)}>
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

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCategoryDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const spent = transactions
                .filter(t => t.category_id === cat.id && t.type === "expense")
                .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0)
              const percentage = cat.budget_limit > 0 ? (spent / cat.budget_limit) * 100 : 0

              return (
                <Card key={cat.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: cat.color }}
                        >
                          {CATEGORY_ICONS[cat.icon] || <Wallet className="h-4 w-4 text-white" />}
                        </div>
                        <CardTitle className="text-base">{cat.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {cat.budget_limit > 0 && (
                      <>
                        <div className="flex justify-between text-sm mb-1">
                          <span>${spent.toFixed(2)} spent</span>
                          <span>${cat.budget_limit.toFixed(2)} limit</span>
                        </div>
                        <Progress value={Math.min(percentage, 100)} className="h-2" />
                        {percentage > 100 && (
                          <p className="text-xs text-red-500 mt-1">Over budget by ${(spent - cat.budget_limit).toFixed(2)}</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowGoalDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Savings Goal
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => {
              const percentage = (goal.current_amount / goal.target_amount) * 100

              return (
                <Card key={goal.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{goal.name}</CardTitle>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm mb-1">
                      <span>${parseFloat(String(goal.current_amount)).toFixed(2)}</span>
                      <span>${parseFloat(String(goal.target_amount)).toFixed(2)}</span>
                    </div>
                    <Progress value={percentage} className="h-3 mb-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {percentage.toFixed(0)}% complete
                      </span>
                      {goal.deadline && (
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(goal.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {goals.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No savings goals yet. Create one to start tracking!
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Transaction Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={transactionForm.transaction_type === "expense" ? "default" : "outline"}
                onClick={() => setTransactionForm(prev => ({ ...prev, transaction_type: "expense" }))}
              >
                <TrendingDown className="h-4 w-4 mr-2" />
                Expense
              </Button>
              <Button
                variant={transactionForm.transaction_type === "income" ? "default" : "outline"}
                onClick={() => setTransactionForm(prev => ({ ...prev, transaction_type: "income" }))}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Income
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-9"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => setShowCalculator(true)}>
                  <Calculator className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={transactionForm.category_id}
                onValueChange={(value) => setTransactionForm(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="What was this for?"
                value={transactionForm.description}
                onChange={(e) => setTransactionForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={transactionForm.date}
                onChange={(e) => setTransactionForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <Button className="w-full" onClick={handleAddTransaction} disabled={!transactionForm.amount}>
              Add Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g., Groceries"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
                  <Button
                    key={key}
                    variant={categoryForm.icon === key ? "default" : "outline"}
                    size="icon"
                    onClick={() => setCategoryForm(prev => ({ ...prev, icon: key }))}
                  >
                    {icon}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={`h-8 w-8 rounded-full ${categoryForm.color === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Monthly Budget Limit (optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-9"
                  value={categoryForm.budget_limit}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, budget_limit: e.target.value }))}
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleAddCategory} disabled={!categoryForm.name}>
              Add Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Goal Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Savings Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Name</Label>
              <Input
                placeholder="e.g., Emergency Fund"
                value={goalForm.name}
                onChange={(e) => setGoalForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Target Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-9"
                  value={goalForm.target_amount}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, target_amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Current Amount (optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-9"
                  value={goalForm.current_amount}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, current_amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Date (optional)</Label>
              <Input
                type="date"
                value={goalForm.deadline}
                onChange={(e) => setGoalForm(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>

            <Button className="w-full" onClick={handleAddGoal} disabled={!goalForm.name || !goalForm.target_amount}>
              Add Goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculator Dialog */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Calculator</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="bg-muted p-4 rounded-lg text-right text-2xl font-mono">
              {calcDisplay}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"].map((btn) => (
                <Button
                  key={btn}
                  variant={["/", "*", "-", "+", "="].includes(btn) ? "secondary" : "outline"}
                  className="h-12 text-lg"
                  onClick={() => {
                    if (btn === "=") calcEquals()
                    else if (["/", "*", "-", "+"].includes(btn)) calcOperation(btn)
                    else calcInput(btn)
                  }}
                >
                  {btn}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={calcClear}>
                Clear
              </Button>
              <Button className="flex-1" onClick={useCalcResult}>
                Use Result
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
