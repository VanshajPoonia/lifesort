"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { gsap } from "gsap"
import {
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Loader2,
  Target,
  DollarSign,
  PieChart,
  BarChart3,
  Calendar,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Filter,
  Grid3X3,
  List,
  ArrowUpDown,
  Link2,
  CheckCircle2,
  RefreshCw,
  Search,
  Globe,
  Upload,
  Camera,
  Sparkle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

interface Investment {
  id: number
  name: string
  type: string
  symbol?: string
  amount: number
  current_value: number
  purchase_date: string
  notes?: string
  estimated_return_rate?: number
  wishlist_item_id?: number
  created_at?: string
  quantity?: number
  cached_price?: number
  last_price_fetch?: string
}

interface PopularInvestment {
  id: number
  symbol: string
  name: string
  type: string
  category: string
  region: string
}

interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
}

interface WishlistItem {
  id: number
  title: string
  price?: number
}

const investmentTypes = [
  { value: "Stocks", label: "Stocks", color: "from-blue-500 to-cyan-500" },
  { value: "Bonds", label: "Bonds", color: "from-emerald-500 to-teal-500" },
  { value: "Real Estate", label: "Real Estate", color: "from-amber-500 to-orange-500" },
  { value: "Crypto", label: "Cryptocurrency", color: "from-purple-500 to-pink-500" },
  { value: "Mutual Funds", label: "Mutual Funds", color: "from-indigo-500 to-violet-500" },
  { value: "ETF", label: "ETF", color: "from-rose-500 to-red-500" },
  { value: "Savings Goal", label: "Savings Goal", color: "from-green-500 to-emerald-500" },
  { value: "Other", label: "Other", color: "from-slate-500 to-gray-500" },
] as const

