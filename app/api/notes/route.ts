import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []

  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
        .filter(Boolean)
    )
  )
}

function normalizeFolderId(folderId: unknown): number | null {
  if (folderId === null || folderId === undefined || folderId === '' || folderId === 'none') {
    return null
  }

  const parsed = Number(folderId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function assertFolderOwnership(folderId: number | null, userId: string) {
  if (!folderId) return true

  const folders = await sql`
    SELECT id FROM note_folders
    WHERE id = ${folderId} AND user_id = ${userId}
    LIMIT 1
  `

  return folders.length > 0
}

async function getNoteWithFolder(noteId: string | number, userId: string) {
  const notes = await sql`
    SELECT
      notes.*,
      note_folders.name AS folder_name
    FROM notes
    LEFT JOIN note_folders
      ON notes.folder_id = note_folders.id
      AND note_folders.user_id = ${userId}
    WHERE notes.id = ${noteId} AND notes.user_id = ${userId}
    LIMIT 1
  `

  return notes[0]
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notes = await sql`
      SELECT
        notes.*,
        note_folders.name AS folder_name
      FROM notes
      LEFT JOIN note_folders
        ON notes.folder_id = note_folders.id
        AND note_folders.user_id = ${user.id}
      WHERE notes.user_id = ${user.id}
      ORDER BY notes.is_pinned DESC, notes.updated_at DESC
    `

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Get notes error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, content, folder_id, tags, is_pinned } = await request.json()
    const normalizedFolderId = normalizeFolderId(folder_id)
    const normalizedTags = normalizeTags(tags)
    const hasFolder = await assertFolderOwnership(normalizedFolderId, user.id)

    if (!hasFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO notes (user_id, title, content, folder_id, tags, is_pinned)
      VALUES (${user.id}, ${title || 'Untitled'}, ${content || ''}, ${normalizedFolderId}, ${normalizedTags}::text[], ${Boolean(is_pinned)})
      RETURNING *
    `

    const note = await getNoteWithFolder(result[0].id, user.id)

    return NextResponse.json(note)
  } catch (error) {
    console.error('Create note error:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, content } = body

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const existingNotes = await sql`
      SELECT * FROM notes
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (existingNotes.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const existing = existingNotes[0]
    const hasFolderUpdate = Object.prototype.hasOwnProperty.call(body, 'folder_id')
    const nextFolderId = hasFolderUpdate ? normalizeFolderId(body.folder_id) : existing.folder_id
    const hasFolder = await assertFolderOwnership(nextFolderId, user.id)

    if (!hasFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 400 })
    }

    const hasTagsUpdate = Object.prototype.hasOwnProperty.call(body, 'tags')
    const hasPinnedUpdate = Object.prototype.hasOwnProperty.call(body, 'is_pinned')
    const nextTags = hasTagsUpdate ? normalizeTags(body.tags) : normalizeTags(existing.tags)
    const nextPinned = hasPinnedUpdate ? Boolean(body.is_pinned) : Boolean(existing.is_pinned)

    const result = await sql`
      UPDATE notes 
      SET 
        title = ${typeof title === 'string' ? title : existing.title},
        content = ${typeof content === 'string' ? content : existing.content},
        folder_id = ${nextFolderId},
        tags = ${nextTags}::text[],
        is_pinned = ${nextPinned},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const note = await getNoteWithFolder(result[0].id, user.id)

    return NextResponse.json(note)
  } catch (error) {
    console.error('Update note error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM notes 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete note error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
