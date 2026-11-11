import { redirect } from "next/navigation"

// Weekly Review is the main tab of Reflect since Stage 1 step 7 (2026-11-11).
export default function ReviewRedirectPage() {
  redirect("/reflect")
}
