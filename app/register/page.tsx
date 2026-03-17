'use client'

import React from "react"
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Sparkles, Target, Calendar, TrendingUp, Brain, CheckCircle2 } from 'lucide-react'
import gsap from 'gsap'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current && cardRef.current) {
      gsap.from(containerRef.current.querySelectorAll('.animate-in'), {
        opacity: 0,
        y: 20,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out'
      })
      gsap.from(cardRef.current, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        delay: 0.3,
        ease: 'power3.out'
      })
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await register(email, password, name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Dot pattern background */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />
      
      {/* Gradient orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div ref={containerRef} className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Badge */}
        <div className="animate-in mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Start Your Journey</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="animate-in text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-center text-foreground max-w-3xl leading-tight">
          Take control of
          <br />
          <span className="italic">your life today.</span>
        </h1>

        {/* Subtitle */}
        <p className="animate-in mt-6 text-lg text-muted-foreground text-center max-w-xl">
          Join thousands who use LifeSort to stay organized, focused, and on track.
          <br className="hidden sm:block" />
          Free to start. No credit card required.
        </p>

        {/* Register Card */}
        <div 
          ref={cardRef}
          className="mt-10 w-full max-w-md"
        >
          <div className="backdrop-blur-xl bg-card/80 border border-border/50 rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Create your account</h2>
              <p className="text-sm text-muted-foreground mt-1">Get started in less than a minute</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 bg-background/50 border-border/50 text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-background/50 border-border/50 text-foreground"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-background/50 border-border/50 text-foreground"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 bg-background/50 border-border/50 text-foreground"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loading}>
                {loading ? 'Creating account...' : 'Get Started Free'}
              </Button>

              <div className="text-center text-sm text-muted-foreground pt-2">
                Already have an account?{' '}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Benefits */}
        <div className="animate-in mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Track Goals</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Manage Finances</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Plan Your Day</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">AI Powered</span>
          </div>
        </div>

        {/* Trust text */}
        <p className="animate-in mt-10 text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Your data is encrypted and secure
        </p>
      </div>
    </div>
  )
}
