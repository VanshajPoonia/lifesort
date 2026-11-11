import { redirect } from "next/navigation"

// Spaces were removed in Stage 1 step 5 (2026-11-11). Life domains are the one way to group things.
export default function SpacesRedirectPage() {
  redirect("/domains")
}
