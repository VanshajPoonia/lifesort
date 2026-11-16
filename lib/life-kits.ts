import { addDaysToDate, daysBetweenDates } from "@/lib/date-math"

// Life Kits (AI_BUILD_PLAN.md Part 0, Stage 3): one life situation that sets up real
// tasks, a goal, habits and budget lines from one key date. Started kits are stored in
// life_kits; this file holds the definitions and the date maths, with no database access.

type Priority = "low" | "medium" | "high"

// A "start" kit runs from its key date for lengthDays (a semester, a new job).
// A "deadline" kit counts down to its key date (moving day, a trip).
type KitKind = "start" | "deadline"

type KitTask = {
  title: string
  // Days from the key date, or from the day the kit starts when from is "start".
  day: number
  from?: "start"
  priority?: Priority
}

// custom habits run on the listed days, 0 = Sunday (same as the Habits tab).
type KitHabit = { name: string; frequency: "daily" | "weekly" | "custom"; days?: number[] }

export type KitDefinition = {
  key: string
  name: string
  summary: string
  icon: "GraduationCap" | "Briefcase" | "House" | "Dumbbell" | "Wallet" | "Search" | "Plane" | "FileText" | "Sparkles"
  domainName: string
  kind: KitKind
  dateLabel: string
  defaultDateOffset: number
  // Days the kit runs after its key date. Start kits show "Week n of m" from this.
  lengthDays: number
  // Optional short text asked at setup, used in titles ("Trip to {label}").
  labelPrompt?: { question: string; placeholder: string; fallback: string }
  amountPrompt?: string
  title: (label: string) => string
  phases: { name: string; from: number; to: number }[]
  goal: (label: string, amount: number | null) => { title: string; day: number }
  tasks: (label: string) => KitTask[]
  habits: KitHabit[]
  budgetCategory?: (label: string) => { name: string; icon: string; color: string }
  vaultItem?: (label: string) => { title: string; category: string; reminderDay: number }
  prompts: string[]
}

