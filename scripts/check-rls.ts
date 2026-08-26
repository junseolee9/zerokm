// RLS isolation check. Row-level security is this app's only security
// boundary, so this script is the one test that matters: two real users, two
// real spaces, and a pile of assertions that neither can touch the other.
//
// Setup (once, in the Supabase dashboard):
//   Authentication > Users > create RLS_TEST_EMAIL_A and RLS_TEST_EMAIL_B
//   with password RLS_TEST_PASSWORD (auto-confirm on).
//
// Run: npm run check:rls
// Note: test users accumulate one space per run is prevented by the
// "already in a space" guard — the script reuses existing spaces on re-runs.

import assert from 'node:assert'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

// minimal .env.local loader — not worth a dependency
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PW   = process.env.RLS_TEST_PASSWORD!

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

async function ensureSpace(c: SupabaseClient, title: string): Promise<string> {
  const { data: members } = await c.from('members').select('space_id')
  if (members && members.length > 0) return members[0].space_id as string
  const { data, error } = await c.rpc('create_space', {
    p_title: title, p_anniversary: null, p_display_name: title, p_timezone: 'UTC',
    p_partner_email: null,
  })
  if (error) throw error
  return data as string
}

async function main() {
  assert(URL && ANON && PW && process.env.RLS_TEST_EMAIL_A && process.env.RLS_TEST_EMAIL_B,
    'missing env: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, RLS_TEST_EMAIL_A/B, RLS_TEST_PASSWORD')

  const a = await signIn(process.env.RLS_TEST_EMAIL_A!)
  const b = await signIn(process.env.RLS_TEST_EMAIL_B!)

  const spaceA = await ensureSpace(a, 'space-a')
  const spaceB = await ensureSpace(b, 'space-b')
  assert.notStrictEqual(spaceA, spaceB, 'A and B ended up in the same space')

  // Seed one entry each
  const { data: aMembers } = await a.from('members').select('*').order('slot')
  const { error: seedErr } = await a.from('entries').upsert(
    { space_id: spaceA, date: '2026-01-01', member_id: aMembers![0].id, text: 'secret-a' },
    { onConflict: 'space_id,date,member_id' })
  assert.ifError(seedErr)

  // --- cross-space reads come back empty ---------------------------------
  const { data: bSpaces } = await b.from('spaces').select('*').eq('id', spaceA)
  assert.strictEqual(bSpaces?.length, 0, 'B can read A space row')

  const { data: bMembers } = await b.from('members').select('*').eq('space_id', spaceA)
  assert.strictEqual(bMembers?.length, 0, 'B can read A members')

  const { data: bEntries } = await b.from('entries').select('*').eq('space_id', spaceA)
  assert.strictEqual(bEntries?.length, 0, 'B can read A entries')

  // --- cross-space writes fail -------------------------------------------
  const { error: insErr } = await b.from('entries').insert(
    { space_id: spaceA, date: '2026-01-02', member_id: aMembers![0].id, text: 'intrusion' })
  assert(insErr, 'B inserted an entry into A space')

  const { error: updErr, data: updData } = await b.from('spaces')
    .update({ title: 'hacked' }).eq('id', spaceA).select()
  assert(updErr || updData?.length === 0, 'B updated A space')

  // B cannot reserve A's placeholder seat for someone
  const { error: seatErr, data: seatData } = await b.from('members')
    .update({ invited_email: 'attacker@example.com' })
    .eq('space_id', spaceA).is('user_id', null).select()
  assert(seatErr || seatData?.length === 0, 'B rewrote A partner seat invitation')

  // --- storage isolation --------------------------------------------------
  const photoPath = `${spaceA}/2026-01-01/${aMembers![0].id}`
  const { error: upErr } = await a.storage.from('photos')
    .upload(photoPath, new Blob(['x']), { upsert: true })
  assert.ifError(upErr)

  const { data: bSigned } = await b.storage.from('photos').createSignedUrl(photoPath, 60)
  assert(!bSigned?.signedUrl, 'B signed a URL for A photo')

  const { data: aSigned, error: aSignErr } = await a.storage.from('photos').createSignedUrl(photoPath, 60)
  assert.ifError(aSignErr)
  assert(aSigned?.signedUrl, 'A cannot sign its own photo')

  // --- invitations --------------------------------------------------------
  // A reserves its seat for an email that is NOT B's; B's claim must find nothing.
  const { error: invErr } = await a.from('members')
    .update({ invited_email: 'someone-else@example.com' })
    .eq('space_id', spaceA).is('user_id', null)
  assert.ifError(invErr)

  const { data: bClaim } = await b.rpc('claim_invite')
  assert(!bClaim, 'claim_invite seated B without an invitation')

  console.log('RLS check passed ✔')
}

main().catch(e => { console.error(e); process.exit(1) })
