import { redirect } from "next/navigation"

export default function PlanCompatibilityPage() {
  redirect("/workspace?tab=plan")
}
