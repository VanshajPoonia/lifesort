import { redirect } from "next/navigation"

export default function LifeAdminCompatibilityPage() {
  redirect("/workspace?tab=systems")
}
