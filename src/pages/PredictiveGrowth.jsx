import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, Line } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard } from '../components/ui/index'

Chart.register(...registerables)

export default function PredictiveGrowth() {
  const [activeTab, setActiveTab] = useState('population')

  // Historical census data from population_history table
  const { data: historyRows = [], isLoading } = useQuery({
    queryKey: ['population-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('population_history')
        .select('*')
        .order('year', { ascending: true })
      return data || []
    },
  })

  // Also fetch current residents count and incidents for secondary charts
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-predictive'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('created_at, sex, purok')
      return data || []
    },
  })

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-predictive'],
    queryFn: async () => {
      const { data } = await supabase.from('incidents').select('incident_date, incident_type, purok')
      return data || []
    },
  })

  // Build historical series from population_history
  const historical = historyRows.map(r => ({ year: r.year, count: r.total_population, row: r }))
  const hasData = historical.length >= 2

  // Linear regression on historical data
  let slope = 0, intercept = 0, r2 = 0
  if (hasData) {
    const n = historical.length
    const sumX  = historical.reduce((s, d) => s + d.year, 0)
    const sumY  = historical.reduce((s, d) => s + d.count, 0)
    const sumXY = historical.reduce((s, d) => s + d.year * d.count, 0)
    const sumX2 = historical.reduce((s, d) => s + d.year * d.year, 0)
    slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    intercept = (sumY - slope * sumX) / n
    const meanY  = sumY / n
    const ssTot  = historical.reduce((s, d) => s + Math.pow(d.count - meanY, 2), 0)
    const ssRes  = historical.reduce((s, d) => s + Math.pow(d.count - (slope * d.year + intercept), 2), 0)
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  }

  const lastYear      = hasData ? historical[historical.length - 1].year : new Date().getFullYear()
  const lastCount     = hasData ? historical[historical.length - 1].count : 0
  const projYears     = Array.from({ length: 10 }, (_, i) => lastYear + i + 1)
  const projCounts    = projYears.map(yr => Math.max(0, Math.round(slope * yr + intercept)))
  const projected10yr = projCounts[9]
  const annualGrowth  = lastCount > 0 ? ((slope / lastCount) * 100).toFixed(1) : '—'

  // Avg annual growth from history
  const avgActualGrowth = hasData && historical.length > 1
    ? ((historical[historical.length - 1].count - historical[0].count) / (historical.length - 1)).toFixed(0)
    : 0

  // Chart data — population trend
  const chartLabels = [...historical.map(d => d.year), ...projYears]
  const histData    = [...historical.map(d => d.count), ...Array(projYears.length).fill(null)]
  const projData    = historical.length > 0
    ? [...Array(historical.length - 1).fill(null), lastCount, ...projCounts]
    : projCounts

  // Birth/death trend data
  const birthDeathYears  = historyRows.filter(r => r.birth_count != null).map(r => r.year)
  const birthCounts      = historyRows.filter(r => r.birth_count != null).map(r => r.birth_count)
  const deathCounts      = historyRows.filter(r => r.birth_count != null).map(r => r.death_count || 0)
  const netMigration     = historyRows.filter(r => r.migration_in != null)
    .map(r => (r.migration_in || 0) - (r.migration_out || 0))

  // Gender ratio from latest year
  const latestRow = historyRows[historyRows.length - 1]
  const maleCount   = latestRow?.male_count   || residents.filter(r => r.sex === 'Male').length
  const femaleCount = latestRow?.female_count || residents.filter(r => r.sex === 'Female').length

  // Incidents by year
  const incidentsByYear = incidents.reduce((acc, i) => {
    if (!i.incident_date) return acc
    const yr = new Date(i.incident_date).getFullYear()
    acc[yr] = (acc[yr] || 0) + 1
    return acc
  }, {})
  const incidentYears  = Object.keys(incidentsByYear).map(Number).sort()
  const incidentCounts = incidentYears.map(yr => incidentsByYear[yr])

  const TAB_STYLE = (active) => ({
    padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: 'none', fontFamily: 'Inter,sans-serif',
    background: active ? '#1A3A5C' : 'transparent',
    color: active ? '#fff' : '#9A9488',
  })

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={lastCount.toLocaleString()} label={`${lastYear} Population`} color="navy" />
        <StatCard icon="📈" value={hasData ? `+${avgActualGrowth}/yr` : '—'} label="Avg Annual Growth" color="teal" />
        <StatCard icon="🔭" value={hasData ? projected10yr.toLocaleString() : '—'} label={`Projected ${lastYear + 10}`} color="gold" />
        <StatCard icon="📐" value={hasData ? `R²=${r2.toFixed(2)}` : '—'} label="Model Accuracy" color="blue" />
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#F5F2EC', padding: 4, borderRadius: 6, width: 'fit-content' }}>
        {[
          { key: 'population', label: '📈 Population Trend' },
          { key: 'vitals',     label: '🍼 Births & Deaths' },
          { key: 'gender',     label: '⚖️ Gender & Sitio' },
          { key: 'incidents',  label: '🚨 Incident Trend' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={TAB_STYLE(activeTab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Population Trend tab */}
      {activeTab === 'population' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard
            title="Population Growth Forecast"
            subtitle={`Historical (${historical[0]?.year}–${lastYear}) + 10-year linear regression projection`}
          >
            <div className="h-72">
              {hasData ? (
                <Line
                  data={{
                    labels: chartLabels,
                    datasets: [
                      {
                        label: 'Historical Population',
                        data: histData,
                        borderColor: '#0D9E8C',
                        backgroundColor: 'rgba(13,158,140,.1)',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4,
                        pointBackgroundColor: '#0D9E8C',
                      },
                      {
                        label: 'Projected',
                        data: projData,
                        borderColor: '#F5A623',
                        borderDash: [6, 3],
                        backgroundColor: 'rgba(245,166,35,.07)',
                        tension: 0.35,
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
                    plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
                    scales: { y: { beginAtZero: false } },
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-center text-gray-400 text-sm px-8">
                  No population history data found.<br />Run <code className="text-xs bg-gray-100 px-1 rounded">population_history.sql</code> in Supabase.
                </div>
              )}
            </div>
          </SectionCard>

          <div className="flex flex-col gap-5">
            <SectionCard title="10-Year Projection Table">
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Year</th><th>Population</th><th>Growth</th><th>Confidence</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{lastYear}</td>
                      <td>{lastCount.toLocaleString()}</td>
                      <td>—</td>
                      <td><span className="badge badge-teal">Actual</span></td>
                    </tr>
                    {projYears.map((yr, i) => (
                      <tr key={yr}>
                        <td>{yr}</td>
                        <td>{projCounts[i].toLocaleString()}</td>
                        <td>+{(projCounts[i] - (i === 0 ? lastCount : projCounts[i - 1])).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${i < 3 ? 'badge-teal' : i < 7 ? 'badge-gold' : 'badge-gray'}`}>
                            {i < 3 ? 'High' : i < 7 ? 'Medium' : 'Low'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard title="Model Parameters">
              {[
                ['Model Type', 'Linear Regression'],
                ['Historical Years', `${historical.length} yrs (${historical[0]?.year}–${lastYear})`],
                ['R² Value', r2.toFixed(4)],
                ['Growth Rate (β₁)', `${slope.toFixed(2)} residents/yr`],
                ['Avg Annual Growth', `+${avgActualGrowth} residents`],
                ['Projection Window', '10 years'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-500">{k}</span>
                  <span className="text-[13px] font-semibold text-navy">{v}</span>
                </div>
              ))}
            </SectionCard>
          </div>
        </div>
      )}

      {/* Births & Deaths tab */}
      {activeTab === 'vitals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Births & Deaths per Year" subtitle="Natural population change">
            <div className="h-72">
              <Bar
                data={{
                  labels: birthDeathYears,
                  datasets: [
                    { label: 'Births', data: birthCounts, backgroundColor: '#0D9E8C', borderRadius: 4 },
                    { label: 'Deaths', data: deathCounts, backgroundColor: '#B83232', borderRadius: 4 },
                  ],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </SectionCard>
          <SectionCard title="Net Migration per Year" subtitle="In-migration minus out-migration">
            <div className="h-72">
              <Bar
                data={{
                  labels: birthDeathYears,
                  datasets: [{
                    label: 'Net Migration',
                    data: netMigration,
                    backgroundColor: netMigration.map(v => v >= 0 ? '#3B82F6' : '#F97316'),
                    borderRadius: 4,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: false } },
                }}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Gender & Sitio tab */}
      {activeTab === 'gender' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Gender Distribution" subtitle="Male vs Female ratio from latest census">
            <div className="h-56">
              <Bar
                data={{
                  labels: ['Male', 'Female'],
                  datasets: [{ data: [maleCount, femaleCount], backgroundColor: ['#1A3A5C', '#C9A84C'], borderRadius: 6 }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
            <div className="flex justify-around pt-3 border-t border-gray-100 mt-3">
              <div className="text-center">
                <div className="text-lg font-bold text-navy">{maleCount}</div>
                <div className="text-xs text-gray-500">Male</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: '#C9A84C' }}>{femaleCount}</div>
                <div className="text-xs text-gray-500">Female</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-teal">
                  {maleCount + femaleCount > 0 ? ((maleCount / (maleCount + femaleCount)) * 100).toFixed(0) : '—'}%
                </div>
                <div className="text-xs text-gray-500">Male Ratio</div>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Population by Sitio" subtitle="Resident count per sitio">
            <div className="h-72">
              <Bar
                data={{
                  labels: ['Sitio Hunan', 'Sitio Hagu', 'Sitio Tuva'],
                  datasets: [{
                    label: 'Residents',
                    data: [
                      residents.filter(r => r.purok === 'Sitio Hunan').length,
                      residents.filter(r => r.purok === 'Sitio Hagu').length,
                      residents.filter(r => r.purok === 'Sitio Tuva').length,
                    ],
                    backgroundColor: ['#0D9E8C', '#F5A623', '#3B82F6'],
                    borderRadius: 4,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Incident Trend tab */}
      {activeTab === 'incidents' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Incidents Reported per Year" subtitle="From Crime & Incident records">
            <div className="h-72">
              {incidentYears.length > 0 ? (
                <Bar
                  data={{
                    labels: incidentYears,
                    datasets: [{ label: 'Incidents', data: incidentCounts, backgroundColor: '#EF4444', borderRadius: 4 }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">No incident records yet</div>
              )}
            </div>
          </SectionCard>
          <SectionCard title="Incident Breakdown by Type" subtitle="All-time type distribution">
            <div className="h-72">
              {incidents.length > 0 ? (() => {
                const typeMap = incidents.reduce((a, i) => { a[i.incident_type] = (a[i.incident_type] || 0) + 1; return a }, {})
                return (
                  <Bar
                    data={{
                      labels: Object.keys(typeMap),
                      datasets: [{ label: 'Count', data: Object.values(typeMap), backgroundColor: '#F97316', borderRadius: 4 }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true }, x: { ticks: { font: { size: 10 } } } },
                    }}
                  />
                )
              })() : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">No incident records yet</div>
              )}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}
