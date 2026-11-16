import { redirect } from "next/navigation"

// The focus timer is on Today. Start it from a focus item.
export default function PomodoroRedirectPage() {
  redirect("/")
}
