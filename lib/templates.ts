export type TemplateItem =
  | { type: "project"; title: string; description?: string; priority?: "low" | "medium" | "high" }
  | { type: "task"; title: string; priority?: "low" | "medium" | "high"; category?: string }
  | { type: "goal"; title: string; description?: string; priority?: "low" | "medium" | "high"; category?: string }
  | { type: "habit"; name: string; frequency?: "daily" | "weekly"; target_count?: number; description?: string }
  | { type: "note"; title: string; content?: string }
  | { type: "custom_section"; title: string; description?: string; icon?: string }
  | { type: "budget_category"; name: string; budget_limit?: number; icon?: string; color?: string }
  | { type: "vault_item"; title: string; category?: string; description?: string }

export type Template = {
  id: string
  name: string
  description: string
  icon: string
  color: string
  items: TemplateItem[]
  // Matches a Life Domain name (see components/onboarding-modal.tsx STARTER_DOMAINS) so
  // applying this template from a domain page can auto-tag created items with life_area_id.
  domainName?: string
}

export const ENDPOINT_MAP: Record<TemplateItem["type"], string> = {
  project: "/api/projects",
  task: "/api/tasks",
  goal: "/api/goals",
  habit: "/api/habits",
  note: "/api/notes",
  custom_section: "/api/custom-sections",
  budget_category: "/api/budget",
  vault_item: "/api/vault",
}

export function buildPayload(item: TemplateItem): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...item }
  delete payload.type
  if (item.type === "budget_category") {
    payload.type = "category"
  }
  return payload
}

