"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  Users,
  Clock,
  Calendar as CalendarIcon,
  Heart,
  Target,
  Zap,
  DollarSign,
  Link2,
  RefreshCw,
  X,
  Check,
  Settings,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReminderSettings } from "@/components/reminder-settings"

interface Event {
  id: string
  title: string
  date: Date
  time: string
  description: string
  category: "personal" | "work" | "health" | "finance"
  location?: string
  attendees?: string
  email_reminder?: boolean
  reminder_days?: number
}

interface SyncedEvent {
  id: string
  title: string
  start: string
  end: string
  description: string
  provider: "google"
  color: string
  location: string
  all_day: boolean
}

interface CalendarIntegration {
  provider: "google"
  email: string
  connected_at: string
  last_synced: string
}

export default function CalendarPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: "",
    time: "",
    description: "",
    category: "personal",
    location: "",
    attendees: "",
    email_reminder: true,
    reminder_days: 1,
  })

  // Calendar integrations
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([])
  const [syncedEvents, setSyncedEvents] = useState<SyncedEvent[]>([])
  const [showIntegrationsDialog, setShowIntegrationsDialog] = useState(false)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [googleConfigured, setGoogleConfigured] = useState(false)

  useEffect(() => {
    if (user) {
      fetchEvents()
      fetchIntegrations()
    }
  }, [user])

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/calendar/integrations")
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data.integrations || [])
        setGoogleConfigured(data.google_configured === true)
        
        // If there are integrations, sync events
        if (data.integrations?.length > 0) {
          syncCalendarEvents()
        }
      }
    } catch (error) {
      console.error("Error fetching integrations:", error)
    }
  }

  const syncCalendarEvents = async () => {
    setSyncingCalendar(true)
    try {
      const response = await fetch("/api/calendar/sync")
      if (response.ok) {
        const data = await response.json()
        setSyncedEvents(data.events || [])
      }
    } catch (error) {
      console.error("Error syncing calendar:", error)
    } finally {
      setSyncingCalendar(false)
    }
  }

  const connectGoogle = async () => {
    try {
      const response = await fetch("/api/calendar/google/auth")
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else if (data.setup_required) {
        alert(data.message)
      }
    } catch (error) {
      console.error("Error connecting Google:", error)
    }
  }

  const disconnectCalendar = async (provider: string) => {
    try {
      await fetch("/api/calendar/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      setIntegrations(integrations.filter(i => i.provider !== provider))
      setSyncedEvents(syncedEvents.filter(e => e.provider !== provider))
    } catch (error) {
      console.error("Error disconnecting:", error)
    }
  }

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/calendar-events')
      if (response.ok) {
        const data = await response.json()
        // Convert database format to component format
        const eventsArray = Array.isArray(data) ? data : []
        const formattedEvents = eventsArray.map((e: { id: number; title: string; event_date: string; start_time: string; description: string; category: string; location: string; attendees: string }) => ({
          id: e.id.toString(),
          title: e.title,
          date: new Date(e.event_date),
          time: e.start_time?.slice(0, 5) || '',
          description: e.description || '',
          category: e.category || 'personal',
          location: e.location,
          attendees: e.attendees,
        }))
        setEvents(formattedEvents)
      }
    } catch (error) {
      console.error('[v0] Error fetching events:', error)
    }
  }

  const formatTime12Hour = (time24: string) => {
    if (!time24) return ""
    const [hours, minutes] = time24.split(":")
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const categoryColors = {
    personal: "bg-primary/20 text-primary border-primary/30",
    work: "bg-accent/20 text-accent border-accent/30",
    health: "bg-success/20 text-success border-success/30",
    finance: "bg-warning/20 text-warning border-warning/30",
  }

  const categoryIcons = {
    personal: Heart,
    work: Target,
    health: Zap,
    finance: DollarSign,
  }

  const handleAddEvent = async () => {
    if (newEvent.title && newEvent.time && selectedDate) {
      const eventData = {
        title: newEvent.title,
        event_date: selectedDate.toISOString().split('T')[0],
        start_time: newEvent.time,
        end_time: newEvent.time,
        description: newEvent.description || "",
        category: newEvent.category || "personal",
        location: newEvent.location,
        attendees: newEvent.attendees,
      }

      try {
        if (editingEvent) {
          const response = await fetch('/api/calendar-events', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...eventData, id: parseInt(editingEvent.id) }),
          })
          if (response.ok) {
            await fetchEvents()
            setEditingEvent(null)
          }
        } else {
          const response = await fetch('/api/calendar-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
          })
          if (response.ok) {
            await fetchEvents()
          }
        }
      } catch (error) {
        console.error('[v0] Error saving event:', error)
      }

      setNewEvent({
        title: "",
        time: "",
        description: "",
        category: "personal",
        location: "",
        attendees: "",
        email_reminder: true,
        reminder_days: 1,
      })
      setIsDialogOpen(false)
    }
  }

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event)
    setNewEvent({
      title: event.title,
      time: event.time,
      description: event.description,
      category: event.category,
      location: event.location,
      attendees: event.attendees,
      email_reminder: event.email_reminder ?? true,
      reminder_days: event.reminder_days ?? 1,
    })
    setSelectedDate(event.date)
    setIsDialogOpen(true)
  }

  const handleDeleteEvent = async (id: string) => {
    try {
      const response = await fetch('/api/calendar-events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parseInt(id) }),
      })
      if (response.ok) {
        await fetchEvents()
      }
    } catch (error) {
      console.error('[v0] Error deleting event:', error)
    }
  }

  const selectedDateEvents = events.filter(
    (event) =>
      selectedDate && event.date.toDateString() === selectedDate.toDateString()
  ).sort((a, b) => {
    const timeA = new Date(`1970/01/01 ${a.time}`)
    const timeB = new Date(`1970/01/01 ${b.time}`)
    return timeA.getTime() - timeB.getTime()
  })

  // Filter synced events for selected date
  const selectedDateSyncedEvents = syncedEvents.filter((event) => {
    if (!selectedDate) return false
    const eventDate = new Date(event.start)
    return eventDate.toDateString() === selectedDate.toDateString()
  })

  const upcomingEvents = events
    .filter((event) => event.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5)

  const eventsWithDates = events.map((event) => event.date)

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const firstName = user.name?.split(" ")[0] || "there"

  return (
    <DashboardLayout title={`${firstName}'s Calendar`} subtitle={selectedDate?.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })}>
      <div className="space-y-6">
        {/* Header with buttons */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {integrations.length > 0 && (
              <div className="flex items-center gap-2">
                {integrations.map(i => (
                  <Badge key={i.provider} variant="secondary" className="flex items-center gap-1">
                    <svg className="h-3 w-3" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    {i.email?.split("@")[0]}
                  </Badge>
                ))}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={syncCalendarEvents}
                  disabled={syncingCalendar}
                >
                  <RefreshCw className={`h-4 w-4 ${syncingCalendar ? "animate-spin" : ""}`} />
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Dialog open={showIntegrationsDialog} onOpenChange={setShowIntegrationsDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-transparent">
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect Calendar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Calendar Integrations</DialogTitle>
                  <DialogDescription>
                    Connect your Google Calendar to sync events
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Google Calendar */}
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white shadow-sm">
                        <svg className="h-6 w-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">Google Calendar</p>
                        {integrations.find(i => i.provider === "google") ? (
                          <p className="text-sm text-green-600 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Connected as {integrations.find(i => i.provider === "google")?.email}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        )}
                      </div>
                    </div>
                    {integrations.find(i => i.provider === "google") ? (
                      <Button variant="outline" size="sm" onClick={() => disconnectCalendar("google")} className="bg-transparent">
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" onClick={connectGoogle} disabled={!googleConfigured}>
                        {googleConfigured ? "Connect" : "Not Configured"}
                      </Button>
                    )}
                  </div>

                  {!googleConfigured && (
                    <p className="text-sm text-muted-foreground text-center p-4 bg-muted/50 rounded-lg">
                      To enable Google Calendar integration, please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET 
                      to your environment variables.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingEvent(null); setNewEvent({ title: "", time: "", description: "", category: "personal", location: "", attendees: "", email_reminder: true, reminder_days: 1 }) }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? "Edit Event" : "Add New Event"}</DialogTitle>
                  <DialogDescription>
                    {editingEvent ? "Update your event details" : "Create a new event on your calendar"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Event Title</Label>
                    <Input
                      id="title"
                      placeholder="Team meeting, Workout, etc."
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={newEvent.time}
                        onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                        className="text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={newEvent.category}
                        onValueChange={(value) => setNewEvent({ ...newEvent, category: value as Event["category"] })}
                      >
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Personal</SelectItem>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="health">Health</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Event details..."
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location (optional)</Label>
                    <Input
                      id="location"
                      placeholder="Meeting room, address, etc."
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="attendees">Attendees (optional)</Label>
                    <Input
                      id="attendees"
                      placeholder="Number of attendees"
                      value={newEvent.attendees}
                      onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                  
                  {/* Email Reminder Option */}
                  <ReminderSettings
                    enabled={newEvent.email_reminder ?? true}
                    reminderDays={newEvent.reminder_days ?? 1}
                    onEnabledChange={(enabled) => setNewEvent({ ...newEvent, email_reminder: enabled })}
                    onReminderDaysChange={(days) => setNewEvent({ ...newEvent, reminder_days: days })}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddEvent}>
                    {editingEvent ? "Update Event" : "Add Event"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Calendar and Events Grid */}
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Calendar Widget */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date)
                    if (date) {
                      setIsDialogOpen(true)
                    }
                  }}
                  className="rounded-md [&_.rdp-day_button.rdp-day_selected]:bg-emerald-500 [&_.rdp-day_button.rdp-day_selected]:text-white [&_.rdp-day_button.rdp-day_today]:bg-primary/20 [&_.rdp-day_button.rdp-day_today]:text-primary"
                  modifiers={{
                    hasEvent: eventsWithDates,
                  }}
                  modifiersClassNames={{
                    hasEvent: "font-bold text-primary",
                  }}
                />
              </CardContent>
            </Card>

            {/* Upcoming Events Summary */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Next 5 events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events</p>
                ) : (
                  upcomingEvents.map((event) => {
                    const CategoryIcon = categoryIcons[event.category]
                    return (
                      <div key={event.id} className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryColors[event.category]}`}>
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {formatTime12Hour(event.time)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Events for Selected Date */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      Events for {selectedDate?.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                    </CardTitle>
                    <CardDescription>{selectedDateEvents.length} events scheduled</CardDescription>
                  </div>
                  <Badge variant="outline">{selectedDate?.toLocaleDateString("en-US", { weekday: "short" })}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {selectedDateEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-semibold text-foreground">No events scheduled</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Add an event to start organizing your day
                    </p>
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Event
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDateEvents.map((event) => {
                      const CategoryIcon = categoryIcons[event.category]
                      return (
                        <Card key={event.id} className="border-l-4" style={{ borderLeftColor: `hsl(var(--${event.category === "work" ? "accent" : event.category === "health" ? "success" : event.category === "finance" ? "warning" : "primary"}))` }}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryColors[event.category]}`}>
                                  <CategoryIcon className="h-5 w-5" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">{event.title}</CardTitle>
                                  <div className="mt-1 flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      <Clock className="mr-1 h-3 w-3" />
                                      {formatTime12Hour(event.time)}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs capitalize">
                                      {event.category}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditEvent(event)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteEvent(event.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {(event.description || event.location || event.attendees) && (
                            <CardContent className="pt-0">
                              {event.description && (
                                <p className="text-sm text-muted-foreground">{event.description}</p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-3">
                                {event.location && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {event.location}
                                  </div>
                                )}
                                {event.attendees && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    {event.attendees} attendees
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}

                {/* Synced Events from Google Calendar */}
                {selectedDateSyncedEvents.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      From Connected Calendars
                    </h4>
                    <div className="space-y-3">
                      {selectedDateSyncedEvents.map((event) => (
                        <div 
                          key={event.id} 
                          className="p-3 rounded-lg border-l-4"
                          style={{ borderLeftColor: event.color }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{event.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {event.provider === "google" ? (
                                    <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                  ) : (
                                    <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24"><path fill="#0078D4" d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/></svg>
                                  )}
                                  {event.provider}
                                </Badge>
                                {!event.all_day && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
