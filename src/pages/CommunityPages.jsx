import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bar, Line } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard, Badge } from '../components/ui/index'
import { toast } from 'react-toastify'
import { exportToPDF } from '../lib/exportUtils'
import { sanitizeIncidentForm, sanitizeSurveyForm } from '../lib/sanitize'

Chart.register(...registerables)
const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }

// ── BENEFICIARY TRACKING ──────────────────────────────────────
export function BeneficiaryTracking() {
  const qc = useQueryClient()

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
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={active} label="Active Beneficiaries" color="teal" />
        <StatCard icon="💰" value={`₱${totalReleased.toLocaleString()}`} label="Total Distributed" color="gold" />
        <StatCard icon="📦" value={programs.length} label="Active Programs" color="blue" />
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
          <button className="btn btn-primary text-xs" onClick={() => toast.info('Go to Residents page to enroll a beneficiary.')}>
            + Enroll Beneficiary
          </button>
        }
      >
        {isLoading ? (
          <p className="text-center text-gray-400 py-6 text-sm">Loading...</p>
        ) : beneficiaries.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Resident No.</th><th>Program</th>
                <th>Purok</th><th>Last Release</th><th>Amount</th><th>Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No beneficiaries enrolled yet.</p>
        )}
      </SectionCard>
    </div>
  )
}

