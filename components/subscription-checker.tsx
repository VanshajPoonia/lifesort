'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './auth-provider'
import { Button } from './ui/button'
import { X, Coffee, Clock } from 'lucide-react'

export function SubscriptionChecker() {
  const { user } = useAuth()
  const [subscriptionState, setSubscriptionState] = useState<'active' | 'trial' | 'expired'>('active')
  const [dismissed, setDismissed] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    setDismissed(false)

    if (!user) {
      setSubscriptionState('active')
      setTimeLeft('')
      return
    }

    const checkSubscription = () => {
      const now = new Date()
      const trialEnd = new Date(user.trial_ends_at)
      const hasActiveSubscription = user.is_subscribed && 
        user.subscription_ends_at && 
        new Date(user.subscription_ends_at) > now

      if (hasActiveSubscription) {
        setSubscriptionState('active')
        setTimeLeft('')
        return
      }

      if (now > trialEnd && !hasActiveSubscription) {
        setSubscriptionState('expired')
        setTimeLeft('')
        return
      }

      if (now < trialEnd && !user.is_subscribed) {
        const diff = trialEnd.getTime() - now.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        
        setTimeLeft(`${hours}h ${minutes}m`)
        setSubscriptionState('trial')
      }
    }

    checkSubscription()
    const interval = setInterval(checkSubscription, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [user])

  if (subscriptionState !== 'active' && !dismissed) {
    const isExpired = subscriptionState === 'expired'

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
                  {isExpired ? (
                    <>Free trial ended</>
                  ) : (
                    <>Free Trial: <span className="text-primary">{timeLeft}</span> remaining</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isExpired
                    ? 'You can keep using LifeSort here; support us when you are ready.'
                    : 'Support us to continue using LifeSort after your trial ends'}
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
                onClick={() => setDismissed(true)}
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