export const TEMPLATES: Template[] = [
  {
    id: "student-semester",
    name: "Student Semester",
    description: "Stay on top of coursework, build consistent study habits, and finish the semester strong.",
    icon: "GraduationCap",
    color: "from-blue-500 to-indigo-600",
    items: [
      { type: "project", title: "Semester Plan", description: "Track all semester goals, deadlines, and progress", priority: "high" },
      { type: "goal", title: "Maintain strong GPA", category: "education", priority: "high" },
      { type: "goal", title: "Complete all assignments on time", category: "education", priority: "medium" },
      { type: "task", title: "Set up study schedule for the week", priority: "high", category: "Education" },
      { type: "task", title: "Buy required textbooks and materials", priority: "medium", category: "Education" },
      { type: "task", title: "Book office hours with professors", priority: "low", category: "Education" },
      { type: "habit", name: "Study 2 hours daily", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Review class notes after each session", frequency: "daily", target_count: 1 },
      { type: "note", title: "Course Notes", content: "Use this note to capture key concepts, formulas, and ideas from your courses." },
      { type: "note", title: "Assignment Tracker", content: "List all assignments with due dates:\n\n- [ ] Assignment 1 — Due:\n- [ ] Assignment 2 — Due:\n- [ ] Assignment 3 — Due:" },
    ],
  },
  {
    id: "fitness-transformation",
    name: "Fitness Transformation",
    description: "Build a sustainable fitness routine with clear goals, daily habits, and progress tracking.",
    icon: "Dumbbell",
    color: "from-orange-500 to-red-600",
    items: [
      { type: "project", title: "12-Week Fitness Plan", description: "Build consistency, strength, and lasting healthy habits", priority: "high" },
      { type: "goal", title: "Work out at least 4 times per week", category: "health", priority: "high" },
      { type: "goal", title: "Run 5K without stopping", category: "health", priority: "medium" },
      { type: "goal", title: "Track nutrition daily for 30 days", category: "health", priority: "medium" },
      { type: "task", title: "Join a gym or set up home workout space", priority: "high", category: "Health" },
      { type: "task", title: "Plan weekly meal prep", priority: "medium", category: "Health" },
      { type: "task", title: "Buy workout gear and equipment", priority: "low", category: "Health" },
      { type: "habit", name: "Morning workout", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Track daily calories", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Drink 8 glasses of water", frequency: "daily", target_count: 8 },
      { type: "note", title: "Workout Log", content: "Track your workouts here:\n\nDate | Exercise | Sets | Reps | Notes\n---\n" },
      { type: "note", title: "Meal Plan Template", content: "Weekly meal plan:\n\nMonday:\nTuesday:\nWednesday:\nThursday:\nFriday:\nSaturday:\nSunday:" },
    ],
  },
  {
    id: "job-search",
    name: "Job Search",
    description: "Run a focused job search campaign — from resume to offer — with daily habits and organized notes.",
    icon: "Briefcase",
    color: "from-emerald-500 to-teal-600",
    items: [
      { type: "project", title: "Job Search Campaign", description: "Organize applications, interviews, and networking efforts", priority: "high" },
      { type: "goal", title: "Apply to 5 roles per week", category: "work", priority: "high" },
      { type: "goal", title: "Land 2 interviews per month", category: "work", priority: "high" },
      { type: "task", title: "Update resume and tailor for target roles", priority: "high", category: "Work" },
      { type: "task", title: "Refresh LinkedIn profile and headline", priority: "high", category: "Work" },
      { type: "task", title: "Prepare answers to top 10 interview questions", priority: "medium", category: "Work" },
      { type: "task", title: "Research 5 target companies", priority: "medium", category: "Work" },
      { type: "habit", name: "Apply to at least 1 job daily", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Reach out to 1 person in my network", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Resume Bullets & Drafts", content: "Draft strong bullet points using the STAR method (Situation, Task, Action, Result):\n\n- " },
      { type: "note", title: "Interview Prep Notes", content: "Tell me about yourself:\n\nWhy do you want this role:\n\nStrengths:\n\nWeaknesses:\n\nQuestions to ask:" },
      { type: "note", title: "Company Research", content: "Track companies you're interested in:\n\nCompany | Role | Notes | Status\n---\n" },
    ],
  },
  {
    id: "business-launch",
    name: "Business Launch",
    description: "Go from idea to launch — build your MVP, acquire your first customers, and track expenses.",
    icon: "Rocket",
    color: "from-purple-500 to-violet-600",
    items: [
      { type: "project", title: "Business Launch Plan", description: "Turn an idea into a real business with clear milestones", priority: "high" },
      { type: "goal", title: "Launch MVP within 90 days", category: "work", priority: "high" },
      { type: "goal", title: "Acquire first 10 paying customers", category: "work", priority: "high" },
      { type: "task", title: "Register business name and legal structure", priority: "high", category: "Business" },
      { type: "task", title: "Build landing page and waitlist", priority: "high", category: "Business" },
      { type: "task", title: "Set up payment processing (Stripe or similar)", priority: "medium", category: "Business" },
      { type: "task", title: "Define ideal customer profile and value proposition", priority: "medium", category: "Business" },
      { type: "habit", name: "Work on the business for 2 hours", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Review key business metrics", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Business Plan", content: "Problem:\n\nSolution:\n\nTarget customers:\n\nRevenue model:\n\nKey metrics to track:" },
      { type: "note", title: "Feature Ideas & Backlog", content: "Backlog:\n- \n\nIn progress:\n- \n\nDone:\n- " },
      { type: "budget_category", name: "Business Expenses", budget_limit: 500, color: "#10B981" },
      { type: "vault_item", title: "Business Registration Documents", category: "documents", description: "Business registration, EIN, articles of incorporation" },
    ],
  },
  {
    id: "budget-reset",
    name: "Budget Reset",
    description: "Take control of your finances — build an emergency fund, eliminate debt, and track spending.",
    icon: "PiggyBank",
    color: "from-amber-500 to-orange-600",
    items: [
      { type: "goal", title: "Save 3-month emergency fund", category: "finance", priority: "high" },
      { type: "goal", title: "Pay off highest-interest debt first", category: "finance", priority: "high" },
      { type: "task", title: "Cancel all unused subscriptions", priority: "high", category: "Finance" },
      { type: "task", title: "Set up automatic savings transfer", priority: "high", category: "Finance" },
      { type: "task", title: "List all monthly income sources and expenses", priority: "medium", category: "Finance" },
      { type: "habit", name: "Track daily spending", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Review weekly budget progress", frequency: "weekly", target_count: 1 },
      { type: "budget_category", name: "Essentials", budget_limit: 1500, color: "#3B82F6" },
      { type: "budget_category", name: "Entertainment", budget_limit: 200, color: "#8B5CF6" },
      { type: "budget_category", name: "Savings", budget_limit: 500, color: "#10B981" },
      { type: "vault_item", title: "Financial Documents & Statements", category: "documents", description: "Bank statements, tax returns, financial records" },
    ],
  },
  {
    id: "travel-plan",
    name: "Travel Plan",
    description: "Plan a trip from start to finish — save for it, book it, and arrive prepared.",
    icon: "Plane",
    color: "from-sky-500 to-blue-600",
    items: [
      { type: "project", title: "Trip Planning", description: "Organize everything for an amazing trip", priority: "medium" },
      { type: "goal", title: "Save $2000 for the trip", category: "finance", priority: "high" },
      { type: "task", title: "Research destinations and travel dates", priority: "high", category: "Travel" },
      { type: "task", title: "Book flights and transportation", priority: "high", category: "Travel" },
      { type: "task", title: "Book accommodation", priority: "high", category: "Travel" },
      { type: "task", title: "Get travel insurance", priority: "medium", category: "Travel" },
      { type: "habit", name: "Set aside travel savings", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Packing List", content: "Essentials:\n- Passport / ID\n- Phone + charger\n- Adapter\n- Medications\n\nClothing:\n- \n\nToiletries:\n- " },
      { type: "note", title: "Itinerary Draft", content: "Day 1:\n\nDay 2:\n\nDay 3:\n\nDay 4:\n\nDay 5:" },
      { type: "note", title: "Tips & Recommendations", content: "Places to eat:\n- \n\nPlaces to visit:\n- \n\nThings to avoid:\n- " },
      { type: "budget_category", name: "Travel Fund", budget_limit: 2000, color: "#F59E0B" },
      { type: "vault_item", title: "Passport & Travel Documents", category: "documents", description: "Passport, visa, insurance policy, booking confirmations" },
    ],
  },
  {
    id: "learning-roadmap",
    name: "Learning Roadmap",
    description: "Build a structured learning system — pick a skill, commit daily, and track your progress.",
    icon: "BookOpen",
    color: "from-teal-500 to-cyan-600",
    items: [
      { type: "project", title: "Learning Journey", description: "Systematically develop a new skill or complete a course", priority: "medium" },
      { type: "goal", title: "Complete at least 1 course per month", category: "education", priority: "medium" },
      { type: "goal", title: "Build a portfolio project to showcase skills", category: "education", priority: "medium" },
      { type: "task", title: "Choose a learning platform and course", priority: "high", category: "Learning" },
      { type: "task", title: "Block a daily learning time slot", priority: "high", category: "Learning" },
      { type: "task", title: "Find an accountability partner or community", priority: "low", category: "Learning" },
      { type: "habit", name: "Practice or study for 30 minutes", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Write learning notes or reflections", frequency: "daily", target_count: 1 },
      { type: "note", title: "Learning Journal", content: "Date | What I learned | Key takeaway\n---\n" },
      { type: "note", title: "Key Concepts & Takeaways", content: "Capture the most important ideas:\n\n1. \n2. \n3. " },
      { type: "note", title: "Resources & Links", content: "Useful resources:\n\n- " },
      { type: "custom_section", title: "Course Tracker", description: "Track courses, progress, and completion status", icon: "BookOpen" },
    ],
  },
  {
    id: "content-creator",
    name: "Content Creator Planner",
    description: "Build a sustainable content system — plan, create, publish, and grow consistently.",
    icon: "Video",
    color: "from-pink-500 to-rose-600",
    items: [
      { type: "project", title: "Content Creation System", description: "Build a repeatable process for creating and publishing content", priority: "high" },
      { type: "goal", title: "Publish content at least 3 times per week", category: "work", priority: "high" },
      { type: "goal", title: "Grow audience to 1000 engaged followers", category: "work", priority: "medium" },
      { type: "task", title: "Set up a content calendar for the next month", priority: "high", category: "Content" },
      { type: "task", title: "Build a content idea bank with 20+ ideas", priority: "high", category: "Content" },
      { type: "task", title: "Batch-create the first month of content", priority: "medium", category: "Content" },
      { type: "habit", name: "Create or plan at least one piece of content", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Engage with audience comments and DMs", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Review content analytics and metrics", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Content Ideas & Concepts", content: "Dump all your content ideas here:\n\n- \n- \n- " },
      { type: "note", title: "Scripts & Drafts", content: "Draft your content scripts here before recording or writing." },
      { type: "note", title: "Analytics Log", content: "Date | Platform | Post | Views | Engagement | Notes\n---\n" },
      { type: "custom_section", title: "Content Calendar", description: "Plan and schedule your content pipeline", icon: "Calendar" },
    ],
  },
  {
    id: "home-management",
    name: "Home Management",
    description: "Build a home system that runs itself — cleaning routines, maintenance tracking, and organized documents.",
    icon: "Home",
    color: "from-slate-500 to-gray-600",
    items: [
      { type: "project", title: "Home System Setup", description: "Create routines and systems to keep your home organised", priority: "medium" },
      { type: "goal", title: "Declutter one room per month", category: "personal", priority: "medium" },
      { type: "task", title: "Create a weekly cleaning schedule", priority: "high", category: "Home" },
      { type: "task", title: "Set up a home maintenance calendar", priority: "medium", category: "Home" },
      { type: "task", title: "Organise and scan important documents", priority: "medium", category: "Home" },
      { type: "habit", name: "15-minute daily tidy", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Weekly deep clean", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Home Maintenance Log", content: "Log maintenance tasks and repairs:\n\nDate | Task | Cost | Notes\n---\n" },
      { type: "note", title: "Shopping Lists", content: "Groceries:\n- \n\nHousehold supplies:\n- \n\nUpcoming purchases:\n- " },
      { type: "budget_category", name: "Home Expenses", budget_limit: 800, color: "#64748B" },
      { type: "budget_category", name: "Maintenance Fund", budget_limit: 200, color: "#6B7280" },
      { type: "vault_item", title: "Home Insurance Policy", category: "insurance", description: "Home or renters insurance policy and emergency contacts" },
      { type: "vault_item", title: "Property & Lease Documents", category: "home", description: "Lease, mortgage, property tax, and utility account info" },
    ],
  },
  {
    id: "reading-list",
    name: "Reading List",
    description: "Build a reading habit, track your books, and capture insights that stick.",
    icon: "BookMarked",
    color: "from-indigo-500 to-purple-600",
    items: [
      { type: "goal", title: "Read 12 books this year", category: "personal", priority: "medium" },
      { type: "goal", title: "Read for at least 30 minutes every day", category: "personal", priority: "medium" },
      { type: "task", title: "Pick your next 3 books to read", priority: "high", category: "Reading" },
      { type: "task", title: "Join a book club or find a reading buddy", priority: "low", category: "Reading" },
      { type: "habit", name: "Read for 30 minutes", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Write notes on what I read", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Book Notes Template", content: "Book: \nAuthor: \nDate finished:\n\nKey ideas:\n1. \n2. \n3. \n\nFavourite quote:\n\nRating: /10\n\nWould I recommend it: " },
      { type: "note", title: "Reading List & Queue", content: "Currently reading:\n- \n\nUp next:\n- \n\nWant to read:\n- \n\nCompleted:\n- " },
      { type: "note", title: "Favourite Quotes", content: "Quotes that stuck with me:\n\n\"...\" — Author, Book\n\n\"...\" — Author, Book" },
      { type: "custom_section", title: "Reading Tracker", description: "Track books read, ratings, and notes", icon: "BookOpen" },
    ],
  },
  {
    id: "domain-physical-health",
    name: "Physical Health Starter",
    description: "A gentle starting system for movement, sleep, nutrition, and medical care.",
    icon: "Dumbbell",
    color: "from-orange-500 to-red-600",
    domainName: "Physical",
    items: [
      { type: "goal", title: "Move my body most days of the week", category: "health", priority: "medium" },
      { type: "goal", title: "Keep a consistent sleep schedule", category: "health", priority: "medium" },
      { type: "task", title: "Book any overdue check-ups or appointments", priority: "medium", category: "Health" },
      { type: "task", title: "Plan meals for the week", priority: "low", category: "Health" },
      { type: "habit", name: "Move for 20 minutes", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Lights out by a consistent time", frequency: "daily", target_count: 1 },
      { type: "note", title: "Health Notes", content: "Track symptoms, appointments, medications, and questions for your doctor here." },
    ],
  },
  {
    id: "domain-mental-health",
    name: "Mental Health Starter",
    description: "A light-touch system for checking in on stress, mood, and mindset.",
    icon: "HeartPulse",
    color: "from-rose-500 to-pink-600",
    domainName: "Mental",
    items: [
      { type: "goal", title: "Build a regular check-in habit", category: "personal", priority: "medium" },
      { type: "task", title: "Identify one thing that's been weighing on me", priority: "medium", category: "Personal" },
      { type: "habit", name: "Take 5 minutes to check in with myself", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Do one thing just for enjoyment", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Mood & Reflection Notes", content: "What's on my mind:\n\nWhat helped recently:\n\nWhat I want to try:" },
    ],
  },
  {
    id: "domain-financial",
    name: "Financial Starter",
    description: "A simple starting system for tracking money, saving, and staying on top of bills.",
    icon: "Wallet",
    color: "from-emerald-500 to-teal-600",
    domainName: "Financial",
    items: [
      { type: "goal", title: "Know exactly where my money goes each month", category: "finance", priority: "medium" },
      { type: "goal", title: "Build a small emergency buffer", category: "finance", priority: "medium" },
      { type: "task", title: "List all recurring bills and subscriptions", priority: "medium", category: "Finance" },
      { type: "habit", name: "Log any spending outside the plan", frequency: "daily", target_count: 1 },
      { type: "habit", name: "Review the budget", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Money Notes", content: "Recurring bills:\n\nUpcoming expenses:\n\nQuestions to look into:" },
    ],
  },
  {
    id: "domain-career",
    name: "Career Starter",
    description: "A starting system for work, professional growth, and current projects.",
    icon: "Briefcase",
    color: "from-blue-500 to-indigo-600",
    domainName: "Career",
    items: [
      { type: "goal", title: "Make progress on a skill that matters for my career", category: "work", priority: "medium" },
      { type: "project", title: "Current Focus Project", description: "Track the work project or initiative that matters most right now", priority: "medium" },
      { type: "task", title: "Note down what I want to accomplish this quarter", priority: "medium", category: "Work" },
      { type: "habit", name: "Spend focused time on career growth", frequency: "weekly", target_count: 1 },
      { type: "note", title: "Career Notes", content: "Current priorities:\n\nWins to remember:\n\nSkills to build:" },
    ],
  },
  {
    id: "domain-relationships",
    name: "Relationships Starter",
    description: "A starting system for staying connected to family, friends, and community.",
    icon: "Users",
    color: "from-fuchsia-500 to-purple-600",
    domainName: "Relationships",
    items: [
      { type: "goal", title: "Stay in regular touch with the people who matter", category: "personal", priority: "medium" },
      { type: "task", title: "Reach out to someone I haven't spoken to in a while", priority: "low", category: "Personal" },
      { type: "habit", name: "Reach out to one person", frequency: "weekly", target_count: 1 },
      { type: "note", title: "People Notes", content: "People to check in with:\n\nUpcoming birthdays or events:\n\nThings to remember:" },
    ],
  },
]
