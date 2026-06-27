import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard } from '../components/ui/index'
import { toast } from 'react-toastify'

// Admin page to manage announcements shown on the public page (/announcements).
export default function Announcements() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', body: '', category: 'General' })
  const [adding, setAdding] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const imageInputRef = useRef(null)

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const clearImage = () => { setImageFile(null); setImagePreview(null) }

  const { data: items = [] } = useQuery({
    queryKey: ['announcements-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, category, is_active, created_at, image_url')
        .order('created_at', { ascending: false })
      return data || []
    },
  })

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      // Upload the image to Supabase Storage first (if one was attached)
      let image_url = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop().toLowerCase()
        const path = `${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('announcement-photos')
          .upload(path, imageFile, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage
          .from('announcement-photos')
          .getPublicUrl(path)
        image_url = publicUrl
      }
      const { error } = await supabase.from('announcements').insert({ ...payload, image_url })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Announcement posted!')
      qc.invalidateQueries(['announcements-admin'])
      qc.invalidateQueries(['public-announcements'])
      setForm({ title: '', body: '', category: 'General' })
      clearImage()
      setAdding(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('announcements').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['announcements-admin']),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Announcement deleted.')
      qc.invalidateQueries(['announcements-admin'])
    },
    onError: (e) => toast.error(e.message),
  })

  const publicUrl = `${window.location.origin}/announcements`
  const CAT = ['General', 'Health', 'Safety', 'Event', 'Disaster', 'Others']

  return (
    <div>
      <SectionCard
        title="📢 Community Announcements"
        subtitle="Post notices shown to the public at /announcements — no login required"
        action={
          <div className="flex gap-2 items-center">
            <button className="btn btn-ghost text-xs" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success('Public link copied!') }}>
              📋 Copy Public Link
            </button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs">🔗 View Page</a>
            <button className="btn btn-primary text-xs" onClick={() => { setAdding(v => !v); clearImage() }}>
              {adding ? '✕ Cancel' : '+ New Announcement'}
            </button>
          </div>
        }
      >
        {adding && (
          <div style={{ background: '#F5F2EC', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="col-span-1 md:col-span-2">
                <label className="form-label">Title *</label>
                <input className="form-input mt-1" placeholder="e.g. Barangay Assembly on June 30" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select className="form-select mt-1" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CAT.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Message *</label>
              <textarea className="form-input mt-1" rows={4} placeholder="Write the announcement here..." value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} style={{ resize: 'vertical' }} />
            </div>

            {/* Image upload */}
            <div className="mb-3">
              <label className="form-label">Image <span style={{ color: '#C4BFB6', fontWeight: 400 }}>(Optional)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                {imagePreview ? (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={imagePreview} alt="Preview" style={{ width: 120, height: 75, objectFit: 'cover', borderRadius: 6, border: '1px solid #E8E4DA', display: 'block' }} />
                    <button
                      type="button"
                      onClick={clearImage}
                      style={{ position: 'absolute', top: -6, right: -6, background: '#B83232', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >✕</button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost text-xs flex items-center gap-1.5" onClick={() => imageInputRef.current?.click()}>
                    🖼️ Attach Image
                  </button>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                <p style={{ fontSize: 11, color: '#9A9488', margin: 0 }}>
                  {imageFile ? imageFile.name : 'JPG, PNG, or WEBP · Max 5 MB'}
                </p>
              </div>
            </div>

            <button
              className="btn btn-primary text-xs"
              disabled={!form.title.trim() || !form.body.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate({ title: form.title.trim(), body: form.body.trim(), category: form.category })}
            >
              {addMutation.isPending ? 'Posting...' : '📢 Post Announcement'}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#C4BFB6', fontSize: 13, padding: '24px 0' }}>No announcements yet. Click "+ New Announcement" to post one.</p>
        ) : (
          <div className="overflow-x-auto"><table className="data-table">
            <thead><tr><th>Image</th><th>Title</th><th>Category</th><th>Posted</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    {item.image_url
                      ? <img src={item.image_url} alt="" style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #E8E4DA', display: 'block' }} />
                      : <span style={{ fontSize: 11, color: '#C4BFB6' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                  <td><span className="badge badge-gray">{item.category}</span></td>
                  <td className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>{item.is_active ? <span className="badge badge-teal">Live</span> : <span className="badge badge-gray">Hidden</span>}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost px-2 py-1 text-xs"
                        onClick={() => toggleMutation.mutate({ id: item.id, is_active: !item.is_active })}
                      >
                        {item.is_active ? 'Hide' : 'Show'}
                      </button>
                      <button
                        className="btn btn-ghost px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </SectionCard>
    </div>
  )
}
