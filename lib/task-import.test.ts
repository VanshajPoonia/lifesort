import { describe, expect, it } from "vitest"

import { parseCsv, prepareImport, readTaskCsv, type TaskCsv } from "./task-import"

const ok = (value: ReturnType<typeof readTaskCsv>) => {
  if ("error" in value) throw new Error(value.error)
  return value as TaskCsv
}

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, commas and newlines inside quotes", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ])
  })

  it("drops a byte order mark and blank lines", () => {
    expect(parseCsv("﻿Title\n\nBuy milk\n")).toEqual([["Title"], ["Buy milk"]])
  })
})

describe("readTaskCsv: Todoist", () => {
  const csv = [
    "TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE",
    "section,Home,,,,,,,,",
    "task,Pay rent,,1,1,,,2026-12-01,en,Asia/Kolkata",
    "task,Water plants,Balcony too,4,1,,,every monday,en,Asia/Kolkata",
    "note,Some comment,,,,,,,,",
  ].join("\n")

  it("keeps tasks, maps priority 1 to high and reads ISO dates", () => {
    const result = ok(readTaskCsv(csv))
    expect(result.format).toBe("todoist")
    expect(result.skipped).toBe(2)
    expect(result.tasks[0]).toEqual({ title: "Pay rent", description: null, due_date: "2026-12-01", priority: "high", completed: false })
  })

  it("keeps a date it can't read in the notes", () => {
    const result = ok(readTaskCsv(csv))
    expect(result.tasks[1]).toMatchObject({ priority: "low", due_date: null, description: "Balcony too\nTodoist date: every monday" })
  })
})

describe("readTaskCsv: any CSV", () => {
  it("finds title, due, notes, priority and done columns by name", () => {
    const result = ok(readTaskCsv("Task,Due Date,Notes,Priority,Done\nCall mum,2026/11/20,Sunday,High,no\nOld thing,,,,yes\n,,,,\n"))
    expect(result.format).toBe("generic")
    expect(result.tasks).toEqual([
      { title: "Call mum", description: "Sunday", due_date: "2026-11-20", priority: "high", completed: false },
      { title: "Old thing", description: null, due_date: null, priority: "medium", completed: true },
    ])
  })

  it("explains a file without a title column", () => {
    expect(readTaskCsv("Foo,Bar\n1,2\n")).toEqual({ error: "Couldn't find a title column. Name one column Title or Task." })
  })

  it("rejects an impossible date instead of guessing", () => {
    const result = ok(readTaskCsv("Title,Due\nX,2026-02-31\n"))
    expect(result.tasks[0]).toMatchObject({ due_date: null, description: "Due: 2026-02-31" })
  })
})

describe("prepareImport", () => {
  const tasks = [
    { title: "Done", description: null, due_date: null, priority: "medium" as const, completed: true },
    { title: "Late", description: null, due_date: "2026-10-01", priority: "medium" as const, completed: false },
    { title: "Soon", description: null, due_date: "2026-12-01", priority: "medium" as const, completed: false },
  ]

  it("skips finished tasks and drops past due dates by choice", () => {
    expect(prepareImport(tasks, { skipCompleted: true, dropPastDates: true }, "2026-11-17").map((item) => [item.title, item.due_date])).toEqual([
      ["Late", null],
      ["Soon", "2026-12-01"],
    ])
    expect(prepareImport(tasks, { skipCompleted: false, dropPastDates: false }, "2026-11-17")).toHaveLength(3)
  })
})
