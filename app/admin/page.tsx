"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert,
  User,
  Mail,
  Phone,
  MapPin,
  Cake,
  Eye,
  Crown,
  Ban,
  CalendarDays,
} from "lucide-react"

interface UserProfile {
  id: string
  email: string
  name: string
  created_at: string
  trial_ends_at: string
  is_subscribed: boolean
  subscription_ends_at: string | null
  subscription_tier: string
  status: 'active' | 'trial' | 'expired'
  avatar: string | null
  bio: string | null
  phone: string | null
  location: string | null
  date_of_birth: string | null
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
  const [customDate, setCustomDate] = useState("")
  const [customTier, setCustomTier] = useState("pro")

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/update-subscription')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSubscription = async (userId: string, isSubscribed: boolean, endDate?: string | null, tier?: string) => {
    setUpdating(userId)
    try {
      const response = await fetch('/api/admin/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          isSubscribed, 
          subscriptionEndsAt: endDate,
          subscriptionTier: tier || (isSubscribed ? 'pro' : 'free')
        })
      })

      if (response.ok) {
        await fetchUsers()
        setIsSubscriptionOpen(false)
        setSelectedUser(null)
        setCustomDate("")
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
    } finally {
      setUpdating(null)
    }
  }

  const cancelSubscription = async (userId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return
    await updateSubscription(userId, false, null, 'free')
  }

  const applyCustomValidity = () => {
    if (!selectedUser || !customDate) return
    updateSubscription(selectedUser.id, true, new Date(customDate).toISOString(), customTier)
  }

  const getStatusBadge = (user: UserProfile) => {
    switch (user.status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>
      case 'trial':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Trial</Badge>
      case 'expired':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>
    }
  }

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return <Badge className="bg-purple-500"><Crown className="h-3 w-3 mr-1" />Enterprise</Badge>
      case 'pro':
        return <Badge className="bg-blue-500"><Crown className="h-3 w-3 mr-1" />Pro</Badge>
      default:
        return <Badge variant="outline">Free</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (authLoading || loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user.is_admin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
          <Button className="mt-4" onClick={() => router.push('/')}>Go to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, subscriptions, and view profiles</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 mb-8 md:grid-cols-4">
          <Card className="border-[0.5px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{users.length}</div>
            </CardContent>
          </Card>
          
          <Card className="border-[0.5px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {users.filter(u => u.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[0.5px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trial Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                {users.filter(u => u.status === 'trial').length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[0.5px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                {users.filter(u => u.status === 'expired').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="border-[0.5px]">
          <CardHeader>
            <CardTitle>Users & Subscriptions</CardTitle>
            <CardDescription>View profiles, manage subscriptions with custom validity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((userItem) => (
                <div 
                  key={userItem.id}
                  className="flex flex-col gap-4 p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={userItem.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {userItem.name?.charAt(0) || userItem.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{userItem.name || 'No name'}</h3>
                          {getStatusBadge(userItem)}
                          {getTierBadge(userItem.subscription_tier)}
                        </div>
                        <p className="text-sm text-muted-foreground">{userItem.email}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                          <span>Joined: {formatDate(userItem.created_at)}</span>
                          <span>Trial Ends: {formatDate(userItem.trial_ends_at)}</span>
                          {userItem.subscription_ends_at && (
                            <span className="text-green-600">Sub Ends: {formatDate(userItem.subscription_ends_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(userItem)
                          setIsProfileOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Profile
                      </Button>
                      
                      {userItem.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelSubscription(userItem.id)}
                          disabled={updating === userItem.id}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                              updateSubscription(userItem.id, true, endDate, 'pro')
                            }}
                            disabled={updating === userItem.id}
                          >
                            1 Month
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                              updateSubscription(userItem.id, true, endDate, 'pro')
                            }}
                            disabled={updating === userItem.id}
                          >
                            1 Year
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedUser(userItem)
                              setCustomDate("")
                              setCustomTier("pro")
                              setIsSubscriptionOpen(true)
                            }}
                            disabled={updating === userItem.id}
                          >
                            <CalendarDays className="h-4 w-4 mr-1" />
                            Custom
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="bg-background max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>View user details and profile information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {selectedUser.name?.charAt(0) || selectedUser.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.name || 'No name'}</h3>
                  <div className="flex gap-2 mt-1">
                    {getStatusBadge(selectedUser)}
                    {getTierBadge(selectedUser.subscription_tier)}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedUser.email}</span>
                </div>
                
                {selectedUser.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedUser.phone}</span>
                  </div>
                )}
                
                {selectedUser.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedUser.location}</span>
                  </div>
                )}
                
                {selectedUser.date_of_birth && (
                  <div className="flex items-center gap-3">
                    <Cake className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(selectedUser.date_of_birth)}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Joined {formatDate(selectedUser.created_at)}</span>
                </div>
              </div>

              {selectedUser.bio && (
                <div className="pt-4 border-t">
                  <Label className="text-xs uppercase text-muted-foreground">Bio</Label>
                  <p className="text-sm mt-1">{selectedUser.bio}</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <Label className="text-xs uppercase text-muted-foreground">Subscription Details</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Trial Ends:</span>
                    <p>{formatDate(selectedUser.trial_ends_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sub Ends:</span>
                    <p>{formatDate(selectedUser.subscription_ends_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Subscription Dialog */}
      <Dialog open={isSubscriptionOpen} onOpenChange={setIsSubscriptionOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Custom Subscription</DialogTitle>
            <DialogDescription>
              Set a custom validity period for {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select value={customTier} onValueChange={setCustomTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="text-foreground"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  if (selectedUser) {
                    updateSubscription(selectedUser.id, true, null, customTier)
                  }
                }}
                disabled={updating === selectedUser?.id}
              >
                Lifetime Access
              </Button>
              <Button
                className="flex-1"
                onClick={applyCustomValidity}
                disabled={!customDate || updating === selectedUser?.id}
              >
                Apply Custom Date
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
