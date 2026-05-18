"use client"

import { Heart, Target, TrendingUp, Wallet } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { FavoritesTodo, HubGrid, HubHero, type HubCard } from "@/components/hub-page"

const moneyCards: HubCard[] = [
  {
    title: "Overview",
    description: "Use this page as the finance hub before jumping into a specific money tool.",
    href: "/money",
    icon: Wallet,
    badge: "Current page",
    priority: "primary",
  },
  {
    title: "Budget",
    description: "Categories, transactions, goals, and spending context.",
    href: "/budget",
    icon: Wallet,
    badge: "Finance",
    priority: "primary",
  },
  {
    title: "Income",
    description: "Track income sources, payment timing, and active status.",
    href: "/income",
    icon: Target,
    badge: "Sources",
    priority: "primary",
  },
  {
    title: "Investments",
    description: "Monitor positions, prices, returns, and finance-related assets.",
    href: "/investments",
    icon: TrendingUp,
    badge: "Portfolio",
  },
  {
    title: "Wishlist",
    description: "Plan purchases, savings ideas, priorities, and bought items.",
    href: "/wishlist",
    icon: Heart,
    badge: "Savings",
  },
]

export default function MoneyHubPage() {
  return (
    <DashboardLayout title="Money" subtitle="Budget, income, investments, and wishlist">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <HubHero
          eyebrow="Money"
          title="Keep financial decisions in one place"
          description="Jump into the money tools without crowding the main sidebar with every finance module."
        />
        <HubGrid cards={moneyCards} />
        <FavoritesTodo />
      </div>
    </DashboardLayout>
  )
}
