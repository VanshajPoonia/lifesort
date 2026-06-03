import { redirect } from "next/navigation"

export default function IncomeRedirectPage() {
  redirect("/money?tab=income")
}
