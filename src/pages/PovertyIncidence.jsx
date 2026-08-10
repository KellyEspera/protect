// ============================================================================
//  PovertyIncidence.jsx  —  "Poverty Incidence Analytics" page
// ----------------------------------------------------------------------------
//  Measures economic vulnerability using FAMILY income (the combined income of
//  everyone in a household), not individual income — because a household's
//  welfare depends on its total earnings. A household is "poor" if its family
//  income is below the ₱10,000/month poverty line.
// ============================================================================

import { useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { SectionCard, StatCard } from '../components/ui/index'
import { useResidents } from '../hooks/useResidents'
import { exportToPDF } from '../lib/exportUtils'
import { Download } from 'lucide-react'

Chart.register(...registerables)
const noLeg = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const SITIO_COLORS = {
  'Sitio Hunan': '#0D9E8C',
  'Sitio Hagu': '#F5A623',
  'Sitio Tuva': '#3B82F6',
}

export default function PovertyIncidence() {
  const { data: residents = [] } = useResidents()
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedExportSections, setSelectedExportSections] = useState(['summary','poverty','income','households'])

  const exportSections = [
    { key: 'summary', label: 'Summary metrics' },
    { key: 'poverty', label: 'Poverty rate by sitio' },
    { key: 'income', label: 'Income classification' },
    { key: 'households', label: 'Households below poverty line' },
  ]

  const toggleExportSection = key => {
    setSelectedExportSections(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key])
  }

  const total = residents.length
  const poorThreshold = 10000

  // Build a lookup: household_id → total income of all its members.
  // We loop once over every resident and add their income into their household's bucket.
  const hhIncomeMap = {}
  residents.forEach(r => {
    if (r.household_id) {
      hhIncomeMap[r.household_id] = (hhIncomeMap[r.household_id] || 0) + (r.monthly_income || 0)
    }
  })

  // A resident's "family income" = their household's total. If they have no
  // household linked, fall back to just their own income.
  const getFamilyIncome = r =>
    r.household_id ? (hhIncomeMap[r.household_id] || 0) : (r.monthly_income || 0)

  const hhHeadsList = residents.filter(r => r.is_household_head)
  const hhHeads = hhHeadsList.length
  const poorHH = hhHeadsList.filter(r => getFamilyIncome(r) < poorThreshold).length
  const avgIncome = total > 0
    ? Math.round(residents.reduce((s, r) => s + (r.monthly_income || 0), 0) / total)
    : 0
  const povertyRate = hhHeads > 0 ? ((poorHH / hhHeads) * 100).toFixed(1) : '0'

  const sitioLabels = ['Sitio Hunan','Sitio Hagu','Sitio Tuva']
  const sitioPoverty = sitioLabels.map(p => {
    const hhInSitio = hhHeadsList.filter(r => r.sitio === p)
    if (!hhInSitio.length) return 0
    return Math.round((hhInSitio.filter(r => getFamilyIncome(r) < poorThreshold).length / hhInSitio.length) * 100)
  })

  // People living in poor households (every resident whose family income is below the line)
  const peopleInPoverty = residents.filter(r => getFamilyIncome(r) < poorThreshold).length

  // Average family income across all registered households
  const avgFamilyIncome = hhHeads > 0
    ? Math.round(hhHeadsList.reduce((s, r) => s + getFamilyIncome(r), 0) / hhHeads)
    : 0

  // Sitio with the highest poverty rate
  const maxPovertyIdx   = sitioPoverty.indexOf(Math.max(...sitioPoverty))
  const mostAffectedRate = sitioPoverty[maxPovertyIdx] || 0
  const mostAffectedSitio = (total > 0 && mostAffectedRate > 0)
    ? sitioLabels[maxPovertyIdx].replace('Sitio ', '')
    : '—'

  // Income classification by family income, relative to the ₱10,000 poverty line
  const incomeClassification = [
    hhHeadsList.filter(r => getFamilyIncome(r) < 10000).length,
    hhHeadsList.filter(r => { const f = getFamilyIncome(r); return f >= 10000 && f < 20000 }).length,
    hhHeadsList.filter(r => { const f = getFamilyIncome(r); return f >= 20000 && f < 40000 }).length,
    hhHeadsList.filter(r => getFamilyIncome(r) >= 40000).length,
  ]
  const incomeBrackets = [
    { label: 'Poor',          sub: 'below ₱10K (poverty line)', color: '#EF4444', count: incomeClassification[0] },
    { label: 'Low income',    sub: '₱10K–₱20K · 1–2× line',     color: '#F5A623', count: incomeClassification[1] },
    { label: 'Lower-middle',  sub: '₱20K–₱40K · 2–4× line',     color: '#3B82F6', count: incomeClassification[2] },
    { label: 'Middle & up',   sub: '₱40K+ · 4×+ line',          color: '#0D9E8C', count: incomeClassification[3] },
  ]

  const poorResidents = hhHeadsList
    .filter(r => getFamilyIncome(r) < poorThreshold)
    .map(r => ({ ...r, family_income: getFamilyIncome(r) }))
    .slice(0, 10)

  const handleExportPDF = () => {
    const rows = []

    if (selectedExportSections.includes('summary')) {
      rows.push(['Poverty Incidence (Family Income)', `${povertyRate}%`])
      rows.push(['Poor Households (< ₱10,000)', String(poorHH)])
      rows.push(['Average Family Income', `₱${avgFamilyIncome.toLocaleString()}`])
      rows.push(['Most Affected Sitio', mostAffectedSitio + (mostAffectedRate ? ` (${mostAffectedRate}%)` : '')])
      rows.push(['People in Poverty', String(peopleInPoverty)])
      rows.push(['Registered Household Heads', String(hhHeads)])
      rows.push(['Average Individual Income', `₱${avgIncome.toLocaleString()}`])
    }

    if (selectedExportSections.includes('poverty')) {
      rows.push(...sitioLabels.map((p, i) => [`Poverty Rate — ${p}`, `${sitioPoverty[i]}%`]))
    }

    if (selectedExportSections.includes('income')) {
      rows.push(...incomeBrackets.map(b => [`${b.label} (${b.sub})`, String(b.count)]))
    }

    if (selectedExportSections.includes('households')) {
      rows.push(...poorResidents.map(r => [`Below Poverty Line — ${r.first_name} ${r.last_name}`, `${r.sitio} · ₱${(r.family_income || 0).toLocaleString()}`]))
    }

    if (rows.length > 0) {
      exportToPDF({ title: 'Poverty Incidence Report', requireConfirmation: true, rows })
      setShowExportMenu(false)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3 relative">
        <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={() => setShowExportMenu(prev => !prev)} disabled={total === 0}>
          <Download size={13} /> Export PDF
        </button>

        {showExportMenu && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg z-20">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Choose sections</div>
            <div className="space-y-2">
              {exportSections.map(section => (
                <label key={section.key} className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    checked={selectedExportSections.includes(section.key)}
                    onChange={() => toggleExportSection(section.key)}
                  />
                  <span>{section.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button className="text-xs text-teal font-medium" onClick={() => setSelectedExportSections(exportSections.map(section => section.key))}>Select all</button>
              <button className="btn btn-ghost text-[11px] px-3 py-1.5" onClick={handleExportPDF}>Export selected</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="🤝" value={`${povertyRate}%`} label="Poverty Incidence (Family Income)" color="red" />
        <StatCard icon="🏚️" value={poorHH} label="Poor Households (< ₱10,000)" color="gold" />
        <StatCard icon="👨‍👩‍👧" value={`₱${avgFamilyIncome.toLocaleString()}`} label="Avg Family Income" color="teal" />
        <StatCard icon="👥" value={peopleInPoverty.toLocaleString()} label="People in Poverty" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Poverty Rate by Sitio" subtitle="% of HH heads below ₱10,000/mo">
          <div className="h-52">
            {total > 0 ? (
              <Bar
                data={{ labels: sitioLabels, datasets: [{ data: sitioPoverty, backgroundColor: sitioLabels.map(label => SITIO_COLORS[label] || '#0D9E8C'), borderRadius: 6 }] }}
                options={{ ...noLeg, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v+'%' } } } }}
              />
            ) : <Empty />}
          </div>
        </SectionCard>

        <SectionCard title="Income Classification" subtitle="Households by family income, relative to the ₱10,000 poverty line">
          {total > 0 ? (
            <>
              <div className="h-40">
                <Doughnut
                  data={{
                    labels: incomeBrackets.map(b => b.label),
                    datasets: [{ data: incomeClassification, backgroundColor: incomeBrackets.map(b => b.color) }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
              <div className="mt-3 space-y-1.5">
                {incomeBrackets.map(b => {
                  const pct = hhHeads > 0 ? Math.round((b.count / hhHeads) * 100) : 0
                  return (
                    <div key={b.label} className="flex items-center gap-2 text-[12px]">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                      <span className="flex-1 text-navy font-medium">
                        {b.label} <span className="text-gray-400 font-normal">· {b.sub}</span>
                      </span>
                      <span className="text-gray-500 flex-shrink-0">{b.count} <span className="text-gray-400">({pct}%)</span></span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : <Empty />}
        </SectionCard>
      </div>

      <SectionCard title="Household Heads Below Poverty Line" action={<span className="badge badge-red">{poorHH} households</span>}>
        {poorResidents.length > 0 ? (
          <div className="overflow-x-auto"><table className="data-table">
            <thead><tr><th>Name</th><th>Sitio</th><th>Family Income</th><th>PWD</th><th>Solo Parent</th><th>Senior</th></tr></thead>
            <tbody>
              {poorResidents.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.first_name} {r.last_name}</strong></td>
                  <td>{r.sitio}</td>
                  <td>₱{(r.family_income || 0).toLocaleString()}</td>
                  <td>{r.is_pwd ? <span className="badge badge-gold">Yes</span> : 'No'}</td>
                  <td>{r.is_solo_parent ? <span className="badge badge-teal">Yes</span> : 'No'}</td>
                  <td>{r.is_senior_citizen ? <span className="badge badge-blue">Yes</span> : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No data yet. Add residents with income information.</p>
        )}
      </SectionCard>
    </div>
  )
}

function Empty({ message = 'No data yet' }) {
  return <div className="h-full flex items-center justify-center text-gray-300 text-sm">{message}</div>
}
