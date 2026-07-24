import { neon } from "@/lib/neon-client"

export const sql = neon(process.env.DATABASE_URL!)