export const LIFE_KITS: KitDefinition[] = [
  {
    key: "new-semester",
    name: "New semester",
    summary: "Classes, study time, midterms and finals, one week at a time.",
    icon: "GraduationCap",
    domainName: "School",
    kind: "start",
    dateLabel: "When do classes start?",
    defaultDateOffset: 0,
    lengthDays: 105,
    title: () => "New semester",
    phases: [
      { name: "Settling in", from: 0, to: 13 },
      { name: "Steady weeks", from: 14, to: 48 },
      { name: "Midterms", from: 49, to: 62 },
      { name: "Steady weeks", from: 63, to: 90 },
      { name: "Finals", from: 91, to: 105 },
    ],
    goal: () => ({ title: "Finish the semester strong", day: 105 }),
    tasks: () => [
      { title: "Get your class schedule and room numbers", day: -3 },
      { title: "Buy or borrow your textbooks", day: -2 },
      { title: "Add every exam and deadline to LifeSort", day: 0, priority: "high" },
      { title: "Pick your weekly study times", day: 1 },
      { title: "Review your first week of notes", day: 6 },
      { title: "Find a study group or partner", day: 13 },
      { title: "Make a midterm study plan", day: 42, priority: "high" },
      { title: "Check your grades so far", day: 63 },
      { title: "Make a finals study plan", day: 84, priority: "high" },
      { title: "Block time for final revision", day: 91 },
    ],
    habits: [
      { name: "Study session", frequency: "daily" },
      { name: "Review this week's notes", frequency: "weekly" },
    ],
    budgetCategory: () => ({ name: "Books and supplies", icon: "BookOpen", color: "#7C3AED" }),
    prompts: [
      "Which class needs more of your time this week?",
      "What clicked in class this week?",
      "What would make next week easier?",
    ],
  },
  {
    key: "new-job",
    name: "New job",
    summary: "Day one, the first month and your 30, 60 and 90 day check-ins.",
    icon: "Briefcase",
    domainName: "Work",
    kind: "start",
    dateLabel: "When do you start?",
    defaultDateOffset: 7,
    lengthDays: 90,
    title: () => "New job",
    phases: [
      { name: "Before day one", from: -14, to: -1 },
      { name: "First week", from: 0, to: 6 },
      { name: "First month", from: 7, to: 29 },
      { name: "Days 30 to 60", from: 30, to: 59 },
      { name: "Days 60 to 90", from: 60, to: 90 },
    ],
    goal: () => ({ title: "Settle into the new job by day 90", day: 90 }),
    tasks: () => [
      { title: "Plan your commute and what to wear on day one", day: -5 },
      { title: "Send the documents HR asked for", day: -3, priority: "high" },
      { title: "Pack your bag for day one", day: -1 },
      { title: "Note the names of people you meet", day: 0 },
      { title: "Ask your manager what a great first 90 days looks like", day: 2, priority: "high" },
      { title: "Write down what you learned this week", day: 6 },
      { title: "Set up a regular 1:1 with your manager", day: 14 },
      { title: "30-day check-in with your manager", day: 29 },
      { title: "60-day check-in: what's going well and what isn't", day: 59 },
      { title: "90-day review with your manager", day: 89, priority: "high" },
    ],
    habits: [{ name: "Write down one thing you learned", frequency: "daily" }],
    budgetCategory: () => ({ name: "Commute", icon: "Car", color: "#2563EB" }),
    prompts: [
      "Who helped you this week?",
      "What's still confusing about the job?",
      "What do you want to be known for here?",
    ],
  },
  {
    key: "moving-house",
    name: "Moving house",
    summary: "A countdown to moving day, from giving notice to unpacking.",
    icon: "House",
    domainName: "Home",
    kind: "deadline",
    dateLabel: "When is moving day?",
    defaultDateOffset: 30,
    lengthDays: 14,
    title: () => "Moving house",
    phases: [
      { name: "Planning", from: -3650, to: -29 },
      { name: "Packing", from: -28, to: -8 },
      { name: "Last week", from: -7, to: -1 },
      { name: "Moving day", from: 0, to: 0 },
      { name: "Settling in", from: 1, to: 14 },
    ],
    goal: () => ({ title: "Move in smoothly", day: 0 }),
    tasks: () => [
      { title: "Give notice to your landlord or agent", day: -45, priority: "high" },
      { title: "Get quotes from movers", day: -40 },
      { title: "Book movers or a van", day: -30, priority: "high" },
      { title: "Declutter one room at a time", day: -28 },
      { title: "Get boxes and packing tape", day: -21 },
      { title: "Change your address with your bank and employer", day: -14 },
      { title: "Set up internet at the new place", day: -10 },
      { title: "Pack everything you won't need this week", day: -7 },
      { title: "Pack an essentials box", day: -3 },
      { title: "Clean the old place", day: -1 },
      { title: "Take meter readings and photos", day: 0, priority: "high" },
      { title: "Unpack the kitchen and bedroom first", day: 1 },
      { title: "Update your address everywhere else", day: 7 },
    ],
    habits: [{ name: "Pack one box", frequency: "daily" }],
    budgetCategory: () => ({ name: "Moving costs", icon: "Truck", color: "#CA8A04" }),
    prompts: [
      "What are you looking forward to in the new place?",
      "What can you let go of instead of packing?",
    ],
  },
  {
    key: "getting-fit",
    name: "Getting fit",
    summary: "Twelve weeks of steady workouts with check-ins along the way.",
    icon: "Dumbbell",
    domainName: "Fitness",
    kind: "start",
    dateLabel: "When do you want to start?",
    defaultDateOffset: 0,
    lengthDays: 84,
    title: () => "Getting fit",
    phases: [
      { name: "Easy start", from: 0, to: 13 },
      { name: "Building up", from: 14, to: 41 },
      { name: "Getting stronger", from: 42, to: 84 },
    ],
    goal: () => ({ title: "Work out 3 times a week for 12 weeks", day: 84 }),
    tasks: () => [
      { title: "Pick your three workout days", day: 0 },
      { title: "Note where you're starting: a photo, your weight or a time", day: 0 },
      { title: "Plan this week's workouts", day: 1 },
      { title: "Two-week check-in: how does it feel?", day: 13 },
      { title: "Make each workout a little harder", day: 27 },
      { title: "Six-week check-in: compare with your start", day: 41 },
      { title: "Twelve-week check-in: compare with your start", day: 83, priority: "high" },
    ],
    habits: [
      { name: "Workout", frequency: "custom", days: [1, 3, 5] },
      { name: "Stretch for 5 minutes", frequency: "daily" },
    ],
    prompts: [
      "How did your body feel this week?",
      "What made it easier to show up?",
    ],
  },
  {
    key: "saving-for-something",
    name: "Saving for something",
    summary: "A savings goal with a monthly transfer and check-ins.",
    icon: "Wallet",
    domainName: "Finance",
    kind: "deadline",
    dateLabel: "When do you want it by?",
    defaultDateOffset: 180,
    lengthDays: 0,
    labelPrompt: { question: "What are you saving for?", placeholder: "A new laptop", fallback: "something" },
    amountPrompt: "How much do you need?",
    title: (label) => `Saving for ${label}`,
    phases: [
      { name: "Saving", from: -3650, to: -31 },
      { name: "Last month", from: -30, to: -1 },
      { name: "Goal date", from: 0, to: 0 },
    ],
    goal: (label, amount) => ({
      title: amount ? `Save ${amount.toLocaleString("en-US")} for ${label}` : `Save for ${label}`,
      day: 0,
    }),
    tasks: () => [
      { title: "Decide how much to put away each month", day: 0, from: "start", priority: "high" },
      { title: "Set up an automatic transfer on payday", day: 1, from: "start", priority: "high" },
      { title: "Check how much you've saved", day: 30, from: "start" },
      { title: "One month to go: top up if you're short", day: -30 },
      { title: "Buy it, or move the money where it's needed", day: 0 },
    ],
    habits: [],
    budgetCategory: (label) => ({ name: `Savings: ${label}`.slice(0, 100), icon: "PiggyBank", color: "#059669" }),
    prompts: [
      "What did you skip buying this week, and was it worth it?",
      "How will it feel when you reach this?",
    ],
  },
  {
    key: "job-search",
    name: "Job search",
    summary: "Resume, applications, interviews and follow-ups, week by week.",
    icon: "Search",
    domainName: "Work",
    kind: "start",
    dateLabel: "When do you want to start looking?",
    defaultDateOffset: 0,
    lengthDays: 60,
    title: () => "Job search",
    phases: [
      { name: "Getting ready", from: 0, to: 6 },
      { name: "Applying", from: 7, to: 41 },
      { name: "Interviews", from: 42, to: 60 },
    ],
    goal: () => ({ title: "Land a new job", day: 60 }),
    tasks: () => [
      { title: "Update your resume", day: 0, priority: "high" },
      { title: "Update your LinkedIn profile", day: 1 },
      { title: "List 20 places you'd like to work", day: 2 },
      { title: "Ask two people for a referral", day: 3 },
      { title: "Practise answers to common interview questions", day: 7 },
      { title: "Review which applications got replies", day: 14 },
      { title: "Follow up on applications older than two weeks", day: 28 },
      { title: "Change what isn't working in your search", day: 42 },
    ],
    habits: [{ name: "Apply to one job", frequency: "custom", days: [1, 2, 3, 4, 5] }],
    prompts: [
      "What kind of work gave you energy this week?",
      "Which application are you proudest of?",
    ],
  },
  {
    key: "trip",
    name: "Trip",
    summary: "Bookings, documents and packing, counted down to the day you leave.",
    icon: "Plane",
    domainName: "Travel",
    kind: "deadline",
    dateLabel: "When do you leave?",
    defaultDateOffset: 30,
    lengthDays: 7,
    labelPrompt: { question: "Where are you going?", placeholder: "Goa", fallback: "your trip" },
    title: (label) => (label === "your trip" ? "Trip" : `Trip to ${label}`),
    phases: [
      { name: "Planning", from: -3650, to: -15 },
      { name: "Getting ready", from: -14, to: -1 },
      { name: "Travelling", from: 0, to: 7 },
    ],
    goal: (label) => ({ title: label === "your trip" ? "Get ready for the trip" : `Get ready for ${label}`, day: 0 }),
    tasks: () => [
      { title: "Check your passport and visa", day: -45, priority: "high" },
      { title: "Book flights or tickets", day: -40, priority: "high" },
      { title: "Book where you'll stay", day: -35 },
      { title: "Get travel insurance", day: -21 },
      { title: "Plan what you want to do there", day: -14 },
      { title: "Tell your bank you're travelling", day: -7 },
      { title: "Pack", day: -3 },
      { title: "Check in online", day: -2 },
      { title: "Charge your devices and save your tickets offline", day: -1 },
      { title: "Sort your photos and trip expenses", day: 7 },
    ],
    habits: [],
    budgetCategory: (label) => ({ name: label === "your trip" ? "Trip" : `Trip: ${label}`.slice(0, 100), icon: "Plane", color: "#0284C7" }),
    prompts: ["What do you most want to remember from this trip?"],
  },
  {
    key: "renewing-documents",
    name: "Renewing documents",
    summary: "Renew a passport, licence or ID before it runs out.",
    icon: "FileText",
    domainName: "Personal",
    kind: "deadline",
    dateLabel: "When does it expire?",
    defaultDateOffset: 60,
    lengthDays: 0,
    labelPrompt: { question: "Which document?", placeholder: "Passport", fallback: "document" },
    title: (label) => `Renew ${label}`,
    phases: [
      { name: "Getting ready", from: -3650, to: -29 },
      { name: "Renewing", from: -28, to: -1 },
      { name: "Expiry day", from: 0, to: 0 },
    ],
    goal: (label) => ({ title: `Renew ${label} before it expires`, day: 0 }),
    tasks: (label) => [
      { title: `Check what the ${label} renewal needs: forms, photos and fees`, day: -60, priority: "high" },
      { title: "Get new photos taken", day: -50 },
      { title: "Fill in the renewal form", day: -45, priority: "high" },
      { title: "Book an appointment or submit online", day: -40, priority: "high" },
      { title: "Check on the renewal", day: -14 },
      { title: `Make sure the new ${label} has arrived`, day: -1 },
    ],
    habits: [],
    vaultItem: (label) => ({ title: label.charAt(0).toUpperCase() + label.slice(1), category: "documents", reminderDay: -60 }),
    prompts: [],
  },
]

