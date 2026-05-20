"use client"

import Link from "next/link"
import { ArrowLeft, BarChart3, Heart, TrendingUp, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const moneyLinks = [
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/income", label: "Income", icon: TrendingUp },
  { href: "/investments", label: "Investments", icon: BarChart3 },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
]

export function MoneyBackNav({ current, className }: { current?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <Button asChild variant="outline" size="sm" className="w-fit gap-2">
        <Link href="/money">
          <ArrowLeft className="h-4 w-4" />
          Back to Money
        </Link>
      </Button>
      <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
        {moneyLinks.map((item) => {
          const Icon = item.icon
          const active = current === item.label
          return (
            <Button key={item.href} asChild variant={active ? "secondary" : "ghost"} size="sm" className="shrink-0 gap-2">
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
