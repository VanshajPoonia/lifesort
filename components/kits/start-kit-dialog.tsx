"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"

import { KitIcon, localToday } from "@/components/kits/kit-icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { addDaysToDate } from "@/lib/date-math"
import { LIFE_KITS, getKitDefinition, planKit, type KitDefinition, type PlannedKitItem } from "@/lib/life-kits"

type StartKitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lifeAreaId?: number | null
  onStarted?: () => void
}

function itemLabel(item: PlannedKitItem) {
  if (item.type === "goal") return { kind: "Goal", text: item.title }
  if (item.type === "task") return { kind: "Step", text: item.title }
  if (item.type === "habit") return { kind: "Habit", text: item.name }
  if (item.type === "budget_category") return { kind: "Budget", text: item.name }
  return { kind: "Vault", text: item.title }
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// Pick a kit, give it its key date, and see exactly what it will add before starting it.
export function StartKitDialog({ open, onOpenChange, lifeAreaId = null, onStarted }: StartKitDialogProps) {
  const { toast } = useToast()
  const [kitKey, setKitKey] = useState<string | null>(null)
  const [anchorDate, setAnchorDate] = useState("")
  const [label, setLabel] = useState("")
  const [amount, setAmount] = useState("")
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const definition = kitKey ? getKitDefinition(kitKey) : null
  const today = localToday()
  const amountValue = Number(amount)
  const plan = useMemo(() => {
    if (!definition || !anchorDate) return null
    return planKit(definition, anchorDate, today, {
      label: label.trim() || null,
      amount: Number.isFinite(amountValue) && amountValue > 0 ? amountValue : null,
    })
  }, [definition, anchorDate, today, label, amountValue])

  const chooseKit = (kit: KitDefinition) => {
    setKitKey(kit.key)
    setAnchorDate(addDaysToDate(today, kit.defaultDateOffset))
    setLabel("")
    setAmount("")
    setSkip(new Set())
    setError("")
  }

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setKitKey(null)
      setError("")
    }
  }

  const toggleItem = (key: string) => {
    setSkip((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const start = async () => {
    if (!definition || !plan) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kit_key: definition.key,
          anchor_date: anchorDate,
          today,
          label: label.trim() || null,
          amount: Number.isFinite(amountValue) && amountValue > 0 ? amountValue : null,
          life_area_id: lifeAreaId,
          skip: Array.from(skip),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't start that kit.")
      toast({ title: `${plan.title} is set up`, description: "Its first steps are on Today and in Tasks." })
      close(false)
      onStarted?.()
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Couldn't start that kit.")
    } finally {
      setSaving(false)
    }
  }

  const chosen = plan ? plan.items.length - plan.items.filter((item) => skip.has(item.key)).length : 0

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {!definition ? (
          <>
            <DialogHeader>
              <DialogTitle>What&apos;s going on in your life?</DialogTitle>
              <DialogDescription>Pick a kit. It sets up the steps, a goal and habits for you.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              {LIFE_KITS.map((kit) => (
                <button
                  key={kit.key}
                  type="button"
                  onClick={() => chooseKit(kit)}
                  className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <KitIcon name={kit.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{kit.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{kit.summary}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <button
                type="button"
                onClick={() => setKitKey(null)}
                className="mb-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                All kits
              </button>
              <DialogTitle className="flex items-center gap-2">
                <KitIcon name={definition.icon} className="h-5 w-5 text-primary" />
                {plan?.title ?? definition.name}
              </DialogTitle>
              <DialogDescription>{definition.summary}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kit-date">{definition.dateLabel}</Label>
                <Input id="kit-date" type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
              </div>
              {definition.labelPrompt && (
                <div className="space-y-1.5">
                  <Label htmlFor="kit-label">{definition.labelPrompt.question}</Label>
                  <Input
                    id="kit-label"
                    value={label}
                    maxLength={60}
                    placeholder={definition.labelPrompt.placeholder}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                </div>
              )}
              {definition.amountPrompt && (
                <div className="space-y-1.5">
                  <Label htmlFor="kit-amount">{definition.amountPrompt}</Label>
                  <Input id="kit-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} />
                </div>
              )}
            </div>

            {plan && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  It will add {chosen} {chosen === 1 ? "thing" : "things"}. Untick anything you don&apos;t need.
                </p>
                <ul className="divide-y rounded-lg border">
                  {plan.items.map((item) => {
                    const { kind, text } = itemLabel(item)
                    const id = `kit-item-${item.key}`
                    return (
                      <li key={item.key} className="flex items-center gap-3 px-3 py-2">
                        <Checkbox id={id} checked={!skip.has(item.key)} onCheckedChange={() => toggleItem(item.key)} />
                        <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0">
                            <span className="text-muted-foreground">{kind}: </span>
                            <span className="text-foreground">{text}</span>
                          </span>
                          {item.type === "task" && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(item.date)}</span>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {plan.skippedPast > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {plan.skippedPast === 1 ? "1 early step is" : `${plan.skippedPast} early steps are`} left out because that date has passed.
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => void start()} disabled={saving || !plan || chosen === 0} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Start kit
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
