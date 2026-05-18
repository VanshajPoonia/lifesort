import { redirect } from "next/navigation"

export default function LifeAdminCompatibilityPage() {
  redirect("/organize?tab=admin")
}
