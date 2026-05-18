'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-provider'
import { Button } from './ui/button'
import { X, Coffee, Clock } from 'lucide-react'

export function SubscriptionChecker() {
  const { user } = useAuth()
  const [subscriptionState, setSubscriptionState] = useState<'active' | 'trial' | 'expired'>('active')
  const [dismissed, setDismissed] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const bannerRef = useRef<HTMLDivElement | null>(null)

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
        const hours = Math.max(1, Math.ceil(diff / (1000 * 60 * 60)))
        
        setTimeLeft(`${hours}h`)
        setSubscriptionState('trial')
      }
    }

    checkSubscription()
    const interval = setInterval(checkSubscription, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [user])

  const isVisible = subscriptionState !== 'active' && !dismissed

  useEffect(() => {
    const root = document.documentElement

    if (!isVisible) {
      root.style.setProperty('--subscription-banner-offset', '0px')
      return
    }

    const updateOffset = () => {
      const height = bannerRef.current?.offsetHeight ?? 0
      root.style.setProperty('--subscription-banner-offset', `${height}px`)
    }

    updateOffset()
    const resizeObserver = new ResizeObserver(updateOffset)
    if (bannerRef.current) resizeObserver.observe(bannerRef.current)
    window.addEventListener('resize', updateOffset)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateOffset)
      root.style.setProperty('--subscription-banner-offset', '0px')
    }
  }, [isVisible, timeLeft])

  if (isVisible) {
    const isExpired = subscriptionState === 'expired'

    return (
      <div ref={bannerRef} className="fixed left-0 right-0 top-0 z-40 border-b border-primary/10 bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 sm:flex">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {isExpired ? (
                    <>
                      <span className="sm:hidden">Trial ended</span>
                      <span className="hidden sm:inline">Free trial ended</span>
                    </>
                  ) : (
                    <>
                      <span className="sm:hidden">Trial: <span className="text-primary">{timeLeft}</span> left</span>
                      <span className="hidden sm:inline">Free Trial: <span className="text-primary">{timeLeft}</span> remaining</span>
                    </>
                  )}
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {isExpired
                    ? 'You can keep using LifeSort here; upgrade when you are ready.'
                    : 'Upgrade when you are ready to keep LifeSort supported.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href="https://buymeacoffee.com/lifesort" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="sm" className="h-8 bg-gradient-to-r from-primary to-accent px-3 hover:opacity-90">
                  <Coffee className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Go Pro</span>
                  <span className="sm:hidden">Upgrade</span>
                </Button>
              </a>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss subscription banner"
                title="Dismiss subscription banner"
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
