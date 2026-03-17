'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './auth-provider'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { X, Coffee, Clock, CheckCircle2 } from 'lucide-react'

export function SubscriptionChecker() {
  const { user } = useAuth()
  const [showPaywall, setShowPaywall] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    if (!user) return

    const checkSubscription = () => {
      const now = new Date()
      const trialEnd = new Date(user.trial_ends_at)
      const hasActiveSubscription = user.is_subscribed && 
        user.subscription_ends_at && 
        new Date(user.subscription_ends_at) > now

      // If trial expired and no active subscription, show paywall
      if (now > trialEnd && !hasActiveSubscription) {
        setShowPaywall(true)
        return
      }

      // If trial is active, calculate time left and show banner
      if (now < trialEnd && !user.is_subscribed) {
        const diff = trialEnd.getTime() - now.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        
        setTimeLeft(`${hours}h ${minutes}m`)
        setShowBanner(true)
      }
    }

    checkSubscription()
    const interval = setInterval(checkSubscription, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [user])

  if (showPaywall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
        <Card className="glass-strong w-full max-w-2xl border-primary/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Coffee className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">Your Free Trial Has Ended</CardTitle>
            <CardDescription className="text-lg">
              Thank you for trying LifeSort! To continue organizing your life, please support us with a coffee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 p-6 rounded-lg bg-muted/50">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Unlimited Access</p>
                  <p className="text-sm text-muted-foreground">Full access to all features forever</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Cloud Sync</p>
                  <p className="text-sm text-muted-foreground">Your data synced across all devices</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Support Development</p>
                  <p className="text-sm text-muted-foreground">Help us build more amazing features</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <a 
                href="https://buymeacoffee.com/lifesort" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button size="lg" className="w-full text-lg h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  <Coffee className="mr-2 h-5 w-5" />
                  Buy Me a Coffee & Continue
                </Button>
              </a>
              <p className="text-xs text-center text-muted-foreground">
                After payment, your subscription will be activated manually. Please refresh the page or contact support if needed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showBanner) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 glass-strong border-b border-primary/20 md:left-64">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  Free Trial: <span className="text-primary">{timeLeft}</span> remaining
                </p>
                <p className="text-xs text-muted-foreground">
                  Support us to continue using LifeSort after your trial ends
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href="https://buymeacoffee.com/lifesort" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="sm" className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  <Coffee className="mr-2 h-4 w-4" />
                  Support Us
                </Button>
              </a>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setShowBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
