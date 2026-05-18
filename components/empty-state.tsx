"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { motionPresets } from "@/lib/motion"
import { cn } from "@/lib/utils"

type EmptyStateAction = {
  label: string
  href?: string
  onClick?: () => void
}

export function AppEmptyState({
  icon: Icon,
  title,
  hint,
  primaryAction,
  secondaryAction,
  allClear = false,
  children,
  className,
}: {
  icon?: LucideIcon
  title: string
  hint?: string
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  allClear?: boolean
  children?: ReactNode
  className?: string
}) {
  return (
    <Empty
      className={cn(
        "border bg-muted/10",
        allClear && "border-emerald-500/20 bg-emerald-500/5",
        motionPresets.fadeInUp,
        className,
      )}
    >
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon" className={cn("bg-primary/10 text-primary", allClear && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300")}>
            <Icon className="h-5 w-5" />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {hint && <EmptyDescription>{hint}</EmptyDescription>}
      </EmptyHeader>
      {(children || primaryAction || secondaryAction) && (
        <EmptyContent>
          {children}
          {(primaryAction || secondaryAction) && (
            <div className="flex w-full flex-col justify-center gap-2 sm:flex-row">
              {primaryAction && <EmptyAction action={primaryAction} />}
              {secondaryAction && <EmptyAction action={secondaryAction} variant="outline" />}
            </div>
          )}
        </EmptyContent>
      )}
    </Empty>
  )
}

function EmptyAction({ action, variant = "default" }: { action: EmptyStateAction; variant?: "default" | "outline" }) {
  if (action.href) {
    return (
      <Button asChild variant={variant} className="w-full sm:w-auto">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    )
  }

  return (
    <Button type="button" variant={variant} onClick={action.onClick} className="w-full sm:w-auto">
      {action.label}
    </Button>
  )
}
