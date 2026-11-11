import { redirect } from "next/navigation"

// Universal Capture folded into Inbox in Stage 1 step 4 (2026-11-11).
export default function CaptureRedirectPage() {
  redirect("/inbox")
}
