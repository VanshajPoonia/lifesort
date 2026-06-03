import { redirect } from "next/navigation"

export default function BudgetRedirectPage() {
  redirect("/money?tab=budget")
}
