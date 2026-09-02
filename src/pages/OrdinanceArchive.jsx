// ============================================================================
//  OrdinanceArchive.jsx  —  "Barangay Ordinance Archive" (staff admin)
// ----------------------------------------------------------------------------
//  Where staff record enacted barangay ordinances (ordinance no., title,
//  category, date enacted, sponsor, optional PDF) and hide/show or delete
//  them. Active ones appear on the public archive at /ordinances — ordinances
//  are public record, so that page requires no login, matching how real LGU
//  ordinance archives (e.g. sbo.itogon.gov.ph/ordinances) publish them.
//  PDFs are uploaded to a Supabase Storage bucket and the public URL is saved
//  on the ordinance row.
// ============================================================================

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard } from '../components/ui/index'
import { toast } from 'react-toastify'

const CATEGORIES = [
  'Peace and Order',
  'Agriculture and Fisheries',
  'Sanitation and Waste Management',
  'Environmental Protection',
  'Public Health and Safety',
  'Revenue and Taxation',
  'Traffic and Parking',
  'General Welfare',
]

const emptyForm = { ordinance_no: '', title: '', category: 'General Welfare', date_enacted: '', summary: '', sponsor: '' }

// Admin page to manage the ordinance archive shown on the public page (/ordinances).
export default function OrdinanceArchive() {
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const pdfInputRef = useRef(null)

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Please attach a PDF file.'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('PDF must be under 10MB.'); return }
    setPdfFile(file)
    e.target.value = ''
  }

  const clearPdf = () => setPdfFile(null)

  const { data: items = [] } = useQuery({
    queryKey: ['ordinances-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ordinances')
        .select('id, ordinance_no, title, category, date_enacted, sponsor, is_active, created_at, file_url')
        .order('date_enacted', { ascending: false })
      return data || []
    },
  })

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      // Upload the PDF to Supabase Storage first (if one was attached)
      let file_url = null
      if (pdfFile) {
        const path = `${payload.ordinance_no.replace(/\s+/g, '_')}_${Date.now()}.pdf`
        const { error: uploadErr } = await supabase.storage
          .from('ordinance-pdfs')
          .upload(path, pdfFile, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage
          .from('ordinance-pdfs')
          .getPublicUrl(path)
        file_url = publicUrl
      }
      const { error } = await supabase.from('ordinances').insert({ ...payload, file_url })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Ordinance added to the archive!')
      qc.invalidateQueries(['ordinances-admin'])
      qc.invalidateQueries(['public-ordinances'])
      setForm(emptyForm)
      clearPdf()
      setAdding(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('ordinances').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['ordinances-admin']),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('ordinances').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Ordinance deleted.')
      qc.invalidateQueries(['ordinances-admin'])
    },
    onError: (e) => toast.error(e.message),
  })

  const publicUrl = `${window.location.origin}/ordinances`

  return (
    <div>
      <SectionCard
        title="📜 Barangay Ordinance Archive"
        subtitle="Post enacted ordinances shown to the public at /ordinances — no login required"
        action={
          <div className="flex gap-2 items-center">
            <button className="btn btn-ghost text-xs" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success('Public link copied!') }}>
              📋 Copy Public Link
            </button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs">🔗 View Page</a>
            <button className="btn btn-primary text-xs" onClick={() => { setAdding(v => !v); clearPdf() }}>
              {adding ? '✕ Cancel' : '+ New Ordinance'}
            </button>
          </div>
        }
      >
        {adding && (
          <div style={{ background: '#F5F2EC', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="form-label">Ordinance No. *</label>
                <input className="form-input mt-1" placeholder="e.g. 2026-02" value={form.ordinance_no} onChange={e => setForm({ ...form, ordinance_no: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Date Enacted *</label>
                <input type="date" className="form-input mt-1" value={form.date_enacted} onChange={e => setForm({ ...form, date_enacted: e.target.value })} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="form-label">Title *</label>
                <input className="form-input mt-1" placeholder="e.g. An Ordinance Regulating..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select className="form-select mt-1" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Sponsor <span style={{ color: '#C4BFB6', fontWeight: 400 }}>(Optional)</span></label>
                <input className="form-input mt-1" placeholder="e.g. Kagawad Reyes" value={form.sponsor} onChange={e => setForm({ ...form, sponsor: e.target.value })} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Summary <span style={{ color: '#C4BFB6', fontWeight: 400 }}>(Optional)</span></label>
              <textarea className="form-input mt-1" rows={3} placeholder="Brief description of what this ordinance does..." value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} style={{ resize: 'vertical' }} />
            </div>

            {/* PDF upload */}
            <div className="mb-3">
              <label className="form-label">Signed PDF Copy <span style={{ color: '#C4BFB6', fontWeight: 400 }}>(Optional)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                {pdfFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, padding: '6px 10px' }}>
                    <span style={{ fontSize: 12 }}>📄 {pdfFile.name}</span>
                    <button
                      type="button"
                      onClick={clearPdf}
                      style={{ background: '#B83232', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 9, cursor: 'pointer', lineHeight: 1 }}
                    >✕</button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost text-xs flex items-center gap-1.5" onClick={() => pdfInputRef.current?.click()}>
                    📄 Attach PDF
                  </button>
                )}
                <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfChange} style={{ display: 'none' }} />
                <p style={{ fontSize: 11, color: '#9A9488', margin: 0 }}>
                  {pdfFile ? '' : 'PDF only · Max 10 MB'}
                </p>
              </div>
            </div>

            <button
              className="btn btn-primary text-xs"
              disabled={!form.ordinance_no.trim() || !form.title.trim() || !form.date_enacted || addMutation.isPending}
              onClick={() => addMutation.mutate({
                ordinance_no: form.ordinance_no.trim(),
                title: form.title.trim(),
                category: form.category,
                date_enacted: form.date_enacted,
                summary: form.summary.trim() || null,
                sponsor: form.sponsor.trim() || null,
              })}
            >
              {addMutation.isPending ? 'Saving...' : '📜 Add to Archive'}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#C4BFB6', fontSize: 13, padding: '24px 0' }}>No ordinances yet. Click "+ New Ordinance" to add one.</p>
        ) : (
          <div className="overflow-x-auto"><table className="data-table">
            <thead><tr><th>No.</th><th>Title</th><th>Category</th><th>Date Enacted</th><th>PDF</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{item.ordinance_no}</td>
                  <td style={{ fontWeight: 500, maxWidth: 320 }}>{item.title}</td>
                  <td><span className="badge badge-gray">{item.category}</span></td>
                  <td className="text-xs text-gray-400">{new Date(item.date_enacted).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>
                    {item.file_url
                      ? <a href={item.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>📄 View</a>
                      : <span style={{ fontSize: 11, color: '#C4BFB6' }}>—</span>}
                  </td>
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
