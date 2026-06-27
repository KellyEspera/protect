// ============================================================================
//  PopulationAnalytics.jsx  —  "Population Analytics" page
// ----------------------------------------------------------------------------
//  Shows demographic charts for the barangay: total population, sex ratio,
//  age groups, and population per sitio. It is READ-ONLY (no editing here) —
//  it just reads the residents table and visualizes it with Chart.js.
//
//  Data source: the shared useResidents() hook (React Query cached query),
//  so this page, Poverty Incidence, and Sector Statistics all reuse one fetch.
// ============================================================================

import { Bar, Pie, Doughnut } from 'react-chartjs-2'   // chart components
import { Chart, registerables } from 'chart.js'          // the charting engine
import { SectionCard, StatCard } from '../components/ui/index' // reusable UI cards
import { useResidents } from '../hooks/useResidents'     // cached residents fetch
import { exportToPDF } from '../lib/exportUtils'         // PDF export helper
import { Download } from 'lucide-react'                  // icon

Chart.register(...registerables)  // register all Chart.js pieces (scales, elements) once
// Default chart options used for simple bar charts: responsive, no legend.
const noLeg = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const TEAL = '#0D9E8C'  // brand colour reused in charts

export default function PopulationAnalytics() {
  // Pull the residents list from cache. Default to [] so the page never crashes
  // while data is still loading.
  const { data: residents = [] } = useResidents()

  // ---- Derived statistics (recomputed on every render from the residents array) ----
  const total = residents.length
  const now = new Date()
  // Age = (now - date_of_birth) in milliseconds, divided by ms-per-year, floored.
  // 31557600000 = 365.25 days in milliseconds (accounts for leap years).
  const getAge = dob => Math.floor((now - new Date(dob)) / 31557600000)
  const males = residents.filter(r => r.sex === 'Male').length
  const females = residents.filter(r => r.sex === 'Female').length
  const under18 = residents.filter(r => getAge(r.date_of_birth) < 18).length
  const seniors = residents.filter(r => r.is_senior_citizen).length  // boolean flag on the row

  // Count residents in each of the three sitios for the "Population by Sitio" bar chart.
  const purokLabels = ['Sitio Hunan','Sitio Hagu','Sitio Tuva']
  const purokData = purokLabels.map(p => residents.filter(r => r.purok === p).length)

  // Build a printable PDF report of these same figures (uses jsPDF under the hood).
  const handleExportPDF = () => {
    exportToPDF({
      title: 'Population Analytics Report',
      rows: [
        ['Total Population', String(total)],
        ['Male', `${males} (${total ? ((males/total)*100).toFixed(1) : 0}%)`],
        ['Female', `${females} (${total ? ((females/total)*100).toFixed(1) : 0}%)`],
        ['Under 18', `${under18} (${total ? ((under18/total)*100).toFixed(1) : 0}%)`],
        ['Senior Citizens (60+)', `${seniors} (${total ? ((seniors/total)*100).toFixed(1) : 0}%)`],
        ...purokLabels.map((p, i) => [`Population — ${p}`, String(purokData[i])]),
      ],
    })
  }

  return (
    <div>
      {/* Export button — disabled when there is no data to export */}
      <div className="flex justify-end mb-3">
        <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={handleExportPDF} disabled={total === 0}>
          <Download size={13} /> Export PDF
        </button>
      </div>

      {/* Four summary stat cards across the top */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={total.toLocaleString()} label="Total Population" color="teal" />
        {/* `total ? ... : '—'` guards against dividing by zero when there are no residents */}
        <StatCard icon="⚧️" value={total ? `${((males/total)*100).toFixed(1)}%` : '—'} label="Male Ratio" color="blue" />
        <StatCard icon="👦" value={total ? `${((under18/total)*100).toFixed(1)}%` : '—'} label="Under 18" color="gold" />
        <StatCard icon="👴" value={total ? `${((seniors/total)*100).toFixed(1)}%` : '—'} label="Senior Citizens" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pie chart: male vs female. `total > 0 ? <Chart/> : <Empty/>` avoids rendering an empty chart. */}
        <SectionCard title="Sex Distribution">
          <div className="h-56">
            {total > 0 ? (
              <Pie
                data={{
                  labels: [`Male (${males})`, `Female (${females})`],
                  datasets: [{ data: [males, females], backgroundColor: ['#3B82F6','#EC4899'] }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
              />
            ) : <Empty />}
          </div>
        </SectionCard>

        {/* Doughnut chart: residents bucketed into 4 age groups computed inline from getAge() */}
        <SectionCard title="Age Group Distribution">
          <div className="h-56">
            {total > 0 ? (
              <Doughnut
                data={{
                  labels: ['Children (0-17)','Youth (18-30)','Adult (31-59)','Senior (60+)'],
                  datasets: [{
                    data: [
                      residents.filter(r => getAge(r.date_of_birth) < 18).length,
                      residents.filter(r => { const a = getAge(r.date_of_birth); return a >= 18 && a <= 30 }).length,
                      residents.filter(r => { const a = getAge(r.date_of_birth); return a >= 31 && a <= 59 }).length,
                      seniors,
                    ],
                    backgroundColor: ['#0D9E8C','#3B82F6','#F5A623','#EF4444'],
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8 } } } }}
              />
            ) : <Empty />}
          </div>
        </SectionCard>
      </div>

      {/* Bar chart: how many residents live in each sitio */}
      <SectionCard title="Population by Sitio">
        <div className="h-48">
          {total > 0 ? (
            <Bar
              data={{ labels: purokLabels, datasets: [{ data: purokData, backgroundColor: TEAL, borderRadius: 6 }] }}
              options={{ ...noLeg, scales: { y: { beginAtZero: true } } }}
            />
          ) : <Empty />}
        </div>
      </SectionCard>
    </div>
  )
}

// Small placeholder shown inside a chart card when there is no data yet.
function Empty({ message = 'No data yet' }) {
  return <div className="h-full flex items-center justify-center text-gray-300 text-sm">{message}</div>
}
