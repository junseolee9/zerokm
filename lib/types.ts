export type Space = {
  id: string
  title: string
  anniversary: string | null
  invite_code: string
}

export type Member = {
  id: string
  space_id: string
  user_id: string | null
  slot: 1 | 2
  display_name: string
  color: string
  emoji: string
  timezone: string
  notify_email: string | null
}

export type Entry = {
  date: string       // yyyy-MM-dd
  member_id: string
  text: string
  photo_path: string | null
  photo_url?: string // signed URL, resolved client-side, never stored
}

// date -> member_id -> entry
export type EntryMap = Record<string, Record<string, Entry>>