// ── CRIME & INCIDENT ──────────────────────────────────────────
export function CrimeIncident() {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    incident_type: 'Noise/Disturbance',
    purok: 'Purok 1',
    complainant: '',
    incident_date: '',
  })

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
      const { error } = await supabase.from('incidents').insert({
        ...payload,
        case_no: caseNo,
        status: 'Ongoing',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Incident logged!')
      qc.invalidateQueries(['incidents'])
      setForm({ incident_type: 'Noise/Disturbance', purok: 'Purok 1', complainant: '', incident_date: '' })
    },
    onError: (e) => toast.error(e.message),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('incidents').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['incidents']),
  })

  const ongoing = incidents.filter(i => i.status === 'Ongoing').length
  const resolved = incidents.filter(i => i.status === 'Resolved').length
  const resolutionRate = incidents.length > 0 ? Math.round((resolved / incidents.length) * 100) : 0

  const typeLabels = [
    'Noise/Disturbance', 'Theft', 'Physical Injury', 'Domestic Violence',
    'Trespassing', 'Accident', 'Illegal Drugs', 'Others',
  ]
  const typeCounts = typeLabels.map(t => incidents.filter(i => i.incident_type === t).length)

  const statusColor = { Ongoing: 'gold', Resolved: 'blue', Escalated: 'red', Dismissed: 'gray' }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="📋" value={incidents.length} label="Total Incidents" color="red" />
        <StatCard icon="⏳" value={ongoing} label="Ongoing Cases" color="gold" />
        <StatCard icon="🤝" value={`${resolutionRate}%`} label="Resolution Rate" color="teal" />
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

      <SectionCard
        title="Log New Incident"
        action={
          <button
            className="btn btn-primary text-xs"
            disabled={addMutation.isPending}
            onClick={() => {
              if (!form.incident_date) { toast.error('Please set a date and time.'); return }
              const sanitized = sanitizeIncidentForm(form)
              addMutation.mutate({ ...sanitized, incident_date: new Date(form.incident_date).toISOString() })
            }}
          >
            {addMutation.isPending ? 'Saving...' : '+ Submit Report'}
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Incident Type</label>
            <select className="form-select mt-1" value={form.incident_type} onChange={e => setForm({ ...form, incident_type: e.target.value })}>
              {typeLabels.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Purok</label>
            <select className="form-select mt-1" value={form.purok} onChange={e => setForm({ ...form, purok: e.target.value })}>
              {['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5'].map(p => <option key={p}>{p}</option>)}
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
      </SectionCard>

      <SectionCard title="Incident Log">
        {isLoading ? (
          <p className="text-center text-gray-400 py-6 text-sm">Loading...</p>
        ) : incidents.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case No.</th><th>Type</th><th>Purok</th>
                <th>Date</th><th>Complainant</th><th>Status</th><th>Action</th>
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
                  <td><Badge variant={statusColor[inc.status] || 'gray'}>{inc.status}</Badge></td>
                  <td>
                    {inc.status === 'Ongoing' && (
                      <button
                        className="btn btn-ghost px-2 py-1 text-xs"
                        onClick={() => updateStatus.mutate({ id: inc.id, status: 'Resolved' })}
                      >
                        Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No incidents recorded yet.</p>
        )}
      </SectionCard>
    </div>
  )
}

// ── PREDICTIVE GROWTH ─────────────────────────────────────────
export function PredictiveGrowth() {
  // Fetch all residents to compute actual population count per year (by reg date)
  // and run a simple linear regression
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-predictive'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('created_at')
      return data || []
    },
  })

  // Group residents by registration year to build historical series
  const yearCounts = {}
  residents.forEach(r => {
    const yr = new Date(r.created_at).getFullYear()
    yearCounts[yr] = (yearCounts[yr] || 0) + 1
  })

  // Build cumulative series
  const sortedYears = Object.keys(yearCounts).map(Number).sort()
  let cumulative = 0
  const historical = sortedYears.map(yr => {
    cumulative += yearCounts[yr]
    return { year: yr, count: cumulative }
  })

  // Fallback: if no data yet, show placeholder message
  const hasData = historical.length >= 2

  // Simple linear regression
  let slope = 0, intercept = 0, r2 = 0
  if (hasData) {
    const n = historical.length
    const sumX = historical.reduce((s, d) => s + d.year, 0)
    const sumY = historical.reduce((s, d) => s + d.count, 0)
    const sumXY = historical.reduce((s, d) => s + d.year * d.count, 0)
    const sumX2 = historical.reduce((s, d) => s + d.year * d.year, 0)
    slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    intercept = (sumY - slope * sumX) / n

    const meanY = sumY / n
    const ssTot = historical.reduce((s, d) => s + Math.pow(d.count - meanY, 2), 0)
    const ssRes = historical.reduce((s, d) => s + Math.pow(d.count - (slope * d.year + intercept), 2), 0)
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  }

  // Projection years
  const lastYear = hasData ? historical[historical.length - 1].year : new Date().getFullYear()
  const lastCount = hasData ? historical[historical.length - 1].count : 0
  const projYears = [1,2,3,4,5,10].map(n => lastYear + n)
  const projCounts = projYears.map(yr => Math.round(slope * yr + intercept))
  const projected2030 = Math.round(slope * (lastYear + 4) + intercept)
  const annualGrowthRate = lastCount > 0 ? ((slope / lastCount) * 100).toFixed(1) : '—'

  const chartLabels = [
    ...historical.slice(0, -1).map(d => d.year),
    lastYear,
    ...projYears,
  ]
  const histData = [
    ...historical.slice(0, -1).map(d => d.count),
    lastCount,
    ...Array(projYears.length).fill(null),
  ]
  const projData = [
    ...Array(historical.length).fill(null),
    lastCount,
    ...projCounts,
  ]

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="📈" value={hasData ? projected2030.toLocaleString() : '—'} label={`Projected ${lastYear + 4}`} color="teal" />
        <StatCard icon="📊" value={hasData ? `${annualGrowthRate}%` : '—'} label="Annual Growth Rate" color="gold" />
        <StatCard icon="🧮" value={hasData ? `R² = ${r2.toFixed(3)}` : '—'} label="Model Fit (Linear Reg.)" color="blue" />
      </div>

      <SectionCard title="Population Growth Forecast" subtitle="Based on resident registration data + linear regression projection">
        <div className="h-72">
          {hasData ? (
            <Line
              data={{
                labels: chartLabels,
                datasets: [
                  {
                    label: 'Registered (Historical)',
                    data: histData,
                    borderColor: '#0D9E8C',
                    backgroundColor: 'rgba(13,158,140,.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#0D9E8C',
                  },
                  {
                    label: 'Projected',
                    data: projData,
                    borderColor: '#F5A623',
                    borderDash: [6, 3],
                    backgroundColor: 'rgba(245,166,35,.08)',
                    tension: 0.3,
                    fill: true,
                    pointStyle: 'triangle',
                    pointRadius: 5,
                    pointBackgroundColor: '#F5A623',
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: false } },
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center text-gray-300 text-sm px-8">
              Not enough data yet for projection.<br />Add at least 2 years' worth of resident records.
            </div>
          )}
        </div>
      </SectionCard>

      {hasData && (
        <div className="grid grid-cols-2 gap-5">
          <SectionCard title="Projection Table">
            <table className="data-table">
              <thead>
                <tr><th>Year</th><th>Projected Population</th><th>Net Growth</th><th>Confidence</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{lastYear} (actual)</td>
                  <td>{lastCount.toLocaleString()}</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                {projYears.slice(0, 5).map((yr, i) => (
                  <tr key={yr}>
                    <td>{yr}</td>
                    <td>{projCounts[i].toLocaleString()}</td>
                    <td>+{(projCounts[i] - (i === 0 ? lastCount : projCounts[i-1])).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${i < 2 ? 'badge-teal' : i < 4 ? 'badge-gold' : 'badge-gray'}`}>
                        {i < 2 ? 'High' : i < 4 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          <SectionCard title="Model Parameters">
            {[
              ['Model Type', 'Linear Regression'],
              ['R² Value', r2.toFixed(4)],
              ['Slope (β₁)', `${slope.toFixed(2)} residents/year`],
              ['Y-Intercept (β₀)', intercept.toFixed(0)],
              ['Data Points', `${historical.length} year(s)`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-500">{k}</span>
                <span className="text-[13px] font-semibold text-navy">{v}</span>
              </div>
            ))}
          </SectionCard>
        </div>
      )}
    </div>
  )
}

// ── NEEDS ASSESSMENT ──────────────────────────────────────────
export function NeedsAssessment() {
  const qc = useQueryClient()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ purok: 'Purok 1', priority_need: 'Health Services', comments: '' })

  const { data: responses = [] } = useQuery({
    queryKey: ['survey-responses'],
    queryFn: async () => {
      const { data } = await supabase.from('survey_responses').select('*')
      return data || []
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('survey_responses').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setSubmitted(true)
      qc.invalidateQueries(['survey-responses'])
    },
    onError: (e) => toast.error(e.message),
  })

  const needOptions = [
    { need: 'Health Services', icon: '🏥' },
    { need: 'Road / Infrastructure', icon: '🛣️' },
    { need: 'Educational Support', icon: '🎓' },
    { need: 'Livelihood Programs', icon: '💼' },
    { need: 'Water Supply', icon: '💧' },
    { need: 'Peace & Order', icon: '🚔' },
    { need: 'Others', icon: '📌' },
  ]

  // Count responses per need from live data
  const needCounts = needOptions.map(n => ({
    ...n,
    count: responses.filter(r => r.priority_need === n.need).length,
  }))
  const maxCount = Math.max(...needCounts.map(n => n.count), 1)
  const topNeed = needCounts.sort((a, b) => b.count - a.count)[0]

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="📋" value={responses.length} label="Survey Responses" color="teal" />
        <StatCard icon="🏆" value={responses.length > 0 ? topNeed.need.split(' ')[0] : '—'} label="Top Priority Need" color="gold" />
        <StatCard icon="🗂️" value={[...new Set(responses.map(r => r.purok))].length || 0} label="Puroks Covered" color="blue" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Priority Needs Ranking" subtitle={`Based on ${responses.length} response${responses.length !== 1 ? 's' : ''}`}>
          {responses.length > 0 ? (
            <div className="space-y-3">
              {needCounts.sort((a, b) => b.count - a.count).map(n => (
                <div key={n.need} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{n.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="text-navy font-medium">{n.need}</span>
                      <span className="text-gray-500">{n.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div
                        className="h-2 bg-teal rounded-full transition-all"
                        style={{ width: `${(n.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-300 text-sm py-8">No survey responses yet.</p>
          )}
        </SectionCard>

        <SectionCard title="Submit Survey Response" action={<span className="badge badge-teal">{responses.length} submitted</span>}>
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-navy font-semibold">Response submitted!</p>
              <p className="text-sm text-gray-400 mt-1">Thank you for your community feedback.</p>
              <button className="btn btn-ghost mt-4 text-xs" onClick={() => setSubmitted(false)}>
                Submit another
              </button>
            </div>
          ) : (
            <form
              onSubmit={e => {
                e.preventDefault()
                const sanitized = sanitizeSurveyForm(form)
                submitMutation.mutate(sanitized)
              }}
              className="space-y-3"
            >
              <div>
                <label className="form-label">Purok</label>
                <select className="form-select mt-1" value={form.purok} onChange={e => setForm({ ...form, purok: e.target.value })}>
                  {['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Top Priority Need</label>
                <select className="form-select mt-1" value={form.priority_need} onChange={e => setForm({ ...form, priority_need: e.target.value })}>
                  {needOptions.map(n => <option key={n.need}>{n.need}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Comments (Optional)</label>
                <textarea
                  className="form-input mt-1"
                  rows={3}
                  placeholder="Share your community concerns..."
                  value={form.comments}
                  onChange={e => setForm({ ...form, comments: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? 'Submitting...' : 'Submit Response'}
              </button>
            </form>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ── DILG REPORTS ──────────────────────────────────────────────
export function DILGReports() {
  const [preview, setPreview] = useState(null)

  // Pull live data for reports
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-report'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*')
      return data || []
    },
  })

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-report'],
    queryFn: async () => {
      const { data } = await supabase.from('incidents').select('*')
      return data || []
    },
  })

  const { data: beneficiaries = [] } = useQuery({
    queryKey: ['beneficiaries-report'],
    queryFn: async () => {
      const { data } = await supabase.from('beneficiaries').select('*, assistance_programs(name)')
      return data || []
    },
  })

  const total = residents.length
  const now = new Date()
  const getAge = dob => Math.floor((now - new Date(dob)) / 31557600000)
  const males = residents.filter(r => r.sex === 'Male').length
  const females = residents.filter(r => r.sex === 'Female').length
  const seniors = residents.filter(r => r.is_senior_citizen).length
  const pwds = residents.filter(r => r.is_pwd).length
  const soloParents = residents.filter(r => r.is_solo_parent).length
  const hhHeads = residents.filter(r => r.is_household_head).length
  const poorHH = residents.filter(r => r.is_household_head && (r.monthly_income || 0) < 10000).length
  const povertyRate = hhHeads > 0 ? ((poorHH / hhHeads) * 100).toFixed(1) : '—'
  const activeBen = beneficiaries.filter(b => b.status === 'Active').length
  const totalReleased = beneficiaries.reduce((s, b) => s + (b.total_released || 0), 0)
  const resolvedInc = incidents.filter(i => i.status === 'Resolved').length
  const resRate = incidents.length > 0 ? Math.round((resolvedInc / incidents.length) * 100) : 0
  const year = now.getFullYear()

  // Dynamic report data built from live Supabase values
  const previewData = {
    barangay: [
      ['Total Registered Population', total.toLocaleString()],
      ['Total Household Heads', hhHeads.toString()],
      ['Male', `${males} (${total ? ((males/total)*100).toFixed(1) : 0}%)`],
      ['Female', `${females} (${total ? ((females/total)*100).toFixed(1) : 0}%)`],
      ['Senior Citizens', `${seniors} (${total ? ((seniors/total)*100).toFixed(1) : 0}%)`],
      ['Persons with Disability (PWD)', `${pwds} (${total ? ((pwds/total)*100).toFixed(1) : 0}%)`],
      ['Solo Parents', `${soloParents} (${total ? ((soloParents/total)*100).toFixed(1) : 0}%)`],
      ['Poverty Incidence (HH Heads < ₱10K)', `${povertyRate}%`],
      ['Number of Puroks', '5'],
      ['Report Period', `CY ${year}`],
    ],
    cbms: [
      ['Total Population', total.toLocaleString()],
      ['Senior Citizens', seniors.toString()],
      ['PWD', pwds.toString()],
      ['Solo Parents', soloParents.toString()],
      ['HH Heads below poverty line', poorHH.toString()],
      ['Active Beneficiaries', activeBen.toString()],
      ['Total Assistance Distributed', `₱${totalReleased.toLocaleString()}`],
    ],
    peace: [
      ['Total Incidents (YTD)', incidents.length.toString()],
      ['Ongoing Cases', incidents.filter(i => i.status === 'Ongoing').length.toString()],
      ['Resolved Cases', resolvedInc.toString()],
      ['Escalated Cases', incidents.filter(i => i.status === 'Escalated').length.toString()],
      ['Resolution Rate', `${resRate}%`],
      ['Most Common Type', (() => {
        if (!incidents.length) return '—'
        const counts = {}
        incidents.forEach(i => { counts[i.incident_type] = (counts[i.incident_type] || 0) + 1 })
        return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—'
      })()],
    ],
    assist: [
      ['Active Beneficiaries', activeBen.toString()],
      ['Pending Claims', beneficiaries.filter(b => b.status === 'Pending').length.toString()],
      ['Completed', beneficiaries.filter(b => b.status === 'Completed').length.toString()],
      ['Total Distributed', `₱${totalReleased.toLocaleString()}`],
      ['Report Period', `CY ${year}`],
    ],
    sector: [
      ['Senior Citizens', `${seniors} (${total ? ((seniors/total)*100).toFixed(1) : 0}%)`],
      ['Solo Parents', `${soloParents} (${total ? ((soloParents/total)*100).toFixed(1) : 0}%)`],
      ['Persons with Disability', `${pwds} (${total ? ((pwds/total)*100).toFixed(1) : 0}%)`],
      ['Report Period', `CY ${year}`],
    ],
    disaster: [
      ['Typhoon Risk Level', 'High'],
      ['Flood Risk Level', 'Medium'],
      ['Landslide Risk Level', 'Low'],
      ['Total Households', hhHeads.toString()],
      ['Report Period', `CY ${year}`],
    ],
  }

  const reports = [
    { id: 'barangay', icon: '🏛️', title: 'Barangay Profile Report', desc: 'Demographic and socioeconomic profile', badge: 'DILG Standard', badgeColor: 'teal' },
    { id: 'cbms', icon: '📊', title: 'CBMS Statistical Report', desc: 'Community-Based Monitoring System', badge: 'Required', badgeColor: 'blue' },
    { id: 'peace', icon: '🛡️', title: 'Peace & Order Report', desc: 'Crime statistics and incident summary', badge: 'Quarterly', badgeColor: 'red' },
    { id: 'assist', icon: '🎁', title: 'Assistance & Beneficiary Report', desc: 'Distribution records and program status', badge: 'Monthly', badgeColor: 'gold' },
    { id: 'sector', icon: '♿', title: 'Vulnerable Sector Report', desc: 'SC, Solo Parent, PWD statistics', badge: 'Semi-Annual', badgeColor: 'gray' },
    { id: 'disaster', icon: '🌀', title: 'Disaster Risk Assessment', desc: 'Vulnerability mapping and evacuation data', badge: 'Annual', badgeColor: 'gold' },
  ]

  const activeReport = reports.find(r => r.id === preview)

  return (
    <div>
      <SectionCard title="Automated DILG Report Generation" subtitle="All figures pulled live from your Supabase database">
        <div className="grid grid-cols-2 gap-3">
          {reports.map(r => (
            <div
              key={r.id}
              className="border border-gray-200 rounded-xl p-4 flex gap-3 items-start cursor-pointer hover:border-teal hover:bg-teal-50/50 transition-all"
              onClick={() => setPreview(r.id)}
            >
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">{r.icon}</div>
              <div>
                <div className="font-semibold text-[13px] text-navy">{r.title}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{r.desc}</div>
                <span className={`badge badge-${r.badgeColor} mt-1.5`}>{r.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {preview && activeReport && (
        <SectionCard
          title={`${activeReport.title} — Preview`}
          subtitle={`Auto-generated from live data · ${now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}`}
          action={
            <div className="flex gap-2">
              <button
                className="btn btn-ghost text-xs"
                onClick={() => exportToPDF({ title: activeReport.title, rows: previewData[preview] || [] })}
              >
                📄 Export PDF
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => setPreview(null)}>✕ Close</button>
            </div>
          }
        >
          <div className="bg-gray-50 rounded-xl p-6 border">
            <div className="text-center mb-5 pb-4 border-b-2 border-navy">
              <div className="text-[11px] text-gray-400 uppercase tracking-widest">Republic of the Philippines</div>
              <div className="text-[11px] text-gray-400">Province of Batanes · Municipality of Basco</div>
              <h2 className="font-display text-lg font-bold text-navy mt-2">{activeReport.title.toUpperCase()}</h2>
              <p className="text-sm text-gray-400 mt-1">Barangay Kayvaluganan · CY {year}</p>
            </div>
            <table className="data-table">
              <thead><tr><th>Indicator</th><th>Value</th></tr></thead>
              <tbody>
                {(previewData[preview] || []).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td><strong>{v}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// Shared empty state
function Empty({ message = 'No data yet' }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-300 text-sm">
      {message}
    </div>
  )
}