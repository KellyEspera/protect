import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bar } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard, Badge } from '../components/ui/index'
import { toast } from 'react-toastify'
import { sanitizeIncidentForm } from '../lib/sanitize'
import { useAuthStore } from '../store/authStore'
import { canEdit } from '../lib/permissions'

Chart.register(...registerables)
const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }

const SITIO_CENTERS = {
  'Sitio Hunan': [20.44531, 121.98450],  // Barangay Hall (west / inland)
  'Sitio Tuva':  [20.44600, 121.99050],  // northeast / up the hill
  'Sitio Hagu':  [20.44150, 121.98850],  // south / toward Valugan coast
}

export default function CrimeIncident() {
  const { profile } = useAuthStore()
  const canWrite = canEdit(profile?.role)
  const qc = useQueryClient()
  const [form, setForm] = useState({
    incident_type: 'Public Intoxication / Disorderly Conduct',
    purok: 'Sitio Hunan',
    complainant: '',
    incident_date: '',
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const photoInputRef = useRef(null)

  // Incident location picker (mini map)
  const [pinLoc, setPinLoc] = useState(null)
  const locMapRef = useRef(null)
  const locMapInstance = useRef(null)
  const locMarkerRef = useRef(null)

  // Init the mini map (only for users who can log incidents)
  useEffect(() => {
    if (!canWrite || locMapInstance.current) return
    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !locMapRef.current || locMapInstance.current) return
      const center = SITIO_CENTERS[form.purok] || [20.44531, 121.98450]
      const map = L.default.map(locMapRef.current).setView(center, 15)
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (locMarkerRef.current) map.removeLayer(locMarkerRef.current)
        const icon = L.default.divIcon({ html: '<div style="width:16px;height:16px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 0 2px rgba(239,68,68,0.4)"></div>', className: '', iconAnchor: [8, 8] })
        locMarkerRef.current = L.default.marker([lat, lng], { icon }).addTo(map)
        setPinLoc({ lat, lng })
      })
      setTimeout(() => map.invalidateSize(), 200)
      locMapInstance.current = map
    })
    return () => {
      cancelled = true
      if (locMapInstance.current) { locMapInstance.current.remove(); locMapInstance.current = null }
    }
  }, [canWrite])

  // Recenter the picker when the sitio changes (only if nothing placed yet)
  useEffect(() => {
    if (locMapInstance.current && !pinLoc) {
      const center = SITIO_CENTERS[form.purok]
      if (center) locMapInstance.current.setView(center, 15)
    }
  }, [form.purok])

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB.'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .order('incident_date', { ascending: false })
      return data || []
    },
  })

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      const caseNo = `INC-${new Date().getFullYear()}-${String(incidents.length + 1).padStart(3, '0')}`

      // Upload photo to Supabase Storage if one was attached
      let photo_url = null
      if (photoFile) {
        const ext = photoFile.name.split('.').pop().toLowerCase()
        const path = `${caseNo}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('incident-photos')
          .upload(path, photoFile, { upsert: true })
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('incident-photos')
            .getPublicUrl(path)
          photo_url = publicUrl
        }
      }

      const { error } = await supabase.from('incidents').insert({
        ...payload,
        case_no: caseNo,
        status: 'Ongoing',
        photo_url,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Incident logged!')
      qc.invalidateQueries(['incidents'])
      setForm({ incident_type: 'Public Intoxication / Disorderly Conduct', purok: 'Sitio Hunan', complainant: '', incident_date: '' })
      setPhotoFile(null)
      setPhotoPreview(null)
      setPinLoc(null)
      if (locMarkerRef.current && locMapInstance.current) {
        locMapInstance.current.removeLayer(locMarkerRef.current)
        locMarkerRef.current = null
      }
    },
    onError: (e) => toast.error(e.message),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('incidents').update({ status }).eq('id', id)
      if (error) throw error
      return status
    },
    onSuccess: (status) => {
      qc.invalidateQueries(['incidents'])
      toast.success(`Case marked ${status}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const STATUS_OPTIONS = ['Ongoing', 'Resolved', 'Escalated', 'Dismissed']

  const ongoing = incidents.filter(i => i.status === 'Ongoing').length
  const resolved = incidents.filter(i => i.status === 'Resolved').length
  const resolutionRate = incidents.length > 0 ? Math.round((resolved / incidents.length) * 100) : 0

  const typeLabels = [
    'Public Intoxication / Disorderly Conduct',
    'Minor Physical Altercation',
    'Domestic Dispute',
    'Property Damage (Typhoon-related)',
    'Environmental / Ordinance Violation',
    'Stray Animal Complaint',
    'Noise Disturbance',
    'Others',
  ]
  const typeCounts = typeLabels.map(t => incidents.filter(i => i.incident_type === t).length)

  // Month-prevalent data (current year)
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const currentYear = new Date().getFullYear()
  const monthlyCounts = MONTHS.map((_, i) =>
    incidents.filter(inc => {
      const d = new Date(inc.incident_date)
      return d.getFullYear() === currentYear && d.getMonth() === i
    }).length
  )
  const peakMonthIdx = monthlyCounts.indexOf(Math.max(...monthlyCounts))
  const peakMonth = monthlyCounts[peakMonthIdx] > 0 ? MONTHS[peakMonthIdx] : '—'

  const statusColor = { Ongoing: 'gold', Resolved: 'blue', Escalated: 'red', Dismissed: 'gray' }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="📋" value={incidents.length} label="Total Incidents" color="red" />
        <StatCard icon="⏳" value={ongoing} label="Ongoing Cases" color="gold" />
        <StatCard icon="🤝" value={`${resolutionRate}%`} label="Resolution Rate" color="teal" />
        <StatCard icon="📅" value={peakMonth} label={`Peak Month (${currentYear})`} color="blue" />
      </div>

      <SectionCard title="Incident Type Breakdown">
        <div className="h-52">
          {incidents.length > 0 ? (
            <Bar
              data={{
                labels: typeLabels,
                datasets: [{
                  data: typeCounts,
                  backgroundColor: [
                    '#EF4444','#F5A623','#8B5CF6','#3B82F6',
                    '#0D9E8C','#EC4899','#6B7280','#94A3B8',
                  ],
                  borderRadius: 6,
                }],
              }}
              options={{ ...opts, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
            />
          ) : (
            <Empty message="No incidents recorded yet" />
          )}
        </div>
      </SectionCard>

      <SectionCard title={`Monthly Incident Trend — ${currentYear}`} subtitle="Number of incidents reported per month this year">
        <div className="h-52">
          {incidents.length > 0 ? (
            <Bar
              data={{
                labels: MONTHS,
                datasets: [{
                  data: monthlyCounts,
                  backgroundColor: monthlyCounts.map((_, i) => i === peakMonthIdx ? '#B83232' : '#0D9E8C'),
                  borderRadius: 6,
                }],
              }}
              options={{ ...opts, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
            />
          ) : (
            <Empty message="No incidents recorded yet" />
          )}
        </div>
      </SectionCard>

      {canWrite && (
      <SectionCard
        title="Log New Incident"
        action={
          <button
            className="btn btn-primary text-xs"
            disabled={addMutation.isPending}
            onClick={() => {
              if (!form.incident_date) { toast.error('Please set a date and time.'); return }
              const sanitized = sanitizeIncidentForm(form)
              addMutation.mutate({
                ...sanitized,
                incident_date: new Date(form.incident_date).toISOString(),
                latitude: pinLoc?.lat ?? null,
                longitude: pinLoc?.lng ?? null,
              })
            }}
          >
            {addMutation.isPending ? 'Saving...' : '+ Submit Report'}
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="form-label">Incident Type</label>
            <select className="form-select mt-1" value={form.incident_type} onChange={e => setForm({ ...form, incident_type: e.target.value })}>
              {typeLabels.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Sitio</label>
            <select className="form-select mt-1" value={form.purok} onChange={e => setForm({ ...form, purok: e.target.value })}>
              {['Sitio Hunan','Sitio Hagu','Sitio Tuva'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Date &amp; Time *</label>
            <input
              type="datetime-local"
              className="form-input mt-1"
              value={form.incident_date}
              onChange={e => setForm({ ...form, incident_date: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Complainant</label>
            <input
              className="form-input mt-1"
              placeholder="Name or Anonymous"
              value={form.complainant}
              onChange={e => setForm({ ...form, complainant: e.target.value })}
            />
          </div>
        </div>

        {/* Incident location picker */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <label className="form-label mb-2 block">
            Incident Location <span style={{ color: '#C4BFB6', fontWeight: 400 }}>(click the map to mark the exact spot)</span>
          </label>
          <div ref={locMapRef} style={{ height: 220, borderRadius: 6, border: '1px solid #E8E4DA', overflow: 'hidden' }} />
          <p style={{ fontSize: 11, color: pinLoc ? '#0D9E8C' : '#9A9488', marginTop: 6 }}>
            {pinLoc
              ? `📍 Marked at ${pinLoc.lat.toFixed(5)}, ${pinLoc.lng.toFixed(5)}`
              : 'No exact location marked — the incident will be placed at the sitio center.'}
          </p>
        </div>

        {/* Photo evidence upload */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <label className="form-label mb-2 block">Photo Evidence <span style={{ color: '#C4BFB6', fontWeight: 400 }}>(Optional)</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {photoPreview ? (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{ width: 90, height: 65, objectFit: 'cover', borderRadius: 6, border: '1px solid #E8E4DA', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  style={{ position: 'absolute', top: -6, right: -6, background: '#B83232', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >✕</button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost text-xs flex items-center gap-1.5"
                onClick={() => photoInputRef.current?.click()}
              >
                📷 Attach Photo
              </button>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            <p style={{ fontSize: 11, color: '#9A9488', margin: 0 }}>
              {photoFile ? photoFile.name : 'JPG, PNG, or WEBP · Max 5 MB'}
            </p>
          </div>
        </div>
      </SectionCard>
      )}

      <SectionCard title="Incident Log">
        {isLoading ? (
          <p className="text-center text-gray-400 py-6 text-sm">Loading...</p>
        ) : incidents.length > 0 ? (
          <div className="overflow-x-auto"><table className="data-table">
            <thead>
              <tr>
                <th>Case No.</th><th>Type</th><th>Sitio</th>
                <th>Date</th><th>Complainant</th><th>Photo</th><th>Status</th><th>Update Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => (
                <tr key={inc.id}>
                  <td><span className="font-mono text-[11px] text-teal">{inc.case_no}</span></td>
                  <td>{inc.incident_type}</td>
                  <td>{inc.purok}</td>
                  <td className="text-xs text-gray-500">
                    {new Date(inc.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>{inc.complainant || '—'}</td>
                  <td>
                    {inc.photo_url ? (
                      <a href={inc.photo_url} target="_blank" rel="noopener noreferrer" title="View full photo">
                        <img
                          src={inc.photo_url}
                          alt="Evidence"
                          style={{ width: 44, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #E8E4DA', display: 'block', cursor: 'pointer' }}
                        />
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: '#C4BFB6' }}>—</span>
                    )}
                  </td>
                  <td><Badge variant={statusColor[inc.status] || 'gray'}>{inc.status}</Badge></td>
                  <td>
                    {canWrite ? (
                      <select
                        value={inc.status}
                        onChange={e => {
                          if (e.target.value !== inc.status) {
                            updateStatus.mutate({ id: inc.id, status: e.target.value })
                          }
                        }}
                        title="Change case status"
                        style={{ fontSize: 12, padding: '4px 6px', border: '1px solid #D4D0C8', borderRadius: 4, color: '#1A1A2E', fontFamily: 'Inter,sans-serif', background: '#fff', cursor: 'pointer' }}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, color: '#C4BFB6' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No incidents recorded yet.</p>
        )}
      </SectionCard>
    </div>
  )
}

function Empty({ message = 'No data yet' }) {
  return <div className="h-full flex items-center justify-center text-gray-300 text-sm">{message}</div>
}
