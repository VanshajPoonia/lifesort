import { redirect } from "next/navigation"

// Custom Sections were removed in Stage 1 step 5 (2026-11-11). A note with a simple list covers the same need.
export default function CustomSectionsRedirectPage() {
  redirect("/library")
}
