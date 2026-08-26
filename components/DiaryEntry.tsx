'use client'

import { useState, useEffect } from 'react'
import { upsertEntryText, uploadPhoto, deletePhoto } from '@/lib/queries'
import type { Member } from '@/lib/types'

interface Props {
  spaceId: string
  date: string
  member: Member
  text: string
  photoUrl: string | null
  onTextChanged: (text: string) => void
  onPhotoChanged: (url: string | null) => void
}

// Phone photos are 3~10MB. Downscaling in the browser keeps uploads fast and
// storage small; Supabase would accept the full file, we just don't need it.
async function shrink(file: File): Promise<Blob> {
  if (file.size < 1_000_000) return file
  try {
    const bmp    = await createImageBitmap(file)
    const scale  = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(bmp.width  * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85))
    bmp.close()
    return blob ?? file
  } catch {
    return file
  }
}

export function DiaryEntry({ spaceId, date, member, text, photoUrl, onTextChanged, onPhotoChanged }: Props) {
  const [editing,      setEditing]      = useState(false)
  const [draft,        setDraft]        = useState(text)
  const [saving,       setSaving]       = useState(false)
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(photoUrl)
  const [uploading,    setUploading]    = useState(false)
  const [uploadErr,    setUploadErr]    = useState('')

  useEffect(() => { setCurrentPhoto(photoUrl) }, [photoUrl])

  async function handleSave() {
    setSaving(true)
    try {
      await upsertEntryText(spaceId, date, member.id, draft)
      onTextChanged(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await upsertEntryText(spaceId, date, member.id, '')
    setDraft('')
    onTextChanged('')
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadErr('')
    try {
      const blob = await shrink(file)
      const url = await uploadPhoto(spaceId, date, member.id, blob)
      setCurrentPhoto(url)
      onPhotoChanged(url)
      // Best-effort partner notification; a failure never blocks the upload.
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, memberId: member.id }),
      }).catch(() => {})
    } catch (err: any) {
      setUploadErr(String(err?.message ?? err))
    } finally {
      setUploading(false)
    }
  }

  async function handlePhotoDelete() {
    const path = `${spaceId}/${date}/${member.id}`
    await deletePhoto(spaceId, date, member.id, path)
    setCurrentPhoto(null)
    onPhotoChanged(null)
  }

  return (
    <div style={{ '--pc': member.color } as React.CSSProperties}>
      <div className="diary-person-header">{member.display_name}&apos;s Day</div>

      {/* Photo block */}
      <div className="diary-photo-block">
        {currentPhoto ? (
          <>
            <img src={currentPhoto} alt="diary photo" className="diary-photo-img" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              <label className="btn-bauhaus" style={{ textAlign: 'center', cursor: 'pointer', padding: '6px 0' }}>
                {uploading ? '...' : 'Replace'}
                <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
              </label>
              <button className="btn-bauhaus" onClick={handlePhotoDelete}>Remove</button>
            </div>
          </>
        ) : (
          <label className="btn-bauhaus diary-photo-upload-btn">
            {uploading ? 'Uploading...' : '+ Photo'}
            <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
          </label>
        )}
        {uploadErr && (
          <div style={{ color: '#c0392b', fontSize: 12, marginTop: 6 }}>{uploadErr}</div>
        )}
      </div>

      {text && !editing ? (
        <>
          <div className="diary-entry-card">{text}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button className="btn-bauhaus" onClick={() => { setDraft(text); setEditing(true) }}>Edit</button>
            <button className="btn-bauhaus" onClick={handleDelete}>Delete</button>
          </div>
        </>
      ) : editing ? (
        <>
          <textarea
            className="textarea-bauhaus"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button className="btn-bauhaus-primary" onClick={handleSave} disabled={saving}>
              Save ♥
            </button>
            <button className="btn-bauhaus" onClick={() => { setEditing(false); setDraft(text) }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <textarea
            className="textarea-bauhaus"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={`Write about ${member.display_name}'s day...`}
          />
          <button
            className="btn-bauhaus-primary"
            style={{ marginTop: 8 }}
            onClick={handleSave}
            disabled={saving || !draft.trim()}
          >
            Save ♥
          </button>
        </>
      )}
    </div>
  )
}
