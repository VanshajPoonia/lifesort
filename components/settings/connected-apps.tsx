"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { Copy, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type Connection = { client_id: string; client_name: string; connected_at: string; last_used_at: string | null }

// The page's origin never changes, so there is nothing to subscribe to.
const noChanges = () => () => {}

function shortDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "not yet"
}

// Settings > Account: the address to add LifeSort as a connector in ChatGPT or Claude,
// and the apps already connected, each with Disconnect.
export function ConnectedApps() {
  const { toast } = useToast()
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)
  const address = useSyncExternalStore(noChanges, () => `${window.location.origin}/api/mcp`, () => "")

  useEffect(() => {
    let cancelled = false
    fetch("/api/oauth/connections")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled) setConnections(response.ok ? data.connections ?? [] : [])
      })
      .catch(() => {
        if (!cancelled) setConnections([])
      })
    return () => {
      cancelled = true
    }
  }, [reloads])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      toast({ title: "Copied the connector address" })
    } catch {
      toast({ title: "Couldn't copy", description: "Select the address and copy it yourself.", variant: "destructive" })
    }
  }

  const remove = async (connection: Connection) => {
    setRemoving(connection.client_id)
    const response = await fetch("/api/oauth/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: connection.client_id }),
    })
    setRemoving(null)
    if (!response.ok) {
      toast({ title: "Couldn't disconnect", description: "Try again.", variant: "destructive" })
      return
    }
    toast({ title: `Disconnected ${connection.client_name}` })
    setReloads((count) => count + 1)
  }

  return (
    <section aria-labelledby="connected-apps" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="connected-apps" className="text-lg font-semibold tracking-tight text-foreground">
        Use LifeSort in ChatGPT or Claude
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask your assistant what&apos;s on today, find a note, or have it drop something in your Inbox. It sees your tasks, goals, notes,
        calendar and Inbox. It never sees your Journal, Money, Vault, People, or any domain you keep away from AI.
      </p>

      <div className="mt-4 flex gap-2">
        <Input readOnly value={address} aria-label="Connector address" onFocus={(event) => event.currentTarget.select()} />
        <Button type="button" variant="outline" className="shrink-0 gap-2" onClick={() => void copy()} disabled={!address}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy
        </Button>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        <li><span className="font-medium text-foreground">Claude:</span> Settings &gt; Connectors &gt; Add custom connector, paste the address, then Connect.</li>
        <li><span className="font-medium text-foreground">ChatGPT:</span> Settings &gt; Apps &amp; Connectors &gt; Advanced settings, turn on Developer mode, then Create and paste the address.</li>
        <li>You&apos;ll sign in to LifeSort and choose Allow.</li>
      </ul>

      <div className="mt-4 border-t pt-4">
        <p className="text-sm font-medium">Connected</p>
        {connections === null ? (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</p>
        ) : connections.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No apps yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {connections.map((connection) => (
              <li key={connection.client_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{connection.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {shortDate(connection.connected_at)}. Last used {shortDate(connection.last_used_at)}.
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={removing === connection.client_id} onClick={() => void remove(connection)}>
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
