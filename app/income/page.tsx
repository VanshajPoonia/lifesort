"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  DollarSign,
  Plus,
  Trash2,
  Briefcase,
  Home,
  Repeat,
  TrendingUp,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface IncomeSource {
  id: string
  name: string
  type: string
  amount: number
  frequency: string
  active: boolean
  description?: string
}

export default function IncomePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'frequency' | 'type'>('name')
  const [newIncome, setNewIncome] = useState({
    name: "",
    type: "",
    amount: "",
    frequency: "",
    description: "",
  })
  const [editingIncome, setEditingIncome] = useState<IncomeSource | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchIncomeSources()
    }
  }, [user])

  const fetchIncomeSources = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/income')
      if (response.ok) {
        const data = await response.json()
        setIncomeSources(data)
      }
    } catch (error) {
      console.error('[v0] Failed to fetch income sources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddIncome = async () => {
    if (newIncome.name && newIncome.type && newIncome.amount && newIncome.frequency) {
      try {
        const response = await fetch('/api/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newIncome.name,
            type: newIncome.type,
            amount: parseFloat(newIncome.amount),
            frequency: newIncome.frequency,
            description: newIncome.description,
            active: true,
          }),
        })

        if (response.ok) {
          await fetchIncomeSources()
          setNewIncome({ name: "", type: "", amount: "", frequency: "", description: "" })
          setIsAddDialogOpen(false)
        }
      } catch (error) {
        console.error('[v0] Failed to add income source:', error)
      }
    }
  }

  const handleDeleteIncome = async (id: string) => {
    try {
      const response = await fetch('/api/income', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (response.ok) {
        await fetchIncomeSources()
      }
    } catch (error) {
      console.error('[v0] Failed to delete income source:', error)
    }
  }

  const toggleActiveStatus = async (id: string) => {
    const source = incomeSources.find((s) => s.id === id)
    if (!source) return

    try {
      const response = await fetch('/api/income', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          active: !source.active,
        }),
      })

      if (response.ok) {
        await fetchIncomeSources()
      }
    } catch (error) {
      console.error('[v0] Failed to toggle income source:', error)
    }
  }

  const handleUpdateIncome = async () => {
    if (!editingIncome) return

    try {
      const response = await fetch('/api/income', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingIncome),
      })

      if (response.ok) {
        await fetchIncomeSources()
        setEditingIncome(null)
        setIsEditDialogOpen(false)
      }
    } catch (error) {
      console.error('[v0] Failed to update income source:', error)
    }
  }

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      Employment: "bg-primary/10 text-primary",
      Freelance: "bg-success/10 text-success",
      Passive: "bg-accent/10 text-accent",
      Business: "bg-warning/10 text-warning",
      Other: "bg-muted text-muted-foreground",
    }
    return colors[type] || "bg-muted text-muted-foreground"
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Employment":
        return <Briefcase className="h-4 w-4" />
      case "Freelance":
        return <Home className="h-4 w-4" />
      case "Passive":
        return <Repeat className="h-4 w-4" />
      case "Business":
        return <DollarSign className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  // Calculate monthly equivalent for all income sources
  const calculateMonthlyEquivalent = (amount: number, frequency: string) => {
    switch (frequency.toLowerCase()) {
      case "daily":
        return amount * 30
      case "weekly":
        return amount * 4
      case "biweekly":
        return amount * 2
      case "monthly":
        return amount
      case "quarterly":
        return amount / 3
      case "yearly":
        return amount / 12
      default:
        return amount
    }
  }

  const stats = {
    totalSources: incomeSources.filter((s) => s.active).length,
    monthlyIncome: incomeSources
      .filter((s) => s.active)
      .reduce((acc, inc) => acc + calculateMonthlyEquivalent(inc.amount, inc.frequency), 0),
    yearlyIncome: incomeSources
      .filter((s) => s.active)
      .reduce((acc, inc) => acc + calculateMonthlyEquivalent(inc.amount, inc.frequency), 0) * 12,
    passiveIncome: incomeSources
      .filter((s) => s.active && s.type === "Passive")
      .reduce((acc, inc) => acc + calculateMonthlyEquivalent(inc.amount, inc.frequency), 0),
  }

  // Group income by type - use name if type is empty/undefined
  const incomeByType = incomeSources
    .filter((s) => s.active)
    .reduce(
      (acc, inc) => {
        const monthly = calculateMonthlyEquivalent(inc.amount, inc.frequency)
        const typeKey = inc.type || inc.name || 'Other'
        acc[typeKey] = (acc[typeKey] || 0) + monthly
        return acc
      },
      {} as { [key: string]: number }
    )

  // Sort income sources
  const sortedSources = [...incomeSources].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'amount') return b.amount - a.amount
    if (sortBy === 'type') return a.type.localeCompare(b.type)
    if (sortBy === 'frequency') return a.frequency.localeCompare(b.frequency)
    return 0
  })

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Income Sources" subtitle="Track all your revenue streams">
      <div className="space-y-6">
        {/* Income Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSources}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.monthlyIncome.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Yearly Projection</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.yearlyIncome.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Passive Income</CardTitle>
              <Repeat className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.passiveIncome.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">per month</p>
            </CardContent>
          </Card>
        </div>

        {/* Income Breakdown */}
        {Object.keys(incomeByType).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Income Breakdown by Type</CardTitle>
              <CardDescription>Monthly equivalent amounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(incomeByType).map(([type, amount], index) => {
                  const percentage = (amount / stats.monthlyIncome) * 100
                  const barColors = [
                    'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 
                    'bg-rose-500', 'bg-violet-500', 'bg-cyan-500'
                  ]
                  const barColor = barColors[index % barColors.length]
                  return (
                    <div key={type}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${barColor}`} />
                          <Badge className={getTypeColor(type)}>{type}</Badge>
                        </div>
                        <span className="font-medium text-foreground">
                          ${amount.toLocaleString()}/mo ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full ${barColor} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header with Add Button and Sorting */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Income Sources</h2>
            <p className="text-sm text-muted-foreground">Manage your revenue streams</p>
          </div>
          <div className="flex items-center gap-3">
            {incomeSources.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Sort by:</Label>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                    <SelectItem value="frequency">Frequency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Source
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Income Source</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Source Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Freelance Web Design"
                      value={newIncome.name}
                      onChange={(e) => setNewIncome({ ...newIncome, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select value={newIncome.type} onValueChange={(value) => setNewIncome({ ...newIncome, type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Employment">Employment</SelectItem>
                        <SelectItem value="Freelance">Freelance</SelectItem>
                        <SelectItem value="Passive">Passive</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="5000"
                      value={newIncome.amount}
                      onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select value={newIncome.frequency} onValueChange={(value) => setNewIncome({ ...newIncome, frequency: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Biweekly">Biweekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Additional details..."
                      value={newIncome.description}
                      onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddIncome} className="flex-1">
                      Add Income Source
                    </Button>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Income Sources List */}
        {incomeSources.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl font-medium text-foreground mb-2">No income sources yet</p>
              <p className="text-muted-foreground mb-4">Start tracking your revenue streams</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Income Source
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedSources.map((income) => {
              const monthlyEquivalent = calculateMonthlyEquivalent(income.amount, income.frequency)
              return (
                <Card 
                  key={income.id} 
                  className={`cursor-pointer hover:shadow-lg transition-all ${!income.active ? "opacity-60" : ""}`}
                  onClick={() => {
                    setEditingIncome(income)
                    setIsEditDialogOpen(true)
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(income.type)}
                          <CardTitle className="text-lg">{income.name}</CardTitle>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge className={getTypeColor(income.type)}>{income.type}</Badge>
                          <Badge variant={income.active ? "default" : "secondary"}>
                            {income.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteIncome(income.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="text-xl font-bold text-foreground">
                          ${income.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">{income.frequency}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly Equivalent</p>
                        <p className="text-xl font-bold text-success">
                          ${monthlyEquivalent.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">per month</p>
                      </div>
                    </div>
                    {income.description && (
                      <p className="text-sm text-muted-foreground">{income.description}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActiveStatus(income.id)}
                      className="w-full"
                    >
                      {income.active ? "Mark Inactive" : "Mark Active"}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
      {/* Edit Income Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Income Source</DialogTitle>
          </DialogHeader>
          {editingIncome && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Source Name</Label>
                <Input
                  id="edit-name"
                  value={editingIncome.name}
                  onChange={(e) => setEditingIncome({ ...editingIncome, name: e.target.value })}
                  className="text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select value={editingIncome.type} onValueChange={(value) => setEditingIncome({ ...editingIncome, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employment">Employment</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                    <SelectItem value="Passive">Passive</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={editingIncome.amount}
                  onChange={(e) => setEditingIncome({ ...editingIncome, amount: parseFloat(e.target.value) || 0 })}
                  className="text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="edit-frequency">Frequency</Label>
                <Select value={editingIncome.frequency} onValueChange={(value) => setEditingIncome({ ...editingIncome, frequency: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Biweekly">Biweekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingIncome.description || ''}
                  onChange={(e) => setEditingIncome({ ...editingIncome, description: e.target.value })}
                  className="text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdateIncome} className="flex-1">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
