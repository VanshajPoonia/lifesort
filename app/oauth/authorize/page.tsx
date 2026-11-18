import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getUserFromSession } from "@/lib/auth"
import { checkAuthorizeRequest, withParams } from "@/lib/oauth-server"

export const metadata: Metadata = { title: "Connect an app | LifeSort", robots: { index: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function flatten(raw: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

const SHARED = ["Tasks and goals", "Notes", "Calendar events", "Your Inbox"]
const NEVER = ["Journal", "Money", "Vault", "People", "Any domain you keep away from AI"]

// The consent screen ChatGPT, Claude or another MCP app sends people to when connecting.
export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const params = flatten(await searchParams)
  const check = await checkAuthorizeRequest(params)

  if ("fatal" in check) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Can&apos;t connect this app</CardTitle>
            <CardDescription>{check.fatal}</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    )
  }
  if ("sendBack" in check) {
    const { redirectUri, error, description, state } = check.sendBack
    redirect(withParams(redirectUri, { error, error_description: description, state }))
  }

  const user = await getUserFromSession()
  if (!user) {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`)
  }

  const { client, redirectUri, state, challenge } = check.ok
  const returnHost = new URL(redirectUri).host

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Connect {client.client_name} to LifeSort?</CardTitle>
          <CardDescription>
            Signed in as {user.email}. {client.client_name} will be able to read the things below and add to your Inbox and tasks.
            It can&apos;t edit or delete anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">It can see</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {SHARED.map((item) => (
                  <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" aria-hidden="true" />{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">It never sees</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {NEVER.map((item) => (
                  <li key={item} className="flex items-center gap-2"><X className="h-4 w-4" aria-hidden="true" />{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            You&apos;ll go back to {returnHost}. You can disconnect it any time in Settings &gt; Account.
          </p>
          <form method="POST" action="/api/oauth/authorize" className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <input type="hidden" name="client_id" value={client.client_id} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="code_challenge" value={challenge} />
            {state && <input type="hidden" name="state" value={state} />}
            <Button type="submit" name="decision" value="deny" variant="outline">Cancel</Button>
            <Button type="submit" name="decision" value="allow">Allow</Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  )
}
