"use client"

import React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { gsap } from "gsap"
import {
  Plus,
  Trash2,
  ExternalLink,
  Heart,
  TrendingUp,
  Check,
  Edit2,
  X,
  Star,
  ShoppingCart,
  Sparkles,
  DollarSign,
  Calendar,
  Tag,
  Link2,
  ImageIcon,
  Filter,
  Grid3X3,
  List,
  ArrowUpDown,
  Upload,
  RefreshCw,
  Clipboard,
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

interface WishlistItem {
  id: number
  title: string
  description: string
  category: string
  price?: number
  image_url?: string
  url?: string
  priority: "low" | "medium" | "high"
  purchased?: boolean
  created_at?: string
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")
  const [sortBy, setSortBy] = useState<"date" | "price" | "priority" | "name">("date")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const { user, loading } = useAuth()
  const router = useRouter()
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    category: "general",
    price: "",
    image_url: "",
    url: "",
    priority: "medium" as "low" | "medium" | "high",
  })
  
  const [fetchingPreview, setFetchingPreview] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setUploadingImage(true)
    try {
      // Convert to base64 data URL for preview
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setNewItem(prev => ({ ...prev, image_url: base64 }))
        setUploadingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to upload image:', error)
      setUploadingImage(false)
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64 = reader.result as string
              setNewItem(prev => ({ ...prev, image_url: base64 }))
            }
            reader.readAsDataURL(blob)
            return
          }
        }
      }
      // If no image found, try to read text (could be a URL)
      const text = await navigator.clipboard.readText()
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        if (text.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          setNewItem(prev => ({ ...prev, image_url: text }))
        } else {
          alert('Copied text is a URL but not an image. Try pasting the URL in the image field.')
        }
      } else {
        alert('No image found in clipboard. Copy an image first.')
      }
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      alert('Could not access clipboard. Make sure you have granted permission.')
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchItems()
    }
  }, [user])

  useEffect(() => {
    cardsRef.current.forEach((card, index) => {
      if (card) {
        gsap.fromTo(
          card,
          { opacity: 0, y: 20, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, delay: index * 0.05, ease: "power2.out" }
        )
      }
    })
  }, [items, viewMode])

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/wishlist")
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error("Failed to fetch wishlist items:", error)
    }
  }

  useEffect(() => {
    if (!user) return

    const handleQuickAdd = (event: Event) => {
      if ((event as CustomEvent).detail?.type === "wishlist") {
        fetchItems()
      }
    }

    window.addEventListener("lifesort:quick-add-created", handleQuickAdd)
    return () => window.removeEventListener("lifesort:quick-add-created", handleQuickAdd)
  }, [user])

  const handleAddItem = async () => {
    if (newItem.title) {
      try {
        const response = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newItem.title,
            description: newItem.description,
            category: newItem.category,
            price: newItem.price ? Number.parseFloat(newItem.price) : null,
            image_url: newItem.image_url || null,
            link: newItem.url || null,
            priority: newItem.priority,
          }),
        })
        if (response.ok) {
          fetchItems()
          setNewItem({ title: "", description: "", category: "general", price: "", image_url: "", url: "", priority: "medium" })
          setIsAddDialogOpen(false)
        }
      } catch (error) {
        console.error("Failed to add item:", error)
      }
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem) return
    try {
      const response = await fetch("/api/wishlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          title: editingItem.title,
          description: editingItem.description,
          category: editingItem.category,
          price: editingItem.price,
          image_url: editingItem.image_url,
          link: editingItem.url,
          priority: editingItem.priority,
          purchased: editingItem.purchased,
        }),
      })
      if (response.ok) {
        fetchItems()
        setEditingItem(null)
        setIsEditDialogOpen(false)
      }
    } catch (error) {
      console.error("Failed to update item:", error)
    }
  }

  const handleQuickUpdate = async (id: number, field: string, value: any) => {
    try {
      const response = await fetch("/api/wishlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      })
      if (response.ok) {
        fetchItems()
      }
    } catch (error) {
      console.error("Failed to update item:", error)
    }
  }

  const fetchUrlPreview = async (url: string) => {
    if (!url) return
    setFetchingPreview(true)
    try {
      const response = await fetch("/api/url-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.thumbnail) {
          setNewItem(prev => ({ ...prev, image_url: data.thumbnail }))
        }
      }
    } catch (error) {
      console.error("Failed to fetch preview:", error)
    } finally {
      setFetchingPreview(false)
    }
  }

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return
    try {
      const response = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (response.ok) {
        fetchItems()
      }
    } catch (error) {
      console.error("Failed to delete item:", error)
    }
  }

  const handleConvertToInvestment = async (item: WishlistItem) => {
    try {
      const response = await fetch("/api/wishlist/convert-to-investment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlist_item_id: item.id }),
      })
      if (response.ok) {
        router.push("/investments")
      } else {
        const error = await response.json()
        alert(error.error || "Failed to convert to investment")
      }
    } catch (error) {
      console.error("Failed to convert to investment:", error)
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      high: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    }
    return colors[priority as keyof typeof colors] || colors.medium
  }

  const getPriorityWeight = (priority: string) => {
    return priority === "high" ? 3 : priority === "medium" ? 2 : 1
  }

  const categories = ["general", "tech", "travel", "home", "fashion", "education", "health", "entertainment", "other"]

  const filteredAndSortedItems = items
    .filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filterCategory === "all" || item.category === filterCategory
      const matchesPriority = filterPriority === "all" || item.priority === filterPriority
      return matchesSearch && matchesCategory && matchesPriority
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price":
          return (b.price || 0) - (a.price || 0)
        case "priority":
          return getPriorityWeight(b.priority) - getPriorityWeight(a.priority)
        case "name":
          return a.title.localeCompare(b.title)
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

  const stats = {
    totalItems: items.length,
    totalValue: items.reduce((acc, item) => acc + (item.price || 0), 0),
    highPriority: items.filter((item) => item.priority === "high").length,
    purchased: items.filter((item) => item.purchased).length,
    unpurchased: items.filter((item) => !item.purchased).length,
  }

  const savingsProgress = stats.totalValue > 0 ? (stats.purchased / stats.totalItems) * 100 : 0

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading your dreams...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Dream Wishlist
            </h1>
            <p className="text-muted-foreground mt-1">Track what you want and save towards your goals</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600">
                <Plus className="h-4 w-4" />
                Add Dream
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-pink-500" />
                  Add New Dream
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">What do you want?</Label>
                  <Input
                    placeholder="e.g., MacBook Pro, Dream vacation..."
                    value={newItem.title}
                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                    className="mt-1 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                  <Textarea
                    placeholder="Why do you want this? Add details..."
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    className="mt-1 text-foreground"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select value={newItem.category} onValueChange={(value) => setNewItem({ ...newItem, category: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Priority</Label>
                    <Select value={newItem.priority} onValueChange={(value: any) => setNewItem({ ...newItem, priority: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Price</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      className="pl-9 text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Product Link</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="https://..."
                        value={newItem.url}
                        onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                        className="pl-9 text-foreground"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => fetchUrlPreview(newItem.url)}
                      disabled={fetchingPreview || !newItem.url}
                      title="Fetch image from link"
                    >
                      {fetchingPreview ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Click the refresh button to auto-fetch product image</p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Product Image</Label>
                  <div className="mt-1 space-y-3">
                    {/* Upload buttons */}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex-1"
                      >
                        {uploadingImage ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Image
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePasteFromClipboard}
                        className="flex-1 bg-transparent"
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        Paste from Clipboard
                      </Button>
                    </div>
                    
                    {/* URL input */}
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Or paste image URL here..."
                        value={newItem.image_url?.startsWith('data:') ? '' : newItem.image_url}
                        onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                        className="pl-9 text-foreground"
                      />
                    </div>
                    
                    {/* Image preview */}
                    {newItem.image_url && (
                      <div className="relative rounded-lg overflow-hidden border border-border bg-muted aspect-video">
                        <img 
                          src={newItem.image_url || "/placeholder.svg"} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => setNewItem({ ...newItem, image_url: '' })}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Upload from your device, paste from clipboard, or enter an image URL directly.
                    </p>
                  </div>
                </div>
                <Button onClick={handleAddItem} className="w-full bg-gradient-to-r from-rose-500 to-pink-500">
                  <Heart className="mr-2 h-4 w-4" />
                  Add to Wishlist
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Dreams</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.totalItems}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-rose-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Value</p>
                  <p className="text-3xl font-bold text-foreground mt-1">${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">High Priority</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.highPriority}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Star className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Purchased</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.purchased}/{stats.totalItems}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <Progress value={savingsProgress} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <Input
                  placeholder="Search dreams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs text-foreground"
                />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[130px]">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Newest</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
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

        {/* Wishlist Items */}
        {filteredAndSortedItems.length === 0 ? (
          <Card className="py-16">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                <Heart className="h-10 w-10 text-rose-500" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No dreams yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Start building your wishlist by adding things you want to save for
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-rose-500 to-pink-500">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Dream
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedItems.map((item, index) => (
              <Card
                key={item.id}
                ref={(el) => { cardsRef.current[index] = el }}
                className={`group overflow-hidden transition-all hover:shadow-lg ${item.purchased ? "opacity-75" : ""}`}
              >
                {item.image_url && (
                  <div className="h-40 overflow-hidden bg-muted">
                    <img src={item.image_url || "/placeholder.svg"} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                )}
                <CardContent className={item.image_url ? "pt-4" : "pt-6"}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-lg truncate ${item.purchased ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{item.category}</Badge>
                          <Badge className={getPriorityColor(item.priority)} variant="outline">
                            {item.priority}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditingItem(item); setIsEditDialogOpen(true) }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    )}

{item.price && item.price > 0 && (
                        <p className="text-2xl font-bold text-primary">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant={item.purchased ? "default" : "outline"}
                        size="sm"
                        className={item.purchased ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        onClick={() => handleQuickUpdate(item.id, "purchased", !item.purchased)}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        {item.purchased ? "Purchased" : "Mark Purchased"}
                      </Button>
                      {item.purchased && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvertToInvestment(item)}
                          className="bg-gradient-to-r from-primary/10 to-purple-500/10"
                        >
                          <TrendingUp className="mr-1 h-3 w-3" />
                          Track as Investment
                        </Button>
                      )}
                    </div>

                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                        <Button variant="outline" size="sm" className="w-full bg-transparent">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          View Product
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedItems.map((item, index) => (
              <Card
                key={item.id}
                ref={(el) => { cardsRef.current[index] = el }}
                className={`transition-all hover:shadow-md ${item.purchased ? "opacity-75" : ""}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {item.image_url && (
                      <img src={item.image_url || "/placeholder.svg"} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold truncate ${item.purchased ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.title}
                        </h3>
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        <Badge className={getPriorityColor(item.priority)} variant="outline">
                          {item.priority}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground truncate mt-1">{item.description}</p>
                      )}
                    </div>
{item.price && item.price > 0 && (
                        <p className="text-xl font-bold text-primary">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant={item.purchased ? "default" : "outline"}
                        size="sm"
                        className={item.purchased ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        onClick={() => handleQuickUpdate(item.id, "purchased", !item.purchased)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsEditDialogOpen(true) }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-primary" />
                Edit Dream
              </DialogTitle>
            </DialogHeader>
            {editingItem && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
                  <Input
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                    className="mt-1 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                  <Textarea
                    value={editingItem.description || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="mt-1 text-foreground"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select value={editingItem.category} onValueChange={(value) => setEditingItem({ ...editingItem, category: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Priority</Label>
                    <Select value={editingItem.priority} onValueChange={(value: any) => setEditingItem({ ...editingItem, priority: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Price</Label>
                  <Input
                    type="number"
                    value={editingItem.price || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="mt-1 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Product Link</Label>
                  <Input
                    value={editingItem.url || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, url: e.target.value })}
                    className="mt-1 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Image URL</Label>
                  <Input
                    value={editingItem.image_url || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="mt-1 text-foreground"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleUpdateItem} className="flex-1">
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
