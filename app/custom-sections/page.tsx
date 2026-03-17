"use client"

import { Book, CheckSquare, Heart, List, Star, Briefcase, Film, Music } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"

interface Template {
  id: string
  name: string
  description: string
  icon: any
  color: string
  bgColor: string
  examples: string[]
}

export default function CustomSectionsPage() {
  const router = useRouter()
  
  const templates: Template[] = [
    {
      id: "books",
      name: "Books to Read",
      description: "Track books you want to read and your reading progress",
      icon: Book,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
      examples: ["Add book titles", "Track reading status", "Add notes and ratings"]
    },
    {
      id: "movies",
      name: "Movies & Shows",
      description: "Keep a watchlist of movies and TV shows",
      icon: Film,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
      examples: ["Movie watchlist", "TV series tracker", "Rate what you've watched"]
    },
    {
      id: "music",
      name: "Music & Playlists",
      description: "Track albums, artists, and songs you want to explore",
      icon: Music,
      color: "text-pink-600",
      bgColor: "bg-pink-600/10",
      examples: ["Album wishlist", "Artist discovery", "Concert bucket list"]
    },
    {
      id: "bucket-list",
      name: "Bucket List",
      description: "Life experiences and adventures you want to have",
      icon: Star,
      color: "text-yellow-600",
      bgColor: "bg-yellow-600/10",
      examples: ["Travel destinations", "Skills to learn", "Life experiences"]
    },
    {
      id: "habits",
      name: "Habit Tracker",
      description: "Build and maintain daily habits and routines",
      icon: CheckSquare,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
      examples: ["Daily habits", "Streak tracking", "Habit notes"]
    },
    {
      id: "projects",
      name: "Side Projects",
      description: "Ideas and projects you want to work on",
      icon: Briefcase,
      color: "text-orange-600",
      bgColor: "bg-orange-600/10",
      examples: ["Project ideas", "Work in progress", "Completed projects"]
    },
    {
      id: "favorites",
      name: "Favorites",
      description: "Your favorite things, places, quotes, or anything else",
      icon: Heart,
      color: "text-red-600",
      bgColor: "bg-red-600/10",
      examples: ["Favorite quotes", "Favorite places", "Favorite recipes"]
    },
    {
      id: "custom",
      name: "Custom List",
      description: "Create your own custom category for anything",
      icon: List,
      color: "text-gray-600",
      bgColor: "bg-gray-600/10",
      examples: ["Fully customizable", "Name it anything", "Add any items"]
    }
  ]

  return (
    <DashboardLayout title="Custom Sections" subtitle="Choose a template to get started">
      <div className="space-y-6">
        {/* Coming Soon Notice */}
        <Card className="border-dashed border-2 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Custom Sections - Coming Soon!
            </CardTitle>
            <CardDescription>
              We're working on bringing you powerful custom sections. In the meantime, check out the "My Links" section to save your favorite websites with auto-fetched thumbnails!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/links')} className="gap-2">
              Go to My Links
            </Button>
          </CardContent>
        </Card>

        {/* Template Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card 
              key={template.id}
              className="group cursor-not-allowed opacity-60 transition-all hover:shadow-lg"
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg ${template.bgColor} p-3`}>
                    <template.icon className={`h-6 w-6 ${template.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">What you can track:</p>
                  <ul className="space-y-1">
                    {template.examples.map((example, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button 
                  className="mt-4 w-full bg-transparent" 
                  variant="outline"
                  disabled
                >
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feature Highlight */}
        <Card className="bg-gradient-to-r from-primary/20 to-accent/20">
          <CardHeader>
            <CardTitle>Meanwhile, try My Links!</CardTitle>
            <CardDescription className="text-foreground/80">
              Create your personal Linktree-style page with auto-fetched thumbnails and organize all your favorite websites in one place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/links')} size="lg" className="gap-2">
              <Star className="h-4 w-4" />
              Try My Links Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