export default function InvestmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [sortBy, setSortBy] = useState<"date" | "return" | "value" | "name">("date")
  const [filterType, setFilterType] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  const [newInvestment, setNewInvestment] = useState({
    name: "",
    type: "Stocks",
    symbol: "",
    amount: "",
    current_value: "",
    purchase_date: "",
    notes: "",
    estimated_return_rate: "",
    wishlist_item_id: "",
    quantity: "",
  })

  const [stockQuotes, setStockQuotes] = useState<Record<string, StockQuote>>({})
  const [fetchingQuotes, setFetchingQuotes] = useState(false)
  const [symbolSearch, setSymbolSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{symbol: string, name: string, region: string}>>([])
  const [searching, setSearching] = useState(false)
  
  // Popular investments
  const [popularInvestments, setPopularInvestments] = useState<PopularInvestment[]>([])
  const [popularCategory, setPopularCategory] = useState("all")
  
  // Screenshot upload
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [parsedInvestments, setParsedInvestments] = useState<Array<{name: string, symbol: string, type: string, quantity: number, amount: number}>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Refresh limits (2 per day)
  const [refreshesRemaining, setRefreshesRemaining] = useState(2)
  const [canRefresh, setCanRefresh] = useState(true)

  useEffect(() => {
  if (!authLoading && !user) {
  router.push("/login")
  } else if (user) {
  fetchInvestments()
  fetchWishlistItems()
  fetchPopularInvestments()
  fetchRefreshLimit()
  }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user || loading) return
    cardsRef.current.forEach((card, index) => {
      if (card) {
        gsap.fromTo(
          card,
          { opacity: 0, y: 20, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, delay: index * 0.05, ease: "power2.out" }
        )
      }
    })
  }, [investments, viewMode])

  // Fetch real-time quotes when investments load
  useEffect(() => {
    if (investments.length > 0) {
      fetchStockQuotes(investments)
    }
  }, [investments])

  const fetchInvestments = async () => {
    try {
      const response = await fetch("/api/investments")
      if (response.ok) {
        const data = await response.json()
        setInvestments(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Error fetching investments:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return

    const handleQuickAdd = (event: Event) => {
      if ((event as CustomEvent).detail?.type === "investment") {
        fetchInvestments()
      }
    }

    window.addEventListener("lifesort:quick-add-created", handleQuickAdd)
    return () => window.removeEventListener("lifesort:quick-add-created", handleQuickAdd)
  }, [user])

  const fetchWishlistItems = async () => {
    try {
      const response = await fetch("/api/wishlist")
      if (response.ok) {
        const data = await response.json()
        setWishlistItems(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error)
    }
  }

  const fetchRefreshLimit = async () => {
    try {
      const response = await fetch("/api/investments/refresh-limit")
      if (response.ok) {
        const data = await response.json()
        setRefreshesRemaining(data.remaining)
        setCanRefresh(data.canRefresh)
      }
    } catch (error) {
      console.error("Error fetching refresh limit:", error)
    }
  }

  const handleRefreshQuotes = async () => {
    if (!canRefresh || refreshesRemaining <= 0) {
      alert("You've reached your daily refresh limit (2 per day). Prices will update automatically tomorrow.")
      return
    }

    // Use a refresh
    try {
      const response = await fetch("/api/investments/refresh-limit", {
        method: "POST",
      })
      
      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Cannot refresh at this time")
        return
      }

      const data = await response.json()
      setRefreshesRemaining(data.remaining)
      setCanRefresh(data.canRefresh)
      
      // Now fetch the quotes
      await fetchStockQuotes()
    } catch (error) {
      console.error("Error using refresh:", error)
    }
  }

  const fetchStockQuotes = async (investmentsList?: Investment[]) => {
    const invs = investmentsList || investments
    const symbolsToFetch = invs
      .filter(inv => inv.symbol && (inv.type === "Stocks" || inv.type === "Crypto" || inv.type === "ETF"))
      .map(inv => ({ symbol: inv.symbol!, type: inv.type }))

    if (symbolsToFetch.length === 0) return

    setFetchingQuotes(true)
    const quotes: Record<string, StockQuote> = {}

    for (const { symbol, type } of symbolsToFetch) {
      try {
        const apiType = type === "Crypto" ? "crypto" : "stock"
        const response = await fetch(`/api/stock-quote?symbol=${encodeURIComponent(symbol)}&type=${apiType}`)
        if (response.ok) {
          const data = await response.json()
          quotes[symbol] = data
        }
      } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error)
      }
    }

    setStockQuotes(prev => ({ ...prev, ...quotes }))
    setFetchingQuotes(false)
  }

  const searchSymbols = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const response = await fetch("/api/stock-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      })
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
      }
    } catch (error) {
      console.error("Error searching symbols:", error)
    } finally {
      setSearching(false)
    }
  }

  const fetchPopularInvestments = async () => {
    try {
      const response = await fetch("/api/investments/popular")
      if (response.ok) {
        const data = await response.json()
        setPopularInvestments(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Error fetching popular investments:", error)
    }
  }

  const handleScreenshotUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploadingScreenshot(true)
    setParsedInvestments([])

    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append("screenshots", files[i])
      }

      const response = await fetch("/api/investments/parse-screenshot", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setParsedInvestments(data.investments || [])
      } else {
        alert("Failed to parse screenshots. Please try again.")
      }
    } catch (error) {
      console.error("Error uploading screenshots:", error)
      alert("Error uploading screenshots")
    } finally {
      setUploadingScreenshot(false)
    }
  }

  const addParsedInvestments = async () => {
    for (const inv of parsedInvestments) {
      try {
        await fetch("/api/investments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: inv.name,
            type: inv.type,
            symbol: inv.symbol,
            amount: inv.amount,
            current_value: inv.amount,
            quantity: inv.quantity,
            purchase_date: new Date().toISOString().split("T")[0],
          }),
        })
      } catch (error) {
        console.error("Error adding parsed investment:", error)
      }
    }
    
    await fetchInvestments()
    setParsedInvestments([])
    setIsUploadDialogOpen(false)
  }

  const selectPopularInvestment = (popular: PopularInvestment) => {
    setNewInvestment({
      ...newInvestment,
      name: popular.name,
      symbol: popular.symbol,
      type: popular.type,
    })
    setSymbolSearch(popular.symbol)
  }

  const handleAddInvestment = async () => {
    if (newInvestment.name && newInvestment.type && newInvestment.amount) {
      try {
        const response = await fetch("/api/investments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newInvestment.name,
            type: newInvestment.type,
            symbol: newInvestment.symbol || null,
            amount: parseFloat(newInvestment.amount),
            current_value: parseFloat(newInvestment.current_value || newInvestment.amount),
            purchase_date: newInvestment.purchase_date || new Date().toISOString().split("T")[0],
            notes: newInvestment.notes,
            estimated_return_rate: parseFloat(newInvestment.estimated_return_rate || "0"),
            wishlist_item_id: newInvestment.wishlist_item_id ? parseInt(newInvestment.wishlist_item_id) : null,
            quantity: newInvestment.quantity ? parseFloat(newInvestment.quantity) : null,
          }),
        })

        if (response.ok) {
          await fetchInvestments()
          setIsAddDialogOpen(false)
          setNewInvestment({ name: "", type: "Stocks", symbol: "", amount: "", current_value: "", purchase_date: "", notes: "", estimated_return_rate: "", wishlist_item_id: "", quantity: "" })
          setSymbolSearch("")
        }
      } catch (error) {
        console.error("Error adding investment:", error)
      }
    }
  }

  const handleUpdateInvestment = async () => {
    if (!editingInvestment) return

    try {
      const response = await fetch("/api/investments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingInvestment.id,
          name: editingInvestment.name,
          type: editingInvestment.type,
          amount: editingInvestment.amount,
          current_value: editingInvestment.current_value,
          purchase_date: editingInvestment.purchase_date,
          notes: editingInvestment.notes,
          estimated_return_rate: editingInvestment.estimated_return_rate,
          wishlist_item_id: editingInvestment.wishlist_item_id || null,
        }),
      })

      if (response.ok) {
        await fetchInvestments()
        setEditingInvestment(null)
        setIsEditDialogOpen(false)
      }
    } catch (error) {
      console.error("Error updating investment:", error)
    }
  }

  const handleDeleteInvestment = async (id: number) => {
    if (!confirm("Are you sure you want to delete this investment?")) return

    try {
      const response = await fetch("/api/investments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (response.ok) {
        await fetchInvestments()
      }
    } catch (error) {
      console.error("Error deleting investment:", error)
    }
  }

  // Calculations
  const calculateTotalInvested = () => investments.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
  const calculateTotalValue = () => investments.reduce((sum, inv) => sum + (Number(inv.current_value) || Number(inv.amount) || 0), 0)
  const calculateTotalReturn = () => {
    const invested = calculateTotalInvested()
    const current = calculateTotalValue()
    return invested > 0 ? ((current - invested) / invested) * 100 : 0
  }
  const calculateAbsoluteReturn = () => calculateTotalValue() - calculateTotalInvested()

  const getInvestmentReturn = (inv: Investment) => {
    const current = inv.current_value || inv.amount
    return inv.amount > 0 ? ((current - inv.amount) / inv.amount) * 100 : 0
  }

  const getWishlistItemById = (id?: number) => wishlistItems.find(item => item.id === id)

  const calculateGoalProgress = (inv: Investment) => {
    const item = getWishlistItemById(inv.wishlist_item_id)
    if (!item || !item.price) return null
    const current = inv.current_value || inv.amount
    return Math.min((current / item.price) * 100, 100)
  }

  const getTypeColor = (type: string) => {
    const found = investmentTypes.find(t => t.value === type)
    return found?.color || "from-slate-500 to-gray-500"
  }

  // Portfolio breakdown
  const portfolioBreakdown = investmentTypes.map(type => {
    const typeInvestments = investments.filter(inv => inv.type === type.value)
    const total = typeInvestments.reduce((sum, inv) => sum + (inv.current_value || inv.amount), 0)
    return { ...type, total, count: typeInvestments.length }
  }).filter(t => t.count > 0)

  // Filtering and sorting
  const filteredInvestments = investments
    .filter(inv => filterType === "all" || inv.type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case "return":
          return getInvestmentReturn(b) - getInvestmentReturn(a)
        case "value":
          return (b.current_value || b.amount) - (a.current_value || a.amount)
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

  if (authLoading || loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const totalReturn = calculateTotalReturn()
  const absoluteReturn = calculateAbsoluteReturn()
  const isPositive = totalReturn >= 0
  const firstName = user.name?.split(" ")[0] || "Your"
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
              {firstName}'s Portfolio
            </h1>
            <p className="text-muted-foreground mt-1">Track your wealth and savings goals</p>
            <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
              <span className="text-amber-500">*</span>
              Prices update periodically, not in real-time
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleRefreshQuotes}
                disabled={fetchingQuotes || !canRefresh}
                title={canRefresh ? `Refresh live prices (${refreshesRemaining} left today)` : "Daily limit reached"}
                className="bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 ${fetchingQuotes ? "animate-spin" : ""}`} />
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {refreshesRemaining}/2 refreshes
              </span>
            </div>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent">
                  <Camera className="h-4 w-4" />
                  Import Portfolio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-500" />
                    Import from Screenshot
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Upload screenshots of your portfolio from any broker app (Zerodha, Groww, Robinhood, etc.) 
                    and we'll automatically extract your investments.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleScreenshotUpload(e.target.files)}
                  />
                  <Button
                    variant="outline"
                    className="w-full h-32 border-dashed border-2 bg-transparent"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingScreenshot}
                  >
                    {uploadingScreenshot ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span>Analyzing screenshots...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span>Click to upload screenshots</span>
                        <span className="text-xs text-muted-foreground">Supports JPG, PNG</span>
                      </div>
                    )}
                  </Button>

                  {parsedInvestments.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Sparkle className="h-4 w-4 text-amber-500" />
                        Found {parsedInvestments.length} investments
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {parsedInvestments.map((inv, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div>
                              <p className="font-medium text-sm">{inv.name}</p>
                              <p className="text-xs text-muted-foreground">{inv.symbol} • {inv.quantity} units</p>
                            </div>
                            <Badge variant="secondary">${inv.amount.toLocaleString()}</Badge>
                          </div>
                        ))}
                      </div>
                      <Button onClick={addParsedInvestments} className="w-full">
                        Add All to Portfolio
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                  <Plus className="h-4 w-4" />
                  Add Investment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    Add New Investment
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Popular Investments Quick Select */}
                  <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Label className="text-xs uppercase tracking-wider text-primary flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4" />
                      Quick Select Popular Investment
                    </Label>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {["all", "us_stocks", "indian_stocks", "etf", "crypto"].map((cat) => (
                        <Button
                          key={cat}
                          variant={popularCategory === cat ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPopularCategory(cat)}
                          className={popularCategory !== cat ? "bg-transparent" : ""}
                        >
                          {cat === "all" ? "All" : cat === "us_stocks" ? "US" : cat === "indian_stocks" ? "India" : cat.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                      {popularInvestments
                        .filter(p => popularCategory === "all" || p.category === popularCategory)
                        .slice(0, 12)
                        .map((popular) => (
                          <Button
                            key={popular.id}
                            variant="ghost"
                            size="sm"
                            className="justify-start text-xs h-8 px-2"
                            onClick={() => selectPopularInvestment(popular)}
                          >
                            <span className="truncate">{popular.symbol}</span>
                          </Button>
                        ))}
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or add custom</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Investment Name</Label>
                    <Input
                      placeholder="e.g., S&P 500 Index Fund, BTC..."
                      value={newInvestment.name}
                      onChange={(e) => setNewInvestment({ ...newInvestment, name: e.target.value })}
                      className="mt-1 text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
                    <Select value={newInvestment.type} onValueChange={(value) => setNewInvestment({ ...newInvestment, type: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stock/Crypto Symbol for live tracking */}
                  {(newInvestment.type === "Stocks" || newInvestment.type === "Crypto" || newInvestment.type === "ETF") && (
                    <div className="p-4 rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5">
                      <Label className="text-xs uppercase tracking-wider text-blue-500 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Live Price Tracking (Optional)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        {newInvestment.type === "Crypto" 
                          ? "Enter crypto symbol (BTC, ETH, etc.)" 
                          : "Search for stock symbol (e.g., AAPL, RELIANCE.NSE, TCS.BSE)"}
                      </p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={newInvestment.type === "Crypto" ? "BTC, ETH, SOL..." : "Search AAPL, RELIANCE.NSE..."}
                          value={symbolSearch}
                          onChange={(e) => {
                            setSymbolSearch(e.target.value)
                            searchSymbols(e.target.value)
                          }}
                          className="pl-9 text-foreground bg-background"
                        />
                      </div>
                      {searching && <p className="text-xs text-muted-foreground mt-2">Searching...</p>}
                      {searchResults.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto rounded border bg-background">
                          {searchResults.slice(0, 5).map((result) => (
                            <button
                              key={result.symbol}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex justify-between items-center"
                              onClick={() => {
                                setNewInvestment({ ...newInvestment, symbol: result.symbol, name: newInvestment.name || result.name })
                                setSymbolSearch(result.symbol)
                                setSearchResults([])
                              }}
                            >
                              <span className="font-medium">{result.symbol}</span>
                              <span className="text-xs text-muted-foreground truncate ml-2">{result.name} ({result.region})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {newInvestment.symbol && (
                        <Badge variant="secondary" className="mt-2">
                          Tracking: {newInvestment.symbol}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Wishlist Goal Linking */}
                  <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Label className="text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Link to Wishlist Goal (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Track savings progress towards a wishlist item
                    </p>
                    <Select value={newInvestment.wishlist_item_id} onValueChange={(value) => setNewInvestment({ ...newInvestment, wishlist_item_id: value })}>
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue placeholder="Select wishlist item..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No goal linked</SelectItem>
                        {wishlistItems.filter(item => item.price).map(item => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.title} - ${item.price?.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount Invested</Label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="10000"
                          value={newInvestment.amount}
                          onChange={(e) => setNewInvestment({ ...newInvestment, amount: e.target.value })}
                          className="pl-9 text-foreground"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current Value</Label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="12000"
                          value={newInvestment.current_value}
                          onChange={(e) => setNewInvestment({ ...newInvestment, current_value: e.target.value })}
                          className="pl-9 text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Purchase Date</Label>
                      <div className="relative mt-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={newInvestment.purchase_date}
                          onChange={(e) => setNewInvestment({ ...newInvestment, purchase_date: e.target.value })}
                          className="pl-9 text-foreground"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Est. Return Rate (%)</Label>
                      <div className="relative mt-1">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="8.5"
                          value={newInvestment.estimated_return_rate}
                          onChange={(e) => setNewInvestment({ ...newInvestment, estimated_return_rate: e.target.value })}
                          className="pl-9 text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                    <Textarea
                      placeholder="Investment details, strategy, etc..."
                      value={newInvestment.notes}
                      onChange={(e) => setNewInvestment({ ...newInvestment, notes: e.target.value })}
                      className="mt-1 text-foreground"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={handleAddInvestment}
                    disabled={!newInvestment.name || !newInvestment.type || !newInvestment.amount}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Investment
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-slate-500/10 to-gray-500/10 border-slate-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Invested</p>
                  <p className="text-3xl font-bold text-foreground mt-1">${calculateTotalInvested().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-slate-500/20 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-slate-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Value</p>
                  <p className="text-3xl font-bold text-foreground mt-1">${calculateTotalValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <PieChart className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${isPositive ? "from-green-500/10 to-emerald-500/10 border-green-500/20" : "from-red-500/10 to-rose-500/10 border-red-500/20"}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Return</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-3xl font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                      {isPositive ? "+" : ""}{totalReturn.toFixed(2)}%
                    </p>
                    {isPositive ? (
                      <ArrowUpRight className="h-6 w-6 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <p className={`text-sm ${isPositive ? "text-green-500/70" : "text-red-500/70"}`}>
                    {isPositive ? "+" : ""}${(absoluteReturn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Holdings</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{investments.length}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Breakdown */}
        {portfolioBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Portfolio Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {portfolioBreakdown.map(type => {
                  const percentage = (type.total / calculateTotalValue()) * 100
                  return (
                    <div key={type.value} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{type.label}</span>
                        <span className="text-muted-foreground">
                          ${type.total.toLocaleString()} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${type.color} transition-all`}
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

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {investmentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[140px]">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Newest</SelectItem>
                    <SelectItem value="return">Return %</SelectItem>
                    <SelectItem value="value">Value</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className="rounded-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className="rounded-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Investments List */}
        {filteredInvestments.length === 0 ? (
          <Card className="py-16">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4">
                <TrendingUp className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No investments yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Start tracking your investment portfolio and savings goals
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Investment
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInvestments.map((inv, index) => {
              const returnPct = getInvestmentReturn(inv)
              const isPositiveReturn = returnPct >= 0
              const goalProgress = calculateGoalProgress(inv)
              const wishlistItem = getWishlistItemById(inv.wishlist_item_id)
              const liveQuote = inv.symbol ? stockQuotes[inv.symbol] : null

              return (
                <Card
                  key={inv.id}
                  ref={(el) => { cardsRef.current[index] = el }}
                  className="group overflow-hidden transition-all hover:shadow-lg"
                >
                  <div className={`h-1 bg-gradient-to-r ${getTypeColor(inv.type)}`} />
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate text-foreground">{inv.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{inv.type}</Badge>
                            {inv.symbol && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-600">
                                <Globe className="h-3 w-3 mr-1" />
                                {inv.symbol}
                              </Badge>
                            )}
                            {wishlistItem && (
                              <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30">
                                <Target className="h-3 w-3 mr-1" />
                                Goal
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setEditingInvestment(inv); setIsEditDialogOpen(true) }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteInvestment(inv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Live Price Display */}
                      {liveQuote ? (
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-blue-500 uppercase tracking-wider">Live Price</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                {liveQuote.currency === "USD" ? "$" : liveQuote.currency === "INR" ? "₹" : ""}{liveQuote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={`text-xs flex items-center ${liveQuote.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {liveQuote.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {liveQuote.changePercent.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : inv.cached_price ? (
                        <div className="p-3 rounded-lg bg-muted/50 border border-muted">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">
                              Last Price {inv.last_price_fetch ? `(${new Date(inv.last_price_fetch).toLocaleDateString()})` : ""}
                            </span>
                            <span className="font-bold text-foreground">${inv.cached_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Invested</p>
                          <p className="text-lg font-semibold text-foreground">${inv.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Current Value</p>
                          <p className="text-lg font-semibold text-foreground">${(inv.current_value || inv.amount).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between p-3 rounded-lg ${isPositiveReturn ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        <span className="text-sm text-muted-foreground">Return</span>
                        <div className="flex items-center gap-1">
                          {isPositiveReturn ? (
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-500" />
                          )}
                          <span className={`font-bold ${isPositiveReturn ? "text-green-500" : "text-red-500"}`}>
                            {isPositiveReturn ? "+" : ""}{returnPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {goalProgress !== null && wishlistItem && (
                        <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {wishlistItem.title}
                            </span>
                            <span className="font-medium text-primary">{goalProgress.toFixed(0)}%</span>
                          </div>
                          <Progress value={goalProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground text-right">
                            ${(inv.current_value || inv.amount).toLocaleString()} / ${wishlistItem.price?.toLocaleString()}
                            {goalProgress >= 100 && (
                              <span className="ml-2 text-green-500 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Goal reached!
                              </span>
                            )}
                          </p>
                        </div>
                      )}

                      {inv.notes && (
                        <p className="text-xs text-muted-foreground border-t pt-3">{inv.notes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredInvestments.map((inv, index) => {
              const returnPct = getInvestmentReturn(inv)
              const isPositiveReturn = returnPct >= 0
              const goalProgress = calculateGoalProgress(inv)
              const wishlistItem = getWishlistItemById(inv.wishlist_item_id)

              return (
                <Card
                  key={inv.id}
                  ref={(el) => { cardsRef.current[index] = el }}
                  className="transition-all hover:shadow-md"
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-1 h-12 rounded-full bg-gradient-to-b ${getTypeColor(inv.type)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate text-foreground">{inv.name}</h3>
                          <Badge variant="secondary" className="text-xs">{inv.type}</Badge>
                          {wishlistItem && (
                            <Badge variant="outline" className="text-xs bg-primary/10">
                              <Target className="h-3 w-3 mr-1" />
                              {goalProgress?.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        {inv.notes && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{inv.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">${(inv.current_value || inv.amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">of ${inv.amount.toLocaleString()}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-lg ${isPositiveReturn ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        <span className={`font-bold ${isPositiveReturn ? "text-green-500" : "text-red-500"}`}>
                          {isPositiveReturn ? "+" : ""}{returnPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingInvestment(inv); setIsEditDialogOpen(true) }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteInvestment(inv.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-primary" />
                Edit Investment
              </DialogTitle>
            </DialogHeader>
            {editingInvestment && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
                  <Input
                    value={editingInvestment.name}
                    onChange={(e) => setEditingInvestment({ ...editingInvestment, name: e.target.value })}
                    className="mt-1 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select value={editingInvestment.type} onValueChange={(value) => setEditingInvestment({ ...editingInvestment, type: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {investmentTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                  <Label className="text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Link to Wishlist Goal
                  </Label>
                  <Select
                    value={editingInvestment.wishlist_item_id?.toString() || "none"}
                    onValueChange={(value) => setEditingInvestment({ ...editingInvestment, wishlist_item_id: value === "none" ? undefined : parseInt(value) })}
                  >
                    <SelectTrigger className="mt-2 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No goal linked</SelectItem>
                      {wishlistItems.filter(item => item.price).map(item => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.title} - ${item.price?.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount Invested</Label>
                    <Input
                      type="number"
                      value={editingInvestment.amount}
                      onChange={(e) => setEditingInvestment({ ...editingInvestment, amount: parseFloat(e.target.value) || 0 })}
                      className="mt-1 text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current Value</Label>
                    <Input
                      type="number"
                      value={editingInvestment.current_value}
                      onChange={(e) => setEditingInvestment({ ...editingInvestment, current_value: parseFloat(e.target.value) || 0 })}
                      className="mt-1 text-foreground"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Purchase Date</Label>
                    <Input
                      type="date"
                      value={editingInvestment.purchase_date?.split("T")[0] || ""}
                      onChange={(e) => setEditingInvestment({ ...editingInvestment, purchase_date: e.target.value })}
                      className="mt-1 text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Est. Return Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editingInvestment.estimated_return_rate || ""}
                      onChange={(e) => setEditingInvestment({ ...editingInvestment, estimated_return_rate: parseFloat(e.target.value) || 0 })}
                      className="mt-1 text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                  <Textarea
                    value={editingInvestment.notes || ""}
                    onChange={(e) => setEditingInvestment({ ...editingInvestment, notes: e.target.value })}
                    className="mt-1 text-foreground"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleUpdateInvestment} className="flex-1">
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
      </div>
    </DashboardLayout>
  )
}
