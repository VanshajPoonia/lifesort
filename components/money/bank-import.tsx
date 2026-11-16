"use client"

import { useState } from "react"
import { FileUp, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { readBankCsv, type BankCsv } from "@/lib/bank-import"
import { formatCurrency } from "@/lib/currency"

const MAX_FILE_BYTES = 3 * 1024 * 1024

// Money > Budget: add a bank statement's rows as transactions. The file is read in the
// browser and shown first; rows already in LifeSort are skipped on the server.
export function BankImport({ currency, onImported }: { currency: string; onImported: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [dayFirst, setDayFirst] = useState<boolean | undefined>(undefined)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState("")

  const result = text ? readBankCsv(text, dayFirst) : null
  const statement = result && !("error" in result) ? (result as BankCsv) : null
  const spent = statement?.rows.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0) ?? 0
  const received = statement?.rows.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0) ?? 0

  const readFile = async (file: File | undefined) => {
    setError("")
    setText("")
    setDayFirst(undefined)
    if (!file) return
    setFileName(file.name)
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 3 MB. Export a shorter date range.")
      return
    }
    setText(await file.text())
  }

  const runImport = async () => {
    if (!statement) return
    setImporting(true)
    setError("")
    try {
      const response = await fetch("/api/import/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: statement.rows }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't import that statement.")
      toast({
        title: `Added ${data.created} ${data.created === 1 ? "transaction" : "transactions"}`,
        description: data.already_there > 0 ? `${data.already_there} were already in LifeSort and were skipped.` : undefined,
      })
      setText("")
      setFileName("")
      setOpen(false)
      onImported()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Couldn't import that statement.")
    } finally {
      setImporting(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-2 bg-card" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4" aria-hidden="true" />
        Import a bank statement
      </Button>
    )
  }

  return (
    <section aria-labelledby="bank-import" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="bank-import" className="text-base font-semibold tracking-tight text-foreground">
        Import a bank statement
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use your bank&apos;s CSV export. Money out becomes spending and money in becomes income. Rows you already imported are skipped.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input id="bank-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
        <Button asChild variant="outline" size="sm" className="gap-2">
          <label htmlFor="bank-file" className="cursor-pointer">
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Choose a CSV file
          </label>
        </Button>
        {fileName && <span className="min-w-0 truncate text-sm text-muted-foreground">{fileName}</span>}
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {(error || (result && "error" in result)) && (
        <p className="mt-3 text-sm text-destructive">{error || (result as { error: string }).error}</p>
      )}

      {statement && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground">
            {statement.rows.length} {statement.rows.length === 1 ? "transaction" : "transactions"}: {formatCurrency(spent, currency)} out,{" "}
            {formatCurrency(received, currency)} in
            {statement.skipped > 0 ? `. Skipped ${statement.skipped} rows without a date or amount.` : "."}
          </p>

          {statement.ambiguous && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Dates like 03/04 could be either way. They read as</span>
              <Button size="sm" variant={statement.dayFirst ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setDayFirst(true)}>
                day first
              </Button>
              <Button size="sm" variant={!statement.dayFirst ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setDayFirst(false)}>
                month first
              </Button>
            </div>
          )}

          <ul className="divide-y rounded-lg border text-sm">
            {statement.rows.slice(0, 5).map((row, index) => (
              <li key={`${row.date}-${index}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">
                  <span className="text-xs tabular-nums text-muted-foreground">{row.date}</span> {row.description}
                </span>
                <span className={row.type === "income" ? "shrink-0 tabular-nums text-primary" : "shrink-0 tabular-nums"}>
                  {row.type === "income" ? "+" : "-"}
                  {formatCurrency(row.amount, currency, { maximumFractionDigits: 2 })}
                </span>
              </li>
            ))}
            {statement.rows.length > 5 && <li className="px-3 py-2 text-xs text-muted-foreground">and {statement.rows.length - 5} more</li>}
          </ul>

          <Button onClick={() => void runImport()} disabled={importing || statement.rows.length === 0} className="gap-2">
            {importing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Import {statement.rows.length} {statement.rows.length === 1 ? "transaction" : "transactions"}
          </Button>
        </div>
      )}
    </section>
  )
}