export function getKitDefinition(key: string) {
  return LIFE_KITS.find((kit) => kit.key === key) ?? null
}

// A kit the AI drafted from "Describe your situation". Plain data, so it can be shown,
// edited by unticking, and saved in life_kits.details. Validated by kitDraftSchema.
export type KitDraft = {
  name: string
  summary: string
  kind: KitKind
  date_label: string
  date_offset_days: number
  length_days: number
  domain_name: string
  phases: { name: string; from: number; to: number }[]
  goal: { title: string; day: number }
  tasks: { title: string; day: number; from_start: boolean; priority: Priority }[]
  habits: { name: string; frequency: "daily" | "weekly" | "custom"; days: number[] }[]
  budget_category: string | null
  prompts: string[]
}

export const CUSTOM_KIT_KEY = "custom"

export function definitionFromDraft(draft: KitDraft): KitDefinition {
  return {
    key: CUSTOM_KIT_KEY,
    name: draft.name,
    summary: draft.summary,
    icon: "Sparkles",
    domainName: draft.domain_name,
    kind: draft.kind,
    dateLabel: draft.date_label,
    defaultDateOffset: draft.date_offset_days,
    lengthDays: draft.length_days,
    title: () => draft.name,
    phases: draft.phases,
    goal: () => draft.goal,
    tasks: () => draft.tasks.map((task) => ({ title: task.title, day: task.day, from: task.from_start ? "start" : undefined, priority: task.priority })),
    habits: draft.habits.map((habit) => ({ name: habit.name, frequency: habit.frequency, days: habit.days })),
    budgetCategory: draft.budget_category
      ? () => ({ name: draft.budget_category as string, icon: "Wallet", color: "#0F766E" })
      : undefined,
    prompts: draft.prompts,
  }
}

