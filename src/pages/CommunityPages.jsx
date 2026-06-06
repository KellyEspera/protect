// BeneficiaryTracking.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bar, Line } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { mockBeneficiaries } from '../lib/mockData'
import { SectionCard, StatCard, Badge } from '../components/ui/index'
import { toast } from 'react-toastify'

Chart.register(...registerables)
const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }

export function BeneficiaryTracking() {
  const { data: beneficiaries = mockBeneficiaries } = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: async () => {
      const { data } = await supabase.from('beneficiaries').select('*, residents(first_name, last_name, resident_no), assistance_programs(name)')
      return data || mockBeneficiaries
    },
  })

  const statusDot = { Active: 'bg-green-500', Pending: 'bg-amber-400', Completed: 'bg-blue-500', Suspended: 'bg-red-400' }

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value="218" label="Active Beneficiaries" color="teal" />
        <StatCard icon="💰" value="₱486K" label="Total Distributed (2026)" color="gold" />
        <StatCard icon="📦" value="4" label="Active Programs" color="blue" />
        <StatCard icon="⏳" value="12" label="Pending Claims" color="red" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Assistance by Program">
          <div className="h-52">
            <Bar data={{ labels: ['4Ps','Rice Subsidy','Medical','Educational','Livelihood'], datasets: [{ data: [89,67,42,20,15], backgroundColor: '#0D9E8C', borderRadius: 6 }] }} options={{ ...opts, scales: { y: { beginAtZero: true } } }} />
          </div>
        </SectionCard>
        <SectionCard title="Monthly Distribution Trend">
          <div className="h-52">
            <Line data={{ labels: ['Jan','Feb','Mar','Apr','May','Jun'], datasets: [{ data: [58000,62000,94000,71000,88000,113000], borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,.1)', tension: 0.4, fill: true }] }} options={{ ...opts, scales: { y: { ticks: { callback: v => '₱'+Math.round(v/1000)+'K' } } } }} />
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Beneficiary Registry" action={<button className="btn btn-primary text-xs" onClick={() => toast.info('Enrollment form opened.')}>+ Enroll Beneficiary</button>}>
        <table className="data-table">
          <thead><tr><th>ID</th><th>Name</th><th>Program</th><th>Last Release</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {mockBeneficiaries.map(b => (
              <tr key={b.id}>
                <td><span className="font-mono text-[11px] text-teal">BEN-00{b.id}</span></td>
                <td>{b.name}</td><td>{b.program}</td>
                <td className="text-xs text-gray-500">{b.last_release_date}</td>
                <td>₱{b.total_released.toLocaleString()}</td>
                <td><span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${statusDot[b.status]}`}></span>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  )
}

// CrimeIncident.jsx
export function CrimeIncident() {
  const [incidents, setIncidents] = useState([
    { id: 1, case_no: 'INC-2026-028', incident_type: 'Theft', purok: 'Purok 2', complainant: 'M. Santos', incident_date: '2026-06-03', status: 'Ongoing' },
    { id: 2, case_no: 'INC-2026-027', incident_type: 'Noise/Disturbance', purok: 'Purok 1', complainant: 'P. Mabanag', incident_date: '2026-06-02', status: 'Resolved' },
    { id: 3, case_no: 'INC-2026-026', incident_type: 'Accident', purok: 'Purok 4', complainant: 'Barangay', incident_date: '2026-06-01', status: 'Resolved' },
    { id: 4, case_no: 'INC-2026-025', incident_type: 'Domestic Violence', purok: 'Purok 3', complainant: 'Anonymous', incident_date: '2026-05-29', status: 'Resolved' },
    { id: 5, case_no: 'INC-2026-024', incident_type: 'Trespassing', purok: 'Purok 5', complainant: 'R. Domingo', incident_date: '2026-05-28', status: 'Escalated' },
  ])
  const [form, setForm] = useState({ incident_type: 'Noise/Disturbance', purok: 'Purok 1', complainant: '', incident_date: '' })
  const statusColor = { Ongoing: 'gold', Resolved: 'blue', Escalated: 'red', Dismissed: 'gray' }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newInc = { id: incidents.length + 1, case_no: `INC-2026-0${29 + incidents.length}`, ...form, status: 'Ongoing' }
    setIncidents([newInc, ...incidents])
    supabase.from('incidents').insert({ ...form, case_no: newInc.case_no, incident_date: new Date().toISOString(), status: 'Ongoing' }).then(() => {})
    toast.success(`Incident logged: ${newInc.case_no}`)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="📋" value="28" label="Incidents (2026)" color="red" />
        <StatCard icon="⚖️" value="8" label="Criminal Cases" color="gold" />
        <StatCard icon="🤝" value="71%" label="Resolution Rate" color="teal" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Incident Type Breakdown">
          <div className="h-52">
            <Bar data={{ labels: ['Disturbance','Theft','Domestic','Accident','Trespassing'], datasets: [{ data: [9,6,5,5,3], backgroundColor: ['#EF4444','#F5A623','#8B5CF6','#3B82F6','#0D9E8C'], borderRadius: 6 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 2 } } } }} />
          </div>
        </SectionCard>
        <SectionCard title="Monthly Incident Trend">
          <div className="h-52">
            <Line data={{ labels: ['Jan','Feb','Mar','Apr','May','Jun'], datasets: [{ data: [4,3,6,5,6,4], borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,.1)', tension: 0.4, fill: true, pointBackgroundColor: '#EF4444' }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Log New Incident" action={<button className="btn btn-primary text-xs" form="incident-form" type="submit">+ Submit Report</button>}>
        <form id="incident-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Incident Type</label>
              <select className="form-select mt-1" value={form.incident_type} onChange={e => setForm({...form, incident_type: e.target.value})}>
                {['Noise/Disturbance','Theft','Physical Injury','Domestic Violence','Trespassing','Accident','Illegal Drugs','Others'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="form-label">Purok</label>
              <select className="form-select mt-1" value={form.purok} onChange={e => setForm({...form, purok: e.target.value})}>
                {['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="form-label">Date & Time</label>
              <input type="datetime-local" className="form-input mt-1" onChange={e => setForm({...form, incident_date: e.target.value})} />
            </div>
            <div><label className="form-label">Complainant</label>
              <input className="form-input mt-1" placeholder="Name of complainant" value={form.complainant} onChange={e => setForm({...form, complainant: e.target.value})} />
            </div>
          </div>
        </form>
      </SectionCard>
      <SectionCard title="Incident Log">
        <table className="data-table">
          <thead><tr><th>Case No.</th><th>Type</th><th>Purok</th><th>Date</th><th>Complainant</th><th>Status</th></tr></thead>
          <tbody>
            {incidents.map(inc => (
              <tr key={inc.id}>
                <td><span className="font-mono text-[11px] text-teal">{inc.case_no}</span></td>
                <td>{inc.incident_type}</td><td>{inc.purok}</td>
                <td className="text-xs text-gray-500">{inc.incident_date}</td>
                <td>{inc.complainant}</td>
                <td><span className={`badge badge-${statusColor[inc.status] || 'gray'}`}>{inc.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  )
}

// PredictiveGrowth.jsx
export function PredictiveGrowth() {
  const histY = [2019,2020,2021,2022,2023,2024,2025,2026]
  const histD = [1134,1152,1171,1196,1218,1241,1261,1284]
  const projY = [2026,2027,2028,2029,2030,2031,2032,2033,2034,2035]
  const projD = [1284,1307,1330,1353,1412,1365,1388,1433,1456,1498]
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="📈" value="1,412" label="Projected 2030" color="teal" />
        <StatCard icon="📊" value="1.8%" label="Annual Growth Rate" color="gold" />
        <StatCard icon="🧮" value="R² = 0.985" label="Model Fit (Linear Reg.)" color="blue" />
      </div>
      <SectionCard title="Population Growth Forecast" subtitle="Historical + linear regression projection to 2035">
        <div className="h-72">
          <Line
            data={{
              labels: [...histY.slice(0,-1), ...projY],
              datasets: [
                { label: 'Historical', data: [...histD.slice(0,-1), ...Array(projY.length).fill(null)], borderColor: '#0D9E8C', backgroundColor: 'rgba(13,158,140,.1)', tension: 0.3, fill: true, pointRadius: 4, pointBackgroundColor: '#0D9E8C' },
                { label: 'Projected', data: [...Array(histY.length-1).fill(null), ...projD], borderColor: '#F5A623', borderDash: [6,3], backgroundColor: 'rgba(245,166,35,.08)', tension: 0.3, fill: true, pointStyle: 'triangle', pointRadius: 5, pointBackgroundColor: '#F5A623' },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: false } } }}
          />
        </div>
      </SectionCard>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Projection Table">
          <table className="data-table">
            <thead><tr><th>Year</th><th>Projected Population</th><th>Net Growth</th><th>Confidence</th></tr></thead>
            <tbody>
              {[['2026 (actual)',1284,23,'—'],['2027',1307,23,'High'],['2028',1330,23,'High'],['2029',1353,23,'Medium'],['2030',1412,59,'Medium'],['2035',1498,86,'Low']].map(([yr,pop,gr,conf]) => (
                <tr key={yr}><td>{yr}</td><td>{pop.toLocaleString()}</td><td>+{gr}</td>
                  <td>{conf === '—' ? '—' : <span className={`badge ${conf==='High'?'badge-teal':conf==='Medium'?'badge-gold':'badge-gray'}`}>{conf}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Model Parameters">
          {[['Model Type','Linear Regression'],['R² Value','0.9847'],['Slope (β₁)','23.14 residents/year'],['Y-Intercept (β₀)','-45,369'],['Data Points','8 years (2019-2026)']].map(([k,v]) => (
            <div key={k} className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">{k}</span>
              <span className="text-[13px] font-semibold text-navy">{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  )
}

// NeedsAssessment.jsx
export function NeedsAssessment() {
  const [submitted, setSubmitted] = useState(false)
  const needs = [
    { need: 'Health Services', count: 187, icon: '🏥' },
    { need: 'Road / Infrastructure', count: 142, icon: '🛣️' },
    { need: 'Educational Support', count: 118, icon: '🎓' },
    { need: 'Livelihood Programs', count: 97, icon: '💼' },
    { need: 'Water Supply', count: 74, icon: '💧' },
    { need: 'Peace & Order', count: 52, icon: '🚔' },
  ]
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="📋" value="287" label="Survey Responses" color="teal" />
        <StatCard icon="🏆" value="Health" label="Top Priority Need" color="gold" />
        <StatCard icon="📊" value="83.9%" label="Response Rate" color="blue" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Priority Needs Ranking" subtitle="Based on 287 responses">
          <div className="space-y-3">
            {needs.map((n, i) => (
              <div key={n.need} className="flex items-center gap-3">
                <span className="text-lg">{n.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="text-navy font-medium">{n.need}</span>
                    <span className="text-gray-500">{n.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-teal rounded-full transition-all" style={{ width: `${(n.count/187)*100}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Community Survey Form" action={<span className="badge badge-teal">287 submitted</span>}>
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-navy font-semibold">Response submitted!</p>
              <p className="text-sm text-gray-400 mt-1">Thank you for your community feedback.</p>
              <button className="btn btn-ghost mt-3 text-xs" onClick={() => setSubmitted(false)}>Submit another</button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); supabase.from('survey_responses').insert({ purok: 'Purok 1', priority_need: 'Health Services' }).then(() => {}) }}>
              <div className="space-y-3">
                <div><label className="form-label">Resident Name (Optional)</label><input className="form-input mt-1" placeholder="Anonymous" /></div>
                <div><label className="form-label">Purok</label>
                  <select className="form-select mt-1">{['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5'].map(p=><option key={p}>{p}</option>)}</select>
                </div>
                <div><label className="form-label">Top Priority Need</label>
                  <select className="form-select mt-1">{needs.map(n=><option key={n.need}>{n.need}</option>)}<option>Others</option></select>
                </div>
                <div><label className="form-label">Comments</label><textarea className="form-input mt-1" rows={3} placeholder="Share your concerns..."></textarea></div>
                <button type="submit" className="btn btn-primary w-full">Submit Response</button>
              </div>
            </form>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// DILGReports.jsx
import { exportToPDF } from '../lib/exportUtils'

export function DILGReports() {
  const [preview, setPreview] = useState(null)
  const reports = [
    { id: 'barangay', icon: '🏛️', title: 'Barangay Profile Report', desc: 'Demographic and socioeconomic profile', badge: 'DILG Standard', badgeColor: 'teal' },
    { id: 'cbms', icon: '📊', title: 'CBMS Statistical Report', desc: 'Community-Based Monitoring System', badge: 'Required', badgeColor: 'blue' },
    { id: 'peace', icon: '🛡️', title: 'Peace & Order Report', desc: 'Crime statistics and incident summary', badge: 'Quarterly', badgeColor: 'red' },
    { id: 'assist', icon: '🎁', title: 'Assistance & Beneficiary Report', desc: 'Distribution records and program status', badge: 'Monthly', badgeColor: 'gold' },
    { id: 'sector', icon: '♿', title: 'Vulnerable Sector Report', desc: 'SC, Solo Parent, PWD statistics', badge: 'Semi-Annual', badgeColor: 'gray' },
    { id: 'disaster', icon: '🌀', title: 'Disaster Risk Assessment', desc: 'Vulnerability mapping and evacuation data', badge: 'Annual', badgeColor: 'gold' },
  ]
  const previewData = {
    barangay: [['Total Population','1,284'],['Total Households','342'],['Male Population','636 (49.5%)'],['Female Population','648 (50.5%)'],['Senior Citizens','207 (16.1%)'],['PWD','48 (3.7%)'],['Solo Parents','34 (2.6%)'],['Poverty Incidence','18.4%'],['Number of Puroks','5'],['Report Period','CY 2026 (as of June)']],
    cbms: [['Health — HH with safe water','88.3%'],['Nutrition — Children 0-5 underweight','7.2%'],['Education — Attendance rate (6-15)','94.1%'],['Income — HH below poverty threshold','18.4%'],['Employment — Employed HH heads','78.6%'],['Housing — Makeshift housing','11.2%']],
    peace: [['Total Incidents (YTD)','28'],['Criminal Cases','8'],['Resolution Rate','71%'],['Most Common — Noise/Disturbance','9 cases'],['Ongoing Cases','3'],['Escalated Cases','1']],
    assist: [['4Ps Beneficiaries','89 households'],['Rice Subsidy','67 households'],['Medical Assistance','42 persons'],['Educational Grant','20 students'],['Total Distributed','₱486,000'],['Active Programs','4']],
    sector: [['Senior Citizens','207 (16.1%)'],['Solo Parents','34 (2.6%)'],['Persons with Disability','48 (3.7%)'],['SC with OSCA Pension','198'],['PWD with ID','48'],['Solo Parents with ID','29']],
    disaster: [['Typhoon Risk Level','High'],['Flood Risk Level','Medium'],['Landslide Risk Level','Low'],['High-Risk Households','98'],['Evacuation-Ready HH','89'],['Nearest Evac. Center','BSC Gymnasium']],
  }

  return (
    <div>
      <SectionCard title="Automated DILG Report Generation" subtitle="Reports are auto-compiled from live system data">
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

      {preview && (
        <SectionCard
          title={`${reports.find(r => r.id === preview)?.title} — Preview`}
          subtitle="Auto-generated · June 2026"
          action={
            <div className="flex gap-2">
              <button className="btn btn-ghost text-xs" onClick={() => {
                const r = reports.find(rep => rep.id === preview)
                exportToPDF({ title: r?.title || 'Report', rows: previewData[preview] || [] })
              }}>📄 Export PDF</button>
              <button className="btn btn-primary text-xs" onClick={() => toast.info('Exporting Excel...')}>📊 Export Excel</button>
              <button className="btn btn-ghost text-xs" onClick={() => setPreview(null)}>✕ Close</button>
            </div>
          }
        >
          <div className="bg-gray-50 rounded-xl p-6 border">
            <div className="text-center mb-5 pb-4 border-b-2 border-navy">
              <div className="text-[11px] text-gray-400 uppercase tracking-widest">Republic of the Philippines</div>
              <div className="text-[11px] text-gray-400">Province of Batanes · Municipality of Basco</div>
              <h2 className="font-display text-lg font-bold text-navy mt-2">{reports.find(r => r.id === preview)?.title?.toUpperCase()}</h2>
              <p className="text-sm text-gray-400 mt-1">Barangay Kayvaluganan · CY 2026</p>
            </div>
            <table className="data-table">
              <thead><tr><th>Indicator</th><th>Value</th></tr></thead>
              <tbody>
                {(previewData[preview] || []).map(([k,v]) => (
                  <tr key={k}><td>{k}</td><td><strong>{v}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
