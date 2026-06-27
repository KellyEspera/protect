import { useQuery } from '@tanstack/react-query'
import { Line } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard } from '../components/ui/index'

Chart.register(...registerables)

export default function PredictiveGrowth() {
  // Historical census data from population_history table
  const { data: historyRows = [] } = useQuery({
    queryKey: ['population-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('population_history')
        .select('*')
        .order('year', { ascending: true })
      return data || []
    },
  })

  // Build historical series from population_history
  const historical = historyRows.map(r => ({ year: r.year, count: r.total_population }))
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

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={lastCount.toLocaleString()} label={`${lastYear} Population`} color="navy" />
        <StatCard icon="📈" value={hasData ? `+${avgActualGrowth}/yr` : '—'} label="Avg Annual Growth" color="teal" />
        <StatCard icon="🔭" value={hasData ? projected10yr.toLocaleString() : '—'} label={`Projected ${lastYear + 10}`} color="gold" />
        <StatCard icon="📐" value={hasData ? `R²=${r2.toFixed(2)}` : '—'} label="Model Accuracy" color="blue" />
      </div>

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
    </div>
  )
}
