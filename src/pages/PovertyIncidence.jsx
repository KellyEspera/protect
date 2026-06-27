// ============================================================================
//  PovertyIncidence.jsx  —  "Poverty Incidence Analytics" page
// ----------------------------------------------------------------------------
//  Measures economic vulnerability using FAMILY income (the combined income of
//  everyone in a household), not individual income — because a household's
//  welfare depends on its total earnings. A household is "poor" if its family
//  income is below the ₱10,000/month poverty line.
// ============================================================================

import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { SectionCard, StatCard } from '../components/ui/index'
import { useResidents } from '../hooks/useResidents'
import { exportToPDF } from '../lib/exportUtils'
import { Download } from 'lucide-react'

Chart.register(...registerables)
const noLeg = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }

export default function PovertyIncidence() {
  const { data: residents = [] } = useResidents()

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

  const purokLabels = ['Sitio Hunan','Sitio Hagu','Sitio Tuva']
  const purokPoverty = purokLabels.map(p => {
    const hhInPurok = hhHeadsList.filter(r => r.purok === p)
    if (!hhInPurok.length) return 0
    return Math.round((hhInPurok.filter(r => getFamilyIncome(r) < poorThreshold).length / hhInPurok.length) * 100)
  })

  // People living in poor households (every resident whose family income is below the line)
  const peopleInPoverty = residents.filter(r => getFamilyIncome(r) < poorThreshold).length

  // Average family income across all registered households
  const avgFamilyIncome = hhHeads > 0
    ? Math.round(hhHeadsList.reduce((s, r) => s + getFamilyIncome(r), 0) / hhHeads)
    : 0

  // Sitio with the highest poverty rate
  const maxPovertyIdx   = purokPoverty.indexOf(Math.max(...purokPoverty))
  const mostAffectedRate = purokPoverty[maxPovertyIdx] || 0
  const mostAffectedSitio = (total > 0 && mostAffectedRate > 0)
    ? purokLabels[maxPovertyIdx].replace('Sitio ', '')
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
    exportToPDF({
      title: 'Poverty Incidence Report',
      rows: [
        ['Poverty Incidence (Family Income)', `${povertyRate}%`],
        ['Poor Households (< ₱10,000)', String(poorHH)],
        ['Average Family Income', `₱${avgFamilyIncome.toLocaleString()}`],
        ['Most Affected Sitio', mostAffectedSitio + (mostAffectedRate ? ` (${mostAffectedRate}%)` : '')],
        ['People in Poverty', String(peopleInPoverty)],
        ['Registered Household Heads', String(hhHeads)],
        ['Average Individual Income', `₱${avgIncome.toLocaleString()}`],
        ...purokLabels.map((p, i) => [`Poverty Rate — ${p}`, `${purokPoverty[i]}%`]),
        ...incomeBrackets.map(b => [`${b.label} (${b.sub})`, String(b.count)]),
      ],
    })
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={handleExportPDF} disabled={total === 0}>
          <Download size={13} /> Export PDF
        </button>
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
                data={{ labels: purokLabels, datasets: [{ data: purokPoverty, backgroundColor: purokPoverty.map(v => v > 20 ? '#EF4444' : v > 10 ? '#F5A623' : '#0D9E8C'), borderRadius: 6 }] }}
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
                  <td>{r.purok}</td>
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
