import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { Bar } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard } from '../components/ui/index'
import { toast } from 'react-toastify'
import { useAuthStore } from '../store/authStore'
import { canEdit } from '../lib/permissions'

Chart.register(...registerables)
const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }

const emptyEnroll = { resident_id: '', program_id: '', status: 'Active', enrolled_at: new Date().toISOString().split('T')[0], last_release_date: '', total_released: '', notes: '' }

export default function BeneficiaryTracking() {
  const { profile } = useAuthStore()
  const canWrite = canEdit(profile?.role)
  const qc = useQueryClient()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStats, setUploadStats] = useState(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollForm, setEnrollForm] = useState(emptyEnroll)
  const [residentSearch, setResidentSearch] = useState('')
  const [editBen, setEditBen] = useState(null)        // beneficiary being edited
  const [delBen, setDelBen] = useState(null)          // beneficiary id to remove
  const [programOpen, setProgramOpen] = useState(false)
  const [programForm, setProgramForm] = useState({ name: '', agency: '', description: '' })

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadStats(null)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      if (!rows.length) { toast.error('File is empty.'); setUploading(false); return }

      // Fetch residents and programs for lookup
      const [{ data: allResidents }, { data: allPrograms }] = await Promise.all([
        supabase.from('residents').select('id, resident_no'),
        supabase.from('assistance_programs').select('id, name'),
      ])
      const resMap = {}; (allResidents || []).forEach(r => { resMap[r.resident_no] = r.id })
      const progMap = {}; (allPrograms || []).forEach(p => { progMap[p.name.toLowerCase()] = p.id })

      let inserted = 0, skipped = 0, errors = 0
      for (const row of rows) {
        const resNo = String(row['Resident No.'] || '').trim()
        const progName = String(row['Program Name'] || '').trim()
        const resident_id = resMap[resNo]
        const program_id = progMap[progName.toLowerCase()]
        if (!resident_id || !program_id) { skipped++; continue }
        try {
          const { error } = await supabase.from('beneficiaries').upsert({
            resident_id,
            program_id,
            status: String(row['Status'] || 'Active').trim(),
            enrolled_at: row['Enrolled Date'] ? String(row['Enrolled Date']).trim() : null,
            last_release_date: row['Last Release Date'] ? String(row['Last Release Date']).trim() : null,
            total_released: row['Total Released'] ? Number(row['Total Released']) || 0 : 0,
            notes: String(row['Notes'] || '').trim() || null,
          }, { onConflict: 'resident_id,program_id' })
          if (error) throw error
          inserted++
        } catch { errors++ }
      }
      setUploadStats({ total: rows.length, inserted, skipped, errors })
      qc.invalidateQueries(['beneficiaries'])
      toast.success(`Import done! ${inserted} records saved.`)
    } catch (err) {
      toast.error('Failed to parse file.')
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Resident No.': 'RES-0001',
      'Program Name': '4Ps (Pantawid Pamilya)',
      'Status': 'Active',
      'Enrolled Date': '2024-01-01',
      'Last Release Date': '2025-12-01',
      'Total Released': 5000,
      'Notes': 'Optional notes here',
    }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries')
    XLSX.writeFile(wb, 'beneficiary_template.xlsx')
  }

  const { data: beneficiaries = [], isLoading } = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: async () => {
      const { data } = await supabase
        .from('beneficiaries')
        .select('*, residents(first_name, last_name, resident_no, purok), assistance_programs(name)')
        .order('enrolled_at', { ascending: false })
      return data || []
    },
  })

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const { data } = await supabase.from('assistance_programs').select('*').eq('is_active', true)
      return data || []
    },
  })

  // All programs (active + inactive) — for the program manager
  const { data: allPrograms = [] } = useQuery({
    queryKey: ['all-programs'],
    queryFn: async () => {
      const { data } = await supabase.from('assistance_programs').select('*').order('name')
      return data || []
    },
  })

  const { data: allResidents = [] } = useQuery({
    queryKey: ['residents-for-enroll'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('id, resident_no, first_name, last_name, purok').order('last_name')
      return data || []
    },
  })

  const enrollMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('beneficiaries').insert({
        resident_id: payload.resident_id,
        program_id: payload.program_id,
        status: payload.status,
        enrolled_at: payload.enrolled_at || null,
        last_release_date: payload.last_release_date || null,
        total_released: payload.total_released ? Number(payload.total_released) : 0,
        notes: payload.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Beneficiary enrolled!')
      qc.invalidateQueries(['beneficiaries'])
      setEnrollOpen(false)
      setEnrollForm(emptyEnroll)
      setResidentSearch('')
    },
    onError: (err) => toast.error(err.message),
  })

  const updateBenMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('beneficiaries').update({
        status: payload.status,
        last_release_date: payload.last_release_date || null,
        total_released: payload.total_released ? Number(payload.total_released) : 0,
        notes: payload.notes || null,
      }).eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Beneficiary updated!'); qc.invalidateQueries(['beneficiaries']); setEditBen(null) },
    onError: (e) => toast.error(e.message),
  })

  const deleteBenMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('beneficiaries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Beneficiary removed.'); qc.invalidateQueries(['beneficiaries']); setDelBen(null) },
    onError: (e) => toast.error(e.message),
  })

  const addProgramMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('assistance_programs').insert({
        name: payload.name.trim(),
        agency: payload.agency.trim() || null,
        description: payload.description.trim() || null,
        is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Program added!')
      qc.invalidateQueries(['programs']); qc.invalidateQueries(['all-programs'])
      setProgramForm({ name: '', agency: '', description: '' })
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleProgramMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('assistance_programs').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries(['programs']); qc.invalidateQueries(['all-programs']) },
    onError: (e) => toast.error(e.message),
  })

  const active = beneficiaries.filter(b => b.status === 'Active').length
  const pending = beneficiaries.filter(b => b.status === 'Pending').length
  const totalReleased = beneficiaries.reduce((s, b) => s + (b.total_released || 0), 0)

  const programCounts = programs.map(p => ({
    name: p.name,
    count: beneficiaries.filter(b => b.program_id === p.id).length,
  })).filter(p => p.count > 0)

  const statusDot = {
    Active: 'bg-green-500',
    Pending: 'bg-amber-400',
    Completed: 'bg-blue-500',
    Suspended: 'bg-red-400',
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={active} label="Active Beneficiaries" color="teal" />
        <StatCard icon="💰" value={`₱${totalReleased.toLocaleString()}`} label="Total Distributed" color="gold" />

        {/* Active Programs — hover to see the list */}
        <div className="relative group">
          <StatCard icon="📦" value={programs.length} label="Active Programs" color="blue" />
          {programs.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                Active Programs ({programs.length})
              </div>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {programs.map(p => (
                  <li key={p.id} className="text-xs text-navy flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0"></span>
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <StatCard icon="⏳" value={pending} label="Pending Claims" color="red" />
      </div>

      <SectionCard title="Assistance by Program">
        <div className="h-52">
          {programCounts.length > 0 ? (
            <Bar
              data={{
                labels: programCounts.map(p => p.name),
                datasets: [{ data: programCounts.map(p => p.count), backgroundColor: '#0D9E8C', borderRadius: 6 }],
              }}
              options={{ ...opts, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
            />
          ) : (
            <Empty message="No beneficiaries enrolled yet" />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Beneficiary Registry"
        action={
          <div className="flex gap-2">
            <button className="btn btn-ghost text-xs" onClick={downloadTemplate} title="Download CSV template">
              ⬇️ Template
            </button>
            {canWrite && (
              <>
                <button className="btn btn-ghost text-xs" onClick={() => setProgramOpen(true)}>
                  ⚙️ Programs
                </button>
                <button className="btn btn-ghost text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  📤 {uploading ? 'Importing...' : 'Bulk Import'}
                </button>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleBulkUpload} style={{ display: 'none' }} />
                <button className="btn btn-primary text-xs" onClick={() => { setEnrollForm(emptyEnroll); setResidentSearch(''); setEnrollOpen(true) }}>
                  + Enroll
                </button>
              </>
            )}
          </div>
        }
      >
        {isLoading ? (
          <p className="text-center text-gray-400 py-6 text-sm">Loading...</p>
        ) : beneficiaries.length > 0 ? (
          <div className="overflow-x-auto"><table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Resident No.</th><th>Program</th>
                <th>Sitio</th><th>Last Release</th><th>Amount</th><th>Status</th>
                {canWrite && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map(b => (
                <tr key={b.id}>
                  <td><strong>{b.residents?.first_name} {b.residents?.last_name}</strong></td>
                  <td><span className="font-mono text-[11px] text-teal">{b.residents?.resident_no}</span></td>
                  <td>{b.assistance_programs?.name}</td>
                  <td>{b.residents?.purok}</td>
                  <td className="text-xs text-gray-500">{b.last_release_date || '—'}</td>
                  <td>₱{(b.total_released || 0).toLocaleString()}</td>
                  <td>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${statusDot[b.status]}`}></span>
                    {b.status}
                  </td>
                  {canWrite && (
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost px-2 py-1 text-xs"
                          onClick={() => setEditBen({ id: b.id, name: `${b.residents?.first_name} ${b.residents?.last_name}`, status: b.status, last_release_date: b.last_release_date || '', total_released: b.total_released || '', notes: b.notes || '' })}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-ghost px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                          onClick={() => setDelBen(b.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No beneficiaries enrolled yet.</p>
        )}
      </SectionCard>

      {/* Upload Results Modal */}
      {uploadStats && (
        <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(15,39,64,0.6)' }}
          onClick={() => setUploadStats(null)}>
          <div style={{ background:'#fff',borderRadius:6,overflow:'hidden',width:360,boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:'#1A3A5C',borderBottom:'3px solid #C9A84C',padding:'12px 20px' }}>
              <div style={{ fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#fff' }}>Bulk Import Complete</div>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                {[
                  { label:'Saved', val: uploadStats.inserted, bg:'#F5FBF9', col:'#0D9E8C' },
                  { label:'Skipped (not found)', val: uploadStats.skipped, bg:'#FFF9EB', col:'#C9A84C' },
                  { label:'Errors', val: uploadStats.errors, bg:'#FFF0F0', col:'#B83232' },
                  { label:'Total Rows', val: uploadStats.total, bg:'#F0F7FF', col:'#3B82F6' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:'center',padding:10,background:s.bg,borderRadius:6 }}>
                    <div style={{ fontSize:22,fontWeight:700,color:s.col }}>{s.val}</div>
                    <div style={{ fontSize:10,color:'#5A5A52' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:11,color:'#9A9488',textAlign:'center',marginTop:10 }}>
                Skipped rows = resident or program name not found in the database.
              </p>
              <button className="btn btn-primary" style={{ width:'100%',marginTop:14 }} onClick={() => setUploadStats(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Beneficiary Modal */}
      {enrollOpen && (
        <div
          style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(15,39,64,0.6)',padding:24 }}
          onClick={() => setEnrollOpen(false)}
        >
          <div
            style={{ background:'#fff',borderRadius:6,width:'100%',maxWidth:480,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ background:'#1A3A5C',borderBottom:'3px solid #C9A84C',padding:'12px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#fff' }}>Enroll Beneficiary</div>
              <button onClick={() => setEnrollOpen(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:20,lineHeight:1 }}>&times;</button>
            </div>

            {/* Form */}
            <form
              style={{ padding:'20px 24px' }}
              onSubmit={e => { e.preventDefault(); enrollMutation.mutate(enrollForm) }}
            >
              {/* Resident search + select */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Resident *</label>
                <input
                  className="form-input"
                  placeholder="Search name or resident no..."
                  value={residentSearch}
                  onChange={e => { setResidentSearch(e.target.value); setEnrollForm(f => ({ ...f, resident_id: '' })) }}
                  style={{ marginBottom:6 }}
                />
                {residentSearch.trim().length > 0 && (
                  <div style={{ border:'1px solid #E8E4DA',borderRadius:4,maxHeight:160,overflowY:'auto',background:'#fff',boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
                    {allResidents
                      .filter(r =>
                        `${r.first_name} ${r.last_name} ${r.resident_no}`.toLowerCase().includes(residentSearch.toLowerCase())
                      )
                      .slice(0, 10)
                      .map(r => (
                        <div
                          key={r.id}
                          onClick={() => { setEnrollForm(f => ({ ...f, resident_id: r.id })); setResidentSearch(`${r.first_name} ${r.last_name} (${r.resident_no})`) }}
                          style={{ padding:'8px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid #F5F2EC', background: enrollForm.resident_id === r.id ? '#F0FBF9' : '#fff' }}
                          onMouseEnter={e => e.currentTarget.style.background='#F5F2EC'}
                          onMouseLeave={e => e.currentTarget.style.background = enrollForm.resident_id === r.id ? '#F0FBF9' : '#fff'}
                        >
                          <span style={{ fontWeight:600 }}>{r.first_name} {r.last_name}</span>
                          <span style={{ fontSize:11,color:'#9A9488',marginLeft:8 }}>{r.resident_no} · {r.purok}</span>
                        </div>
                      ))
                    }
                    {allResidents.filter(r => `${r.first_name} ${r.last_name} ${r.resident_no}`.toLowerCase().includes(residentSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding:'10px 12px',fontSize:12,color:'#9A9488' }}>No residents found</div>
                    )}
                  </div>
                )}
                {enrollForm.resident_id && (
                  <div style={{ fontSize:11,color:'#0D9E8C',marginTop:4 }}>✓ Resident selected</div>
                )}
              </div>

              {/* Program */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Assistance Program *</label>
                <select
                  className="form-select"
                  required
                  value={enrollForm.program_id}
                  onChange={e => setEnrollForm(f => ({ ...f, program_id: e.target.value }))}
                >
                  <option value="">— Select program —</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                {/* Status */}
                <div>
                  <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Status</label>
                  <select
                    className="form-select"
                    value={enrollForm.status}
                    onChange={e => setEnrollForm(f => ({ ...f, status: e.target.value }))}
                  >
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Completed</option>
                    <option>Suspended</option>
                  </select>
                </div>
                {/* Enrolled Date */}
                <div>
                  <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Enrolled Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={enrollForm.enrolled_at}
                    onChange={e => setEnrollForm(f => ({ ...f, enrolled_at: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                {/* Last Release Date */}
                <div>
                  <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Last Release Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={enrollForm.last_release_date}
                    onChange={e => setEnrollForm(f => ({ ...f, last_release_date: e.target.value }))}
                  />
                </div>
                {/* Amount Released */}
                <div>
                  <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Amount Released (₱)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    placeholder="0"
                    value={enrollForm.total_released}
                    onChange={e => setEnrollForm(f => ({ ...f, total_released: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom:18 }}>
                <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Optional notes..."
                  value={enrollForm.notes}
                  onChange={e => setEnrollForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ resize:'none' }}
                />
              </div>

              <div style={{ display:'flex',gap:8 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex:1 }}
                  disabled={!enrollForm.resident_id || !enrollForm.program_id || enrollMutation.isPending}
                >
                  {enrollMutation.isPending ? 'Saving...' : 'Enroll Beneficiary'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEnrollOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Beneficiary Modal */}
      {editBen && (
        <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(15,39,64,0.6)',padding:24 }}
          onClick={() => setEditBen(null)}>
          <div style={{ background:'#fff',borderRadius:6,width:'100%',maxWidth:440,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:'#1A3A5C',borderBottom:'3px solid #C9A84C',padding:'12px 20px' }}>
              <div style={{ fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#fff' }}>Edit Beneficiary</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.55)',marginTop:2 }}>{editBen.name}</div>
            </div>
            <form style={{ padding:'20px 24px' }} onSubmit={e => { e.preventDefault(); updateBenMutation.mutate(editBen) }}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Status</label>
                  <select className="form-select" value={editBen.status} onChange={e => setEditBen({ ...editBen, status: e.target.value })}>
                    <option>Active</option><option>Pending</option><option>Completed</option><option>Suspended</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Last Release Date</label>
                  <input type="date" className="form-input" value={editBen.last_release_date} onChange={e => setEditBen({ ...editBen, last_release_date: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Total Released (₱)</label>
                <input type="number" min="0" className="form-input" value={editBen.total_released} onChange={e => setEditBen({ ...editBen, total_released: e.target.value })} />
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ fontSize:11,fontWeight:600,color:'#5A5A52',display:'block',marginBottom:4 }}>Notes</label>
                <textarea className="form-input" rows={2} value={editBen.notes} onChange={e => setEditBen({ ...editBen, notes: e.target.value })} style={{ resize:'none' }} />
              </div>
              <div style={{ display:'flex',gap:8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={updateBenMutation.isPending}>
                  {updateBenMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditBen(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Beneficiary Confirm */}
      {delBen && (
        <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(15,39,64,0.6)',padding:24 }}
          onClick={() => setDelBen(null)}>
          <div style={{ background:'#fff',borderRadius:6,width:'100%',maxWidth:360,padding:'24px',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:34,marginBottom:8 }}>🗑️</div>
            <p style={{ fontSize:14,color:'#1A1A2E',marginBottom:4 }}>Remove this beneficiary?</p>
            <p style={{ fontSize:12,color:'#9A9488',marginBottom:18 }}>This removes their enrollment record. It cannot be undone.</p>
            <div style={{ display:'flex',gap:8,justifyContent:'center' }}>
              <button className="btn btn-ghost" onClick={() => setDelBen(null)}>Cancel</button>
              <button className="btn bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium" onClick={() => deleteBenMutation.mutate(delBen)} disabled={deleteBenMutation.isPending}>
                {deleteBenMutation.isPending ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Programs Modal */}
      {programOpen && (
        <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(15,39,64,0.6)',padding:24 }}
          onClick={() => setProgramOpen(false)}>
          <div style={{ background:'#fff',borderRadius:6,width:'100%',maxWidth:520,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:'#1A3A5C',borderBottom:'3px solid #C9A84C',padding:'12px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#fff' }}>Assistance Programs</div>
              <button onClick={() => setProgramOpen(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:20,lineHeight:1 }}>&times;</button>
            </div>
            <div style={{ padding:'18px 22px' }}>
              {/* Add new program */}
              <div style={{ background:'#F5F2EC',borderRadius:8,padding:14,marginBottom:16 }}>
                <div style={{ fontSize:12,fontWeight:700,color:'#1A1A2E',marginBottom:8 }}>Add a Program</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
                  <input className="form-input" placeholder="Program name *" value={programForm.name} onChange={e => setProgramForm({ ...programForm, name: e.target.value })} />
                  <input className="form-input" placeholder="Agency (e.g. DSWD)" value={programForm.agency} onChange={e => setProgramForm({ ...programForm, agency: e.target.value })} />
                </div>
                <input className="form-input" placeholder="Short description (optional)" value={programForm.description} onChange={e => setProgramForm({ ...programForm, description: e.target.value })} style={{ marginBottom:10 }} />
                <button className="btn btn-primary text-xs" disabled={!programForm.name.trim() || addProgramMutation.isPending} onClick={() => addProgramMutation.mutate(programForm)}>
                  {addProgramMutation.isPending ? 'Adding...' : '+ Add Program'}
                </button>
              </div>

              {/* Existing programs */}
              {allPrograms.length === 0 ? (
                <p style={{ textAlign:'center',color:'#C4BFB6',fontSize:13,padding:'16px 0' }}>No programs yet. Add one above.</p>
              ) : (
                <div style={{ maxHeight:260,overflowY:'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Program</th><th>Agency</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {allPrograms.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight:500 }}>{p.name}</td>
                          <td className="text-xs text-gray-500">{p.agency || '—'}</td>
                          <td>{p.is_active ? <span className="badge badge-teal">Active</span> : <span className="badge badge-gray">Inactive</span>}</td>
                          <td>
                            <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => toggleProgramMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                              {p.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ message = 'No data yet' }) {
  return <div className="h-full flex items-center justify-center text-gray-300 text-sm">{message}</div>
}