export type KitInputs = { label: string | null; amount: number | null }

export type PlannedKitItem =
  | { key: string; type: "goal"; title: string; targetDate: string; targetValue: number | null }
  | { key: string; type: "task"; title: string; priority: Priority; date: string }
  | { key: string; type: "habit"; name: string; frequency: "daily" | "weekly" | "custom"; customDays: number[] }
  | { key: string; type: "budget_category"; name: string; icon: string; color: string }
  | { key: string; type: "vault_item"; title: string; category: string; expiryDate: string; reminderDate: string }

export type KitPlan = {
  title: string
  items: PlannedKitItem[]
  // Start kits drop steps whose date already passed (the semester began weeks ago).
  skippedPast: number
}

function kitLabel(definition: KitDefinition, inputs: KitInputs) {
  const label = inputs.label?.trim().slice(0, 60)
  return label || definition.labelPrompt?.fallback || ""
}

// Turns a kit and its key date into dated items. Nothing lands before today: start kits
// skip steps that already passed, and deadline kits spread late prep steps from today on,
// one a day, so a close moving day still gets every step without a pile on one day.
export function planKit(definition: KitDefinition, anchorDate: string, today: string, inputs: KitInputs): KitPlan {
  const label = kitLabel(definition, inputs)
  const items: PlannedKitItem[] = []

  const goal = definition.goal(label, inputs.amount)
  items.push({
    key: "goal",
    type: "goal",
    title: goal.title,
    targetDate: addDaysToDate(anchorDate, goal.day),
    targetValue: inputs.amount,
  })

  const tasks = definition.tasks(label).map((task, index) => ({
    key: `task-${index}`,
    title: task.title,
    priority: task.priority ?? "medium",
    date: addDaysToDate(task.from === "start" ? today : anchorDate, task.day),
  }))

  let skippedPast = 0
  const late = tasks.filter((task) => task.date < today).sort((a, b) => a.date.localeCompare(b.date))
  const lastSpreadDay = Math.max(0, daysBetweenDates(today, anchorDate) - 1)
  for (const task of tasks) {
    if (task.date >= today) {
      items.push({ ...task, type: "task" })
    } else if (definition.kind === "start") {
      skippedPast += 1
    } else {
      const spread = Math.min(late.indexOf(task), lastSpreadDay)
      items.push({ ...task, type: "task", date: addDaysToDate(today, spread) })
    }
  }

  definition.habits.forEach((habit, index) => {
    items.push({ key: `habit-${index}`, type: "habit", name: habit.name, frequency: habit.frequency, customDays: habit.days ?? [] })
  })

  if (definition.budgetCategory) {
    items.push({ key: "budget", type: "budget_category", ...definition.budgetCategory(label) })
  }

  if (definition.vaultItem) {
    const vault = definition.vaultItem(label)
    const reminder = addDaysToDate(anchorDate, vault.reminderDay)
    items.push({
      key: "vault",
      type: "vault_item",
      title: vault.title,
      category: vault.category,
      expiryDate: anchorDate,
      reminderDate: reminder < today ? today : reminder,
    })
  }

  return { title: definition.title(label), items, skippedPast }
}

