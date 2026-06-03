import { redirect } from "next/navigation"

export default function InvestmentsRedirectPage() {
  redirect("/money?tab=investments")
}
