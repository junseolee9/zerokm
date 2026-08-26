// Browser-side data access. Every call runs under the signed-in user's
// session; row-level security in supabase/schema.sql does the isolation.
import { createClient } from '@/lib/supabase/client'
import type { Space, Member, Entry, EntryMap } from '@/lib/types'

const SIGNED_URL_TTL = 60 * 60 // 1h; pages are not open longer than that

export async function getMySpace(): Promise<{ space: Space; members: Member[] } | null> {
  const supabase = createClient()
  // RLS already narrows both tables to my space, so plain selects do.
  const { data: members } = await supabase
    .from('members').select('*').order('slot')
  if (!members || members.length === 0) return null

  const { data: space } = await supabase
    .from('spaces').select('*').eq('id', members[0].space_id).single()
  if (!space) return null

  return { space: space as Space, members: members as Member[] }
}

export async function getEntries(spaceId: string): Promise<EntryMap> {
  const supabase = createClient()
  const { data } = await supabase
    .from('entries').select('*').eq('space_id', spaceId).order('date')

  const rows = (data ?? []) as Entry[]

  // Private bucket: photo_path is stored, viewable URLs are minted per load.
  const paths = rows.filter(r => r.photo_path).map(r => r.photo_path!)
  const signed = new Map<string, string>()
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from('photos').createSignedUrls(paths, SIGNED_URL_TTL)
    for (const u of urls ?? []) {
      if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl)
    }
  }

  const map: EntryMap = {}
  for (const row of rows) {
    map[row.date] ??= {}
    map[row.date][row.member_id] = {
      ...row,
      photo_url: row.photo_path ? signed.get(row.photo_path) : undefined,
    }
  }
  return map
}

export async function upsertEntryText(spaceId: string, date: string, memberId: string, text: string) {
  const supabase = createClient()
  const { error } = await supabase.from('entries').upsert(
    { space_id: spaceId, date, member_id: memberId, text },
    { onConflict: 'space_id,date,member_id' }
  )
  if (error) throw error
}

export async function uploadPhoto(spaceId: string, date: string, memberId: string, blob: Blob): Promise<string> {
  const supabase = createClient()
  // Fixed extension-less path: upsert always overwrites the same object.
  const path = `${spaceId}/${date}/${memberId}`

  const { error: upErr } = await supabase.storage
    .from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (upErr) throw upErr

  const { error: dbErr } = await supabase.from('entries').upsert(
    { space_id: spaceId, date, member_id: memberId, photo_path: path },
    { onConflict: 'space_id,date,member_id' }
  )
  if (dbErr) throw dbErr

  const { data, error: signErr } = await supabase.storage
    .from('photos').createSignedUrl(path, SIGNED_URL_TTL)
  if (signErr || !data) throw signErr ?? new Error('sign failed')
  return data.signedUrl
}

export async function deletePhoto(spaceId: string, date: string, memberId: string, photoPath: string) {
  const supabase = createClient()
  await supabase.storage.from('photos').remove([photoPath])
  const { error } = await supabase.from('entries').upsert(
    { space_id: spaceId, date, member_id: memberId, photo_path: null },
    { onConflict: 'space_id,date,member_id' }
  )
  if (error) throw error
}

export async function updateMember(memberId: string, patch: Partial<Member>) {
  const supabase = createClient()
  const { error } = await supabase.from('members').update(patch).eq('id', memberId)
  if (error) throw error
}

export async function updateSpace(spaceId: string, patch: Partial<Pick<Space, 'title' | 'anniversary'>>) {
  const supabase = createClient()
  const { error } = await supabase.from('spaces').update(patch).eq('id', spaceId)
  if (error) throw error
}
