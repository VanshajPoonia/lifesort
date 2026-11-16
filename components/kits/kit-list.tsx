"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"

import { KitCard } from "@/components/kits/kit-card"
import { localToday } from "@/components/kits/kit-icon"
import { StartKitDialog } from "@/components/kits/start-kit-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { KitSummary } from "@/lib/life-kits-server"

type KitListProps = {
  // Limits the list to one domain and starts new kits in it.
  lifeAreaId?: number | null
  title?: string
  emptyText: string
}

export function KitList({ lifeAreaId = null, title = "Kits", emptyText }: KitListProps) {
  const [kits, setKits] = useState<KitSummary[] | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ today: localToday() })
    if (lifeAreaId) params.set("life_area_id", String(lifeAreaId))
    fetch(`/api/kits?${params}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || "Couldn't load your kits.")
        if (!cancelled) {
          setKits(data.kits ?? [])
          setError("")
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Couldn't load your kits.")
      })
    return () => {
      cancelled = true
    }
  }, [lifeAreaId, version])

  const current = (kits ?? []).filter((kit) => kit.status !== "finished")
  const finished = (kits ?? []).length - current.length

  return (
    <section aria-labelledby="kits-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="kits-heading" className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <Button size="sm" variant="outline" className="gap-1.5 bg-card" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Start a kit
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : kits === null ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : current.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {current.map((kit) => (
            <KitCard key={kit.id} kit={kit} onChanged={reload} />
          ))}
        </div>
      )}
      {finished > 0 && (
        <p className="text-xs text-muted-foreground">
          {finished} finished {finished === 1 ? "kit" : "kits"}. Their steps and goals stay where they are.
        </p>
      )}

      <StartKitDialog open={open} onOpenChange={setOpen} lifeAreaId={lifeAreaId} onStarted={reload} />
    </section>
  )
}
