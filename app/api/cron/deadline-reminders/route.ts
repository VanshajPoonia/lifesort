import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { Resend } from "resend"

const sql = neon(process.env.DATABASE_URL!)
const resend = new Resend(process.env.RESEND_API_KEY)

interface ReminderItem {
  id: string
  title: string
  description?: string
  target_date: string
  email: string
  user_name: string
  reminder_days: number
  type: 'goal' | 'nuke' | 'task' | 'event'
}

// This endpoint is called daily by Vercel Cron
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In development, allow without secret
    if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    const allReminders: ReminderItem[] = []
    
    // Find goals with custom reminder_days
    const goals = await sql`
      SELECT g.id, g.title, g.description, g.target_date, g.reminder_days,
             u.email, u.name as user_name
      FROM goals g
      JOIN users u ON g.user_id = u.id
      WHERE g.status != 'completed'
      AND (g.reminder_sent IS NULL OR g.reminder_sent = false)
      AND (g.email_reminder IS NULL OR g.email_reminder = true)
      AND g.target_date IS NOT NULL
      AND u.email IS NOT NULL
      AND DATE(g.target_date) = CURRENT_DATE + INTERVAL '1 day' * COALESCE(g.reminder_days, 3)
    `
    
    for (const goal of goals) {
      allReminders.push({
        ...goal,
        reminder_days: goal.reminder_days || 3,
        type: 'goal'
      })
    }
    
    // Find nuke goals with reminders
    const nukeGoals = await sql`
      SELECT n.id, n.title, n.description, n.deadline as target_date, n.reminder_days,
             u.email, u.name as user_name
      FROM nuke_goals n
      JOIN users u ON n.user_id = u.id
      WHERE n.completed = false
      AND (n.reminder_sent IS NULL OR n.reminder_sent = false)
      AND (n.email_reminder IS NULL OR n.email_reminder = true)
      AND n.deadline IS NOT NULL
      AND u.email IS NOT NULL
      AND DATE(n.deadline) = CURRENT_DATE + INTERVAL '1 day' * COALESCE(n.reminder_days, 3)
    `
    
    for (const nuke of nukeGoals) {
      allReminders.push({
        ...nuke,
        reminder_days: nuke.reminder_days || 3,
        type: 'nuke'
      })
    }
    
    // Find tasks with due dates
    const tasks = await sql`
      SELECT t.id, t.title, t.description, t.due_date as target_date, t.reminder_days,
             u.email, u.name as user_name
      FROM tasks t
      JOIN users u ON t.user_id = u.id
      WHERE t.completed = false
      AND (t.reminder_sent IS NULL OR t.reminder_sent = false)
      AND (t.email_reminder IS NULL OR t.email_reminder = true)
      AND t.due_date IS NOT NULL
      AND u.email IS NOT NULL
      AND DATE(t.due_date) = CURRENT_DATE + INTERVAL '1 day' * COALESCE(t.reminder_days, 1)
    `
    
    for (const task of tasks) {
      allReminders.push({
        ...task,
        reminder_days: task.reminder_days || 1,
        type: 'task'
      })
    }

    const emailsSent = []
    const errors = []

    for (const item of allReminders) {
      try {
        const typeLabels = {
          goal: 'Goal',
          nuke: 'Nuke Goal',
          task: 'Task',
          event: 'Event'
        }
        
        const typeColors = {
          goal: '#7c3aed',
          nuke: '#ef4444',
          task: '#3b82f6',
          event: '#10b981'
        }
        
        const daysText = item.reminder_days === 1 ? '1 day' : `${item.reminder_days} days`
        
        // Send reminder email
        await resend.emails.send({
          from: "LifeSort <reminders@resend.dev>",
          to: item.email,
          subject: `Reminder: "${item.title}" deadline in ${daysText}!`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 40px 20px; }
                  .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                  .header { text-align: center; margin-bottom: 24px; }
                  .logo { font-size: 28px; font-weight: bold; color: #7c3aed; }
                  .title { font-size: 20px; font-weight: 600; color: #1f2937; margin: 16px 0 8px; }
                  .subtitle { color: #6b7280; font-size: 14px; }
                  .type-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; margin-bottom: 16px; }
                  .goal-card { background: linear-gradient(135deg, ${typeColors[item.type]} 0%, ${typeColors[item.type]}99 100%); border-radius: 12px; padding: 20px; margin: 24px 0; color: white; }
                  .goal-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
                  .goal-deadline { font-size: 14px; opacity: 0.9; }
                  .cta { display: block; text-align: center; background: ${typeColors[item.type]}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 24px; }
                  .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #9ca3af; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <div class="logo">LifeSort</div>
                    <div class="type-badge" style="background: ${typeColors[item.type]}">${typeLabels[item.type]}</div>
                    <div class="title">Deadline Reminder</div>
                    <div class="subtitle">Hi ${item.user_name || 'there'}! Your ${typeLabels[item.type].toLowerCase()} deadline is approaching.</div>
                  </div>
                  
                  <div class="goal-card">
                    <div class="goal-title">${item.title}</div>
                    <div class="goal-deadline">Due: ${new Date(item.target_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                  
                  <p style="color: #4b5563; line-height: 1.6;">
                    ${item.description ? `<strong>Description:</strong> ${item.description}<br><br>` : ''}
                    You have <strong>${daysText}</strong> left to complete this ${typeLabels[item.type].toLowerCase()}. Stay focused and keep pushing forward!
                  </p>
                  
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}/${item.type === 'nuke' ? 'nuke' : item.type + 's'}" class="cta">
                    View Your ${typeLabels[item.type]}s
                  </a>
                  
                  <div class="footer">
                    You're receiving this because you enabled email reminders in LifeSort.<br>
                    You can manage your reminder preferences in the app.
                  </div>
                </div>
              </body>
            </html>
          `,
        })

        // Mark reminder as sent based on type
        if (item.type === 'goal') {
          await sql`UPDATE goals SET reminder_sent = true WHERE id = ${item.id}`
        } else if (item.type === 'nuke') {
          await sql`UPDATE nuke_goals SET reminder_sent = true WHERE id = ${item.id}`
        } else if (item.type === 'task') {
          await sql`UPDATE tasks SET reminder_sent = true WHERE id = ${item.id}`
        }

        emailsSent.push({ id: item.id, type: item.type, email: item.email, title: item.title })
      } catch (emailError) {
        console.error(`[v0] Failed to send email for ${item.type} ${item.id}:`, emailError)
        errors.push({ id: item.id, type: item.type, error: String(emailError) })
      }
    }

    return NextResponse.json({
      success: true,
      date: todayStr,
      itemsFound: allReminders.length,
      emailsSent: emailsSent.length,
      breakdown: {
        goals: allReminders.filter(r => r.type === 'goal').length,
        nukeGoals: allReminders.filter(r => r.type === 'nuke').length,
        tasks: allReminders.filter(r => r.type === 'task').length,
      },
      details: emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("[v0] Cron job error:", error)
    return NextResponse.json({ error: "Failed to process reminders" }, { status: 500 })
  }
}