export type KitProgress = {
  line: string
  phase: string | null
  percent: number
  ended: boolean
  prompt: string | null
}

// "Week 3 of 15" for start kits, "18 days to go" for deadline kits.
export function kitProgress(definition: KitDefinition, anchorDate: string, startDate: string, today: string): KitProgress {
  const day = daysBetweenDates(anchorDate, today)
  const phase = definition.phases.find((item) => day >= item.from && day <= item.to)?.name ?? null
  const week = Math.max(0, Math.floor(daysBetweenDates(startDate, today) / 7))
  const prompt = definition.prompts.length ? definition.prompts[week % definition.prompts.length] : null

  if (definition.kind === "start") {
    const totalWeeks = Math.max(1, Math.ceil(definition.lengthDays / 7))
    if (day < 0) {
      return { line: day === -1 ? "Starts tomorrow" : `Starts in ${-day} days`, phase, percent: 0, ended: false, prompt }
    }
    const current = Math.min(totalWeeks, Math.floor(day / 7) + 1)
    return {
      line: `Week ${current} of ${totalWeeks}`,
      phase,
      percent: Math.min(100, Math.round((day / Math.max(1, definition.lengthDays)) * 100)),
      ended: day > definition.lengthDays,
      prompt,
    }
  }

  const total = Math.max(1, daysBetweenDates(startDate, anchorDate))
  const elapsed = daysBetweenDates(startDate, today)
  const percent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
  const ended = day > definition.lengthDays
  if (day < -1) return { line: `${-day} days to go`, phase, percent, ended, prompt }
  if (day === -1) return { line: "Tomorrow", phase, percent, ended, prompt }
  if (day === 0) return { line: "Today", phase, percent: 100, ended, prompt }
  return { line: day === 1 ? "Yesterday" : `${day} days ago`, phase, percent: 100, ended, prompt }
}
