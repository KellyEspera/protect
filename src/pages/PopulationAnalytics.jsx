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

import { useState } from 'react'
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
const SITIO_COLORS = {
  'Sitio Hunan': '#0D9E8C',
  'Sitio Hagu': '#F5A623',
  'Sitio Tuva': '#3B82F6',
}

export default function PopulationAnalytics() {
  // Pull the residents list from cache. Default to [] so the page never crashes
  // while data is still loading.
  const { data: residents = [] } = useResidents()
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedExportSections, setSelectedExportSections] = useState(['summary','sex','age','sitio'])

  const exportSections = [
    { key: 'summary', label: 'Summary cards' },
    { key: 'sex', label: 'Sex distribution' },
    { key: 'age', label: 'Age group distribution' },
    { key: 'sitio', label: 'Population by sitio' },
  ]

  const toggleExportSection = key => {
    setSelectedExportSections(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key])
  }

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
  const sitioLabels = ['Sitio Hunan','Sitio Hagu','Sitio Tuva']
  const sitioData = sitioLabels.map(p => residents.filter(r => r.sitio === p).length)

  // Build a printable PDF report of the selected sections (uses jsPDF under the hood).
  const handleExportPDF = () => {
    const rows = []

    if (selectedExportSections.includes('summary')) {
      rows.push(['Total Population', String(total)])
      rows.push(['Male', `${males} (${total ? ((males/total)*100).toFixed(1) : 0}%)`])
      rows.push(['Female', `${females} (${total ? ((females/total)*100).toFixed(1) : 0}%)`])
      rows.push(['Under 18', `${under18} (${total ? ((under18/total)*100).toFixed(1) : 0}%)`])
      rows.push(['Senior Citizens (60+)', `${seniors} (${total ? ((seniors/total)*100).toFixed(1) : 0}%)`])
    }

    if (selectedExportSections.includes('sex')) {
      rows.push(['Sex Distribution - Male', `${males}`])
      rows.push(['Sex Distribution - Female', `${females}`])
    }

    if (selectedExportSections.includes('age')) {
      rows.push(['Age Group - Children (0-17)', String(residents.filter(r => getAge(r.date_of_birth) < 18).length)])
      rows.push(['Age Group - Youth (18-30)', String(residents.filter(r => { const a = getAge(r.date_of_birth); return a >= 18 && a <= 30 }).length)])
      rows.push(['Age Group - Adult (31-59)', String(residents.filter(r => { const a = getAge(r.date_of_birth); return a >= 31 && a <= 59 }).length)])
      rows.push(['Age Group - Senior (60+)', String(seniors)])
    }

    if (selectedExportSections.includes('sitio')) {
      rows.push(...sitioLabels.map((p, i) => [`Population — ${p}`, String(sitioData[i])]))
    }

    if (rows.length > 0) {
      exportToPDF({ title: 'Population Analytics Report', requireConfirmation: true, rows })
      setShowExportMenu(false)
    }
  }

  return (
    <div>
      {/* Export button with section selection */}
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
              data={{ labels: sitioLabels, datasets: [{ data: sitioData, backgroundColor: sitioLabels.map(label => SITIO_COLORS[label] || TEAL), borderRadius: 6 }] }}
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
