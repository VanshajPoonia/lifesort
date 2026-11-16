import { redirect } from "next/navigation"

// Focus Goal was retired on 2026-11-16. Goals covers the same need.
export default function NukeRedirectPage() {
  redirect("/goals")
}
