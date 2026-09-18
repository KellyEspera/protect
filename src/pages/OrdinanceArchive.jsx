// ============================================================================
//  OrdinanceArchive.jsx  —  "Barangay Ordinance Archive" (staff admin)
// ----------------------------------------------------------------------------
//  Where the Barangay Secretary records enacted ordinances (ordinance no., title,
//  category, date enacted, sponsor, optional PDF) and hide/show or delete
//  them. Ordinances are internal records for the Barangay Secretary.
//  PDFs are uploaded to a Supabase Storage bucket and the file URL is saved
//  on the ordinance row.
// ============================================================================

import { useMemo, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard } from '../components/ui/index'
import { toast } from 'react-toastify'
import jsPDF from 'jspdf'

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

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const formatDate = (value) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
  : '—'

// Secretary-only page for managing the internal ordinance archive.
export default function OrdinanceArchive() {
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const pdfInputRef = useRef(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [yearFilter, setYearFilter] = useState('All')
  const [previewItem, setPreviewItem] = useState(null)

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
        .select('id, ordinance_no, title, category, date_enacted, summary, sponsor, is_active, created_at, file_url')
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

  const years = useMemo(() => [...new Set(items.map(item => item.date_enacted?.slice(0, 4)).filter(Boolean))].sort().reverse(), [items])
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter(item => {
      const matchesSearch = !query || [item.ordinance_no, item.title, item.sponsor].some(value => value?.toLowerCase().includes(query))
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? item.is_active : !item.is_active)
      const matchesYear = yearFilter === 'All' || item.date_enacted?.startsWith(yearFilter)
      return matchesSearch && matchesCategory && matchesStatus && matchesYear
    })
  }, [items, search, categoryFilter, statusFilter, yearFilter])

  const archiveStats = useMemo(() => {
    const total = items.length
    const active = items.filter(item => item.is_active).length
    const hidden = total - active
    const latestYear = years[0] || '—'
    return { total, active, hidden, latestYear }
  }, [items, years])

  const getOrdinancePreviewHtml = (item) => `<!DOCTYPE html><html><head><title>${escapeHtml(item.ordinance_no)} - ${escapeHtml(item.title)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eef1f0;color:#1a1a1a;font-family:'Times New Roman',serif;padding:18mm 22mm;font-size:12pt;line-height:1.55}.paper{max-width:210mm;min-height:257mm;margin:auto;background:#fff;padding:12mm 15mm;border:1px solid #d8d8d8}.header{text-align:center;border-bottom:2px solid #1a3a5c;padding-bottom:8pt}.republic{font-size:10pt}.province{font-size:10pt}.brgy{font-size:16pt;font-weight:bold;color:#1a3a5c;margin:3pt 0}.office{font-size:10pt;font-weight:bold;letter-spacing:1pt}.meta{display:flex;justify-content:space-between;margin-top:18pt;font-size:10pt}.title{text-align:center;color:#1a3a5c;font-size:18pt;font-weight:bold;text-transform:uppercase;text-decoration:underline;margin:20pt 0 16pt}.label{font-weight:bold}.body{text-align:justify;white-space:pre-line;min-height:90mm}.signature{width:70mm;text-align:center;margin:26pt 0 0 auto}.signature-line{border-top:1px solid #1a1a1a;margin-bottom:4pt}.footer{margin-top:26pt;padding-top:7pt;border-top:1px solid #ccc;text-align:center;color:#777;font-size:8.5pt}@media print{body{background:#fff;padding:0}.paper{border:0}}
  </style></head><body><main class="paper"><header class="header"><div class="republic">REPUBLIC OF THE PHILIPPINES</div><div class="province">Province of Batanes · Municipality of Basco</div><div class="brgy">BARANGAY SAN JOAQUIN</div><div class="office">OFFICE OF THE PUNONG BARANGAY</div></header><div class="meta"><span><span class="label">Ordinance No.:</span> ${escapeHtml(item.ordinance_no)}</span><span><span class="label">Date Enacted:</span> ${escapeHtml(formatDate(item.date_enacted))}</span></div><h1 class="title">${escapeHtml(item.title)}</h1><section class="body"><p><span class="label">Category:</span> ${escapeHtml(item.category || 'General Welfare')}</p>${item.sponsor ? `<p><span class="label">Sponsored by:</span> ${escapeHtml(item.sponsor)}</p>` : ''}<p>${escapeHtml(item.summary || 'This ordinance is recorded in the official internal ordinance archive of Barangay San Joaquin.')}</p></section><div class="signature"><div class="signature-line"></div><strong>PUNONG BARANGAY</strong><div>Barangay San Joaquin</div></div><footer class="footer">Internal Barangay Secretary copy · Generated by PROTECT Barangay Analytics System</footer></main></body></html>`

  const buildOrdinancePdf = (item) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 24
    const width = pageW - margin * 2
    let y = 22
    const center = (text, size, style = 'normal', color = [26, 26, 26]) => {
      doc.setFont('times', style); doc.setFontSize(size); doc.setTextColor(...color)
      doc.text(text, pageW / 2, y, { align: 'center' })
    }
    center('REPUBLIC OF THE PHILIPPINES', 10); y += 5
    center('Province of Batanes · Municipality of Basco', 10); y += 7
    center('BARANGAY SAN JOAQUIN', 16, 'bold', [26, 58, 92]); y += 6
    center('OFFICE OF THE PUNONG BARANGAY', 10, 'bold'); y += 7
    doc.setDrawColor(26, 58, 92); doc.setLineWidth(0.7); doc.line(margin, y, pageW - margin, y); y += 12
    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 26, 26)
    doc.text(`Ordinance No.: ${item.ordinance_no || '—'}`, margin, y)
    doc.text(`Date Enacted: ${formatDate(item.date_enacted)}`, pageW - margin, y, { align: 'right' }); y += 15
    doc.setFont('times', 'bold'); doc.setFontSize(17); doc.setTextColor(26, 58, 92)
    doc.text(doc.splitTextToSize(String(item.title || 'BARANGAY ORDINANCE'), width), pageW / 2, y, { align: 'center', maxWidth: width }); y += 18
    doc.setFont('times', 'normal'); doc.setFontSize(11); doc.setTextColor(26, 26, 26)
    doc.text(`Category: ${item.category || 'General Welfare'}`, margin, y); y += 8
    if (item.sponsor) { doc.text(`Sponsored by: ${item.sponsor}`, margin, y); y += 8 }
    const body = item.summary || 'This ordinance is recorded in the official internal ordinance archive of Barangay San Joaquin.'
    const lines = doc.splitTextToSize(body, width)
    doc.text(lines, margin, y, { maxWidth: width, align: 'justify' }); y += lines.length * 6 + 28
    doc.setDrawColor(26, 26, 26); doc.setLineWidth(0.4); doc.line(pageW - margin - 68, y, pageW - margin, y)
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.text('PUNONG BARANGAY', pageW - margin - 34, y + 5, { align: 'center' })
    doc.setFont('times', 'normal'); doc.setFontSize(9); doc.text('Barangay San Joaquin', pageW - margin - 34, y + 10, { align: 'center' })
    doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text('Internal Barangay Secretary copy · Generated by PROTECT', pageW / 2, 285, { align: 'center' })
    return doc
  }

  const downloadOrdinance = (item) => {
    if (item.file_url) return
    buildOrdinancePdf(item).save(`${item.ordinance_no || 'Ordinance'}.pdf`)
  }

  const printPreview = () => {
    const frame = document.getElementById('ordinance-preview-frame')
    if (!frame) return
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0F2740 0%, #183E63 55%, #D9B76D 100%)',
          border: '1px solid rgba(217,183,109,0.5)',
          borderRadius: 14,
          padding: '18px 20px 20px',
          boxShadow: '0 10px 18px rgba(15,39,64,0.12)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, opacity: 0.82 }}>REPUBLIC OF THE PHILIPPINES</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>Barangay San Joaquin</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 700 }}>
            {archiveStats.latestYear} Ordinance Records
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 16, paddingTop: 14 }}>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.8 }}>Official Ordinance Archive</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, lineHeight: 1.2 }}>Barangay Secretary Record Book</div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
          <span>Home</span>
          <span>›</span>
          <span>Barangay Archive</span>
          <span>›</span>
          <span style={{ fontWeight: 700 }}>Ordinances</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Records', value: archiveStats.total, accent: '#163F63' },
          { label: 'Active', value: archiveStats.active, accent: '#0E7A65' },
          { label: 'Hidden', value: archiveStats.hidden, accent: '#7B6F5A' },
          { label: 'Latest Year', value: archiveStats.latestYear, accent: '#B58A2C' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid #E7E0D1', borderRadius: 12, padding: '14px 16px', boxShadow: '0 6px 16px rgba(12,28,42,0.04)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#776F61' }}>{stat.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.accent, marginTop: 8 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <SectionCard
        title="📜 Official Ordinance Archive"
        subtitle="Internal ordinance records for the Barangay Secretary"
        action={
          <div className="flex gap-2 items-center">
            <button className="btn btn-primary text-xs" onClick={() => { setAdding(v => !v); clearPdf() }}>
              {adding ? '✕ Cancel' : '+ New Ordinance'}
            </button>
          </div>
        }
      >
        {adding && (
          <div style={{ background: '#F8F5F0', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #E9E1D0' }}>
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

        <div style={{ background: '#F8F5F0', borderRadius: 12, border: '1px solid #E8E1D3', padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.8fr) repeat(3, minmax(130px, 1fr))', gap: 8 }}>
            <input className="form-input" placeholder="Search no., title, or sponsor..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="All">All categories</option>
              {CATEGORIES.map(category => <option key={category}>{category}</option>)}
            </select>
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Hidden">Hidden</option>
            </select>
            <select className="form-select" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
              <option value="All">All years</option>
              {years.map(year => <option key={year}>{year}</option>)}
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#C4BFB6', fontSize: 13, padding: '24px 0' }}>No ordinances match the current filters.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredItems.map(item => (
              <div key={item.id} style={{ background: '#fff', border: '1px solid #E9E0D0', borderRadius: 12, padding: 16, boxShadow: '0 6px 18px rgba(15,39,64,.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: 1.2, color: '#7D7367', textTransform: 'uppercase', fontWeight: 700 }}>{item.ordinance_no}</div>
                    <h3 style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 700, color: '#1D2A39' }}>{item.title}</h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {item.is_active ? <span className="badge badge-teal">Active</span> : <span className="badge badge-gray">Hidden</span>}
                    <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setPreviewItem(item)}>Preview</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }}>
                  <div style={{ background: '#F7F4EE', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#7D7367', textTransform: 'uppercase', letterSpacing: 1 }}>Category</div>
                    <div style={{ marginTop: 4, fontWeight: 700, color: '#1E2B39' }}>{item.category}</div>
                  </div>
                  <div style={{ background: '#F7F4EE', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#7D7367', textTransform: 'uppercase', letterSpacing: 1 }}>Date Enacted</div>
                    <div style={{ marginTop: 4, fontWeight: 700, color: '#1E2B39' }}>{formatDate(item.date_enacted)}</div>
                  </div>
                  <div style={{ background: '#F7F4EE', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#7D7367', textTransform: 'uppercase', letterSpacing: 1 }}>Sponsor</div>
                    <div style={{ marginTop: 4, fontWeight: 700, color: '#1E2B39' }}>{item.sponsor || 'Not specified'}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, color: '#3B3A3A', lineHeight: 1.6, fontSize: 14 }}>
                  {item.summary || 'This ordinance is recorded in the official barangay archive and is available for internal review and official reference.'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {item.file_url
                    ? <a className="btn btn-ghost px-2 py-1 text-xs" href={item.file_url} download={`${item.ordinance_no}.pdf`}>Download</a>
                    : <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => downloadOrdinance(item)}>Download</button>}
                  <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => { setPreviewItem(item); setTimeout(printPreview, 100) }}>Print</button>
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
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {previewItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,39,64,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setPreviewItem(null)}>
          <div style={{ background: '#fff', width: 'min(900px, 100%)', height: 'min(760px, 92vh)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }} onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #E8E4DA', background: '#F9F6F2' }}>
              <div>
                <strong style={{ color: '#1A1A2E' }}>{previewItem.ordinance_no} · {previewItem.title}</strong>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{previewItem.file_url ? 'Secretary preview · signed PDF copy' : 'Secretary preview · generated ordinance document'}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost text-xs" onClick={printPreview}>Print</button>
                {previewItem.file_url
                  ? <a className="btn btn-primary text-xs" href={previewItem.file_url} download={`${previewItem.ordinance_no}.pdf`}>Download</a>
                  : <button className="btn btn-primary text-xs" onClick={() => downloadOrdinance(previewItem)}>Download</button>}
                <button className="btn btn-ghost text-xs" onClick={() => setPreviewItem(null)}>Close</button>
              </div>
            </div>
            <iframe
              id="ordinance-preview-frame"
              title={`Preview ${previewItem.ordinance_no}`}
              src={previewItem.file_url || undefined}
              srcDoc={previewItem.file_url ? undefined : getOrdinancePreviewHtml(previewItem)}
              style={{ flex: 1, width: '100%', border: 0 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
