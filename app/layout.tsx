import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { DomainFocusProvider } from "@/components/domain-focus-provider"
import { SubscriptionChecker } from "@/components/subscription-checker"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LifeSort - Organize Your Life",
  description: "A comprehensive life management platform for goals, tasks, investments, and personal growth",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LifeSort",
  },
  generator: "v0.app",
}

// Pinch-zoom stays enabled (WCAG 1.4.4); inputs are 16px on mobile so iOS doesn't auto-zoom on focus.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#1B1A1E" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} h-full`}>
        <ThemeProvider>
          <AuthProvider>
            <DomainFocusProvider>
              <SubscriptionChecker />
              {children}
              <Toaster />
            </DomainFocusProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
