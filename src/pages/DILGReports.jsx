// ============================================================================
//  DILGReports.jsx  —  "DILG Report Generation" page
// ----------------------------------------------------------------------------
//  Compiles standard barangay reports (Barangay Profile, Peace & Order,
//  Assistance, Vulnerable Sector, Disaster Risk, etc.) with figures pulled
//  LIVE from Supabase, and exports them to PDF with the official letterhead.
//  These are the documents the barangay submits to the DILG (the DILG is the
//  external recipient — it does not log into the system).
//  (Activity Log + Database Backup were moved to AdminTools.jsx.)
// ============================================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard } from '../components/ui/index'
import { exportToPDF } from '../lib/exportUtils'

export default function DILGReports() {
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

  // Disaster risk zones — drives the live Disaster Risk Assessment report
  const { data: riskZones = [] } = useQuery({
    queryKey: ['risk-zones-report'],
    queryFn: async () => {
      const { data } = await supabase.from('disaster_risk_zones').select('hazard_type, risk_level')
      return data || []
    },
  })

  // For each hazard, report the HIGHEST risk level found among its zones.
  const RISK_RANK = { High: 3, Medium: 2, Low: 1 }
  const highestRisk = (hazard) => {
    const zs = riskZones.filter(z => z.hazard_type === hazard)
    if (!zs.length) return 'Not assessed'
    const max = Math.max(...zs.map(z => RISK_RANK[z.risk_level] || 0))
    return Object.keys(RISK_RANK).find(k => RISK_RANK[k] === max) || '—'
  }

  // ---- Derived figures used to fill the report tables ----
  const total = residents.length
  const now = new Date()
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

  // Each report's rows, built from the live values above.
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
      ['Number of Sitios', '3'],
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
      ['Typhoon Risk Level', highestRisk('Typhoon')],
      ['Flood Risk Level', highestRisk('Flood')],
      ['Landslide Risk Level', highestRisk('Landslide')],
      ['Storm Surge Risk Level', highestRisk('Storm Surge')],
      ['Total Risk Zones Mapped', riskZones.length.toString()],
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <p className="text-sm text-gray-400 mt-1">Barangay San Joaquin · CY {year}</p>
            </div>
            <div className="overflow-x-auto"><table className="data-table">
              <thead><tr><th>Indicator</th><th>Value</th></tr></thead>
              <tbody>
                {(previewData[preview] || []).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td><strong>{v}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
