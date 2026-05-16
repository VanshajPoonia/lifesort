"use client"

import React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout, clearSidebarPrefsCache } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/components/auth-provider"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Cake,
  Camera,
  Save,
  Quote,
  Laugh,
  Gamepad2,
  Crown,
  Calendar,
  Sparkles,
  Shield,
  LayoutDashboard,
  CalendarDays,
  Link,
  FolderPlus,
  FileText,
  CheckSquare,
  Target,
  Bookmark,
  Heart,
  HelpCircle,
  ChevronDown,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface UserProfile {
  id: string
  name: string
  email: string
  avatar: string | null
  bio: string | null
  phone: string | null
  location: string | null
  date_of_birth: string | null
  subscription_tier: string
  subscription_end_date: string | null
  created_at: string
  content_preferences: {
    quote_types: string[]
    joke_types: string[]
    show_quotes: boolean
    show_jokes: boolean
    show_games: boolean
  } | null
}

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    phone: "",
    location: "",
    date_of_birth: "",
    avatar: "",
  })
  
  const [preferences, setPreferences] = useState({
    quote_types: ["motivational"],
    joke_types: ["funny"],
    show_quotes: true,
    show_jokes: true,
    show_games: true,
  })

  const [sidebarPrefs, setSidebarPrefs] = useState({
    dashboard: true,
    calendar: true,
    goals: true,
    tasks: true,
    nuke: true,
    pomodoro: true,
    notes: true,
    wishlist: true,
    investments: true,
    income: true,
    budget: true,
    links: true,
    custom_sections: true,
    daily_content: true,
    ai_assistant: true,
  })

  useEffect(() => {
    fetchProfile()
    fetchSidebarPrefs()
  }, [])

  const fetchSidebarPrefs = async () => {
    try {
      const response = await fetch("/api/sidebar-preferences")
      const data = await response.json()
      if (data.preferences) {
        setSidebarPrefs(prev => ({ ...prev, ...data.preferences }))
      }
    } catch (error) {
      console.error("[v0] Error fetching sidebar preferences:", error)
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile")
      console.log("[v0] Profile response status:", response.status)
      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Profile data received:", data)
        setProfile(data)
        setFormData({
          name: data.name || "",
          bio: data.bio || "",
          phone: data.phone || "",
          location: data.location || "",
          date_of_birth: data.date_of_birth ? data.date_of_birth.split("T")[0] : "",
          avatar: data.avatar || "",
        })
        if (data.content_preferences) {
          setPreferences(data.content_preferences)
        }
      } else {
        console.error("[v0] Profile fetch failed:", response.status)
      }
    } catch (error) {
      console.error("[v0] Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    setUploadingAvatar(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setFormData(prev => ({ ...prev, avatar: base64 }))
      setUploadingAvatar(false)
    }
    reader.readAsDataURL(file)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchProfile()
        alert("Profile saved successfully!")
      }
    } catch (error) {
      console.error("[v0] Error saving profile:", error)
      alert("Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/daily-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      })

      if (response.ok) {
        alert("Preferences saved successfully!")
      }
    } catch (error) {
      console.error("[v0] Error saving preferences:", error)
      alert("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  const saveSidebarPrefs = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/sidebar-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sidebarPrefs),
      })

      if (response.ok) {
        // Clear both caches so the sidebar picks up new prefs on next render.
        sessionStorage.removeItem("sidebar_prefs")
        clearSidebarPrefsCache()
        alert("Sidebar preferences saved!")
        window.location.reload()
      }
    } catch (error) {
      console.error("Error saving sidebar preferences:", error)
      alert("Failed to save sidebar preferences")
    } finally {
      setSaving(false)
    }
  }

  const toggleQuoteType = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      quote_types: prev.quote_types.includes(type)
        ? prev.quote_types.filter(t => t !== type)
        : [...prev.quote_types, type]
    }))
  }

  const toggleJokeType = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      joke_types: prev.joke_types.includes(type)
        ? prev.joke_types.filter(t => t !== type)
        : [...prev.joke_types, type]
    }))
  }

  const getTierBadge = () => {
    switch (profile?.subscription_tier) {
      case "enterprise":
        return <Badge className="bg-purple-500"><Crown className="h-3 w-3 mr-1" />Enterprise</Badge>
      case "pro":
        return <Badge className="bg-blue-500"><Crown className="h-3 w-3 mr-1" />Pro</Badge>
      default:
        return <Badge variant="outline">Free</Badge>
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Settings" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your profile and preferences"
    >
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[620px]">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="sidebar">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Sidebar
          </TabsTrigger>
          <TabsTrigger value="content">
            <Sparkles className="h-4 w-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="faqs">
            <HelpCircle className="h-4 w-4 mr-2" />
            FAQs
          </TabsTrigger>
          <TabsTrigger value="account">
            <Shield className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and profile picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={formData.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {formData.name?.charAt(0) || profile?.email?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-transparent"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div>
                  <h3 className="font-semibold">{formData.name || "Your Name"}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  <div className="mt-2">{getTierBadge()}</div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <User className="h-4 w-4 inline mr-2" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                    className="text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="h-4 w-4 inline mr-2" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className="text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, Country"
                    className="text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">
                    <Cake className="h-4 w-4 inline mr-2" />
                    Date of Birth
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    className="text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  className="text-foreground"
                />
              </div>

              <Button onClick={saveProfile} disabled={saving}>
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sidebar Customization Tab */}
        <TabsContent value="sidebar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sidebar Sections</CardTitle>
              <CardDescription>
                Choose which sections to display in your sidebar navigation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Main dashboard view" },
                  { id: "calendar", label: "Calendar", icon: CalendarDays, description: "Calendar and events" },
                  { id: "goals", label: "Goals", icon: Target, description: "Goal tracking" },
                  { id: "tasks", label: "Daily Tasks", icon: CheckSquare, description: "To-do lists" },
                  { id: "nuke", label: "Nuke Goal", icon: Target, description: "Intense goal focus" },
                  { id: "pomodoro", label: "Pomodoro", icon: CalendarDays, description: "Focus timer" },
                  { id: "notes", label: "Notes", icon: FileText, description: "Personal notes" },
                  { id: "wishlist", label: "Wishlist", icon: Heart, description: "Wishlist items" },
                  { id: "investments", label: "Investments", icon: Target, description: "Investment tracking" },
                  { id: "income", label: "Income", icon: Target, description: "Income tracking" },
                  { id: "budget", label: "Budget", icon: Target, description: "Expense tracking" },
                  { id: "links", label: "My Links", icon: Link, description: "Saved links and images" },
                  { id: "custom_sections", label: "Custom Sections", icon: FolderPlus, description: "Your custom sections" },
                  { id: "daily_content", label: "Daily Quotes & Games", icon: Sparkles, description: "Daily quotes, jokes, games" },
                  { id: "ai_assistant", label: "AI Assistant", icon: Sparkles, description: "AI chat assistant" },
                ].map(({ id, label, icon: Icon, description }) => (
                  <div
                    key={id}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      sidebarPrefs[id as keyof typeof sidebarPrefs] 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSidebarPrefs(prev => ({ ...prev, [id]: !prev[id as keyof typeof prev] }))}
                  >
                    <Checkbox
                      id={id}
                      checked={sidebarPrefs[id as keyof typeof sidebarPrefs]}
                      onCheckedChange={(checked) => 
                        setSidebarPrefs(prev => ({ ...prev, [id]: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <label htmlFor={id} className="flex items-center gap-2 cursor-pointer font-medium">
                        <Icon className="h-4 w-4 text-primary" />
                        {label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={saveSidebarPrefs} disabled={saving}>
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Sidebar Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Preferences Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Content Preferences</CardTitle>
              <CardDescription>
                Customize what type of content you see each day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Content Types */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Content Types</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="show_quotes"
                      checked={preferences.show_quotes}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, show_quotes: !!checked }))
                      }
                    />
                    <label htmlFor="show_quotes" className="flex items-center gap-2 cursor-pointer">
                      <Quote className="h-4 w-4 text-primary" />
                      Show Daily Quotes
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="show_jokes"
                      checked={preferences.show_jokes}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, show_jokes: !!checked }))
                      }
                    />
                    <label htmlFor="show_jokes" className="flex items-center gap-2 cursor-pointer">
                      <Laugh className="h-4 w-4 text-amber-500" />
                      Show Daily Jokes
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="show_games"
                      checked={preferences.show_games}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, show_games: !!checked }))
                      }
                    />
                    <label htmlFor="show_games" className="flex items-center gap-2 cursor-pointer">
                      <Gamepad2 className="h-4 w-4 text-green-500" />
                      Show Daily Games & Riddles
                    </label>
                  </div>
                </div>
              </div>

              {/* Quote Categories */}
              {preferences.show_quotes && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Quote Categories</Label>
                  <p className="text-sm text-muted-foreground">Select the types of quotes you want to see</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "motivational", label: "Motivational" },
                      { id: "religious", label: "Religious/Spiritual" },
                      { id: "philosophical", label: "Philosophical" },
                      { id: "stoic", label: "Stoic Wisdom" },
                      { id: "funny", label: "Funny Quotes" },
                      { id: "love", label: "Love & Relationships" },
                      { id: "success", label: "Success" },
                    ].map(({ id, label }) => (
                      <Button
                        key={id}
                        variant={preferences.quote_types.includes(id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleQuoteType(id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Joke Categories */}
              {preferences.show_jokes && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Joke Categories</Label>
                  <p className="text-sm text-muted-foreground">Select the types of jokes you want to see</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "funny", label: "Clean & Funny" },
                      { id: "dank", label: "Dank/Meme Humor" },
                      { id: "dad", label: "Dad Jokes" },
                      { id: "dark", label: "Dark Humor" },
                      { id: "tech", label: "Tech/Programmer" },
                      { id: "pun", label: "Puns" },
                      { id: "oneliners", label: "One-Liners" },
                    ].map(({ id, label }) => (
                      <Button
                        key={id}
                        variant={preferences.joke_types.includes(id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleJokeType(id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={savePreferences} disabled={saving}>
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        {/* FAQs Tab */}
        <TabsContent value="faqs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Learn how to get the most out of your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sidebar">
                  <AccordionTrigger>How do I customize my sidebar?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      Go to <strong>Settings &gt; Sidebar</strong> tab. You'll see a list of all available sections 
                      (Dashboard, Calendar, Goals, Tasks, Budget, etc.). Check the boxes next to the features you want 
                      to see in your sidebar, then click "Save Sidebar Settings". The changes will take effect after 
                      you refresh the page.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="daily-popup">
                  <AccordionTrigger>What is the daily popup and how do I turn it off?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      The daily popup shows you a fun activity every 2 hours - this can be an inspirational quote, 
                      a joke, or a mini-game like Wordle or Snake. To disable it, go to <strong>Settings &gt; Content Preferences</strong> 
                      and uncheck "Show Daily Quotes", "Show Daily Jokes", and "Show Daily Games". You can also 
                      customize the types of quotes (motivational, religious, philosophical) and jokes (funny, dank, dad jokes) 
                      you receive.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="quote-themes">
                  <AccordionTrigger>How do I change the quote and joke themes?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      Visit <strong>Settings &gt; Content Preferences</strong>. Under "Quote Categories" you can select 
                      from Motivational, Religious/Spiritual, Philosophical, Stoic Wisdom, Funny, Love, or Success quotes. 
                      Under "Joke Categories" choose from Clean & Funny, Dank/Meme Humor, Dad Jokes, Dark Humor, 
                      Tech/Programmer jokes, Puns, or One-Liners.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="games">
                  <AccordionTrigger>Where can I find my game history and play more games?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      Go to <strong>Daily Quotes & Games</strong> in the sidebar. The "History" tab shows all your past 
                      quotes, jokes, and game results. The "Play Games" tab lets you play Wordle and Snake anytime. 
                      Your scores are automatically saved to your history.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="budget">
                  <AccordionTrigger>How do I use the budget tracker?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      The Budget section lets you track income and expenses. First, create categories (like Food, Transport, 
                      Entertainment) with optional monthly limits. Then add transactions - mark them as income or expense, 
                      assign a category, and add a description. You can also set savings goals with target amounts and deadlines. 
                      The built-in calculator helps with quick calculations when adding transactions.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="profile">
                  <AccordionTrigger>How do I update my profile picture and information?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      Go to <strong>Settings &gt; Profile</strong>. Click on your avatar to upload a new profile picture. 
                      You can also update your name, bio, phone number, location, and date of birth. Don't forget to 
                      click "Save Changes" when you're done.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="subscription">
                  <AccordionTrigger>How do I upgrade to Pro?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      Click the "Go Pro" button in the sidebar. This supports the development of the app and gives you 
                      access to premium features. You can check your current subscription status in the 
                      <strong> Settings &gt; Account</strong> tab.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="logout">
                  <AccordionTrigger>How do I sign out?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      Click the logout icon (arrow pointing right) next to the settings cog in the bottom left of the 
                      sidebar, next to your profile. The cog icon opens Settings, and the arrow icon signs you out.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                View your account details and subscription status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/50">
                  <Label className="text-xs uppercase text-muted-foreground">Email Address</Label>
                  <p className="mt-1 font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {profile?.email || user?.email || "Not available"}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <Label className="text-xs uppercase text-muted-foreground">Member Since</Label>
                  <p className="mt-1 font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    }) : (user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    }) : "Not available")}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <Label className="text-xs uppercase text-muted-foreground">Subscription Tier</Label>
                  <div className="mt-1">{getTierBadge()}</div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <Label className="text-xs uppercase text-muted-foreground">Subscription Ends</Label>
                  <p className="mt-1 font-medium">
                    {profile?.subscription_end_date 
                      ? new Date(profile.subscription_end_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })
                      : profile?.subscription_tier === "pro" || profile?.subscription_tier === "enterprise"
                        ? "Lifetime"
                        : "N/A"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
