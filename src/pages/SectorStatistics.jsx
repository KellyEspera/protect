// ============================================================================
//  SectorStatistics.jsx  —  "Sector Statistics" page
// ----------------------------------------------------------------------------
//  Counts and charts the vulnerable sectors the barangay must monitor: senior
//  citizens, solo parents, PWDs (by disability type), and out-of-school youth.
//  Each sector is just a boolean flag on the resident row (is_senior_citizen,
//  is_pwd, etc.), so the stats are simple filters over the residents list.
// ============================================================================

import { Bar } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { SectionCard, StatCard } from '../components/ui/index'
import { useResidents } from '../hooks/useResidents'
import { exportToPDF } from '../lib/exportUtils'
import { Download } from 'lucide-react'

Chart.register(...registerables)
const noLeg = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }

export default function SectorStatistics() {
  const { data: residents = [] } = useResidents()

  const seniors = residents.filter(r => r.is_senior_citizen)
  const soloParents = residents.filter(r => r.is_solo_parent)
  const pwds = residents.filter(r => r.is_pwd)
  const osys = residents.filter(r => r.is_out_of_school_youth)
  const working = residents.filter(r => r.occupation && r.occupation.trim() !== '')

  const now = new Date()
  const getAge = dob => Math.floor((now - new Date(dob)) / 31557600000)

  const purokLabels = ['Sitio Hunan', 'Sitio Hagu', 'Sitio Tuva']
  const pct = n => residents.length ? `${((n / residents.length) * 100).toFixed(1)}% of population` : ''

  const scByGroup = [
    seniors.filter(r => { const a = getAge(r.date_of_birth); return a >= 60 && a <= 69 }).length,
    seniors.filter(r => { const a = getAge(r.date_of_birth); return a >= 70 && a <= 79 }).length,
    seniors.filter(r => getAge(r.date_of_birth) >= 80).length,
  ]

  const pwdTypes = ['Physical','Visual','Hearing','Intellectual','Psychosocial']
  const pwdByType = pwdTypes.map(t => pwds.filter(r => r.pwd_type === t).length)

  const osyBySitio = purokLabels.map(p => osys.filter(r => r.purok === p).length)
  const workingBySitio = purokLabels.map(p => working.filter(r => r.purok === p).length)

  const sectorList = [
    ...seniors.slice(0, 2).map(r => ({ ...r, cat: 'Senior Citizen', catColor: 'blue' })),
    ...soloParents.slice(0, 2).map(r => ({ ...r, cat: 'Solo Parent', catColor: 'teal' })),
    ...pwds.slice(0, 2).map(r => ({ ...r, cat: 'PWD', catColor: 'gold' })),
    ...osys.slice(0, 2).map(r => ({ ...r, cat: 'Out-of-School Youth', catColor: 'red' })),
    ...working.slice(0, 2).map(r => ({ ...r, cat: 'Working', catColor: 'gray' })),
  ]

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Vulnerable Sector Report',
      rows: [
        ['Senior Citizens', `${seniors.length} (${pct(seniors.length)})`],
        ['Solo Parents', `${soloParents.length} (${pct(soloParents.length)})`],
        ['Persons with Disability', `${pwds.length} (${pct(pwds.length)})`],
        ['Out-of-School Youth', `${osys.length} (${pct(osys.length)})`],
        ['Working Residents', `${working.length} (${pct(working.length)})`],
        ['Seniors 60-69 / 70-79 / 80+', `${scByGroup[0]} / ${scByGroup[1]} / ${scByGroup[2]}`],
        ...pwdTypes.map((t, i) => [`PWD — ${t}`, String(pwdByType[i])]),
      ],
    })
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={handleExportPDF} disabled={residents.length === 0}>
          <Download size={13} /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <StatCard icon="👴" value={seniors.length} label="Senior Citizens" change={pct(seniors.length)} color="blue" />
        <StatCard icon="👩‍👧" value={soloParents.length} label="Solo Parents" change={pct(soloParents.length)} color="teal" />
        <StatCard icon="♿" value={pwds.length} label="Persons with Disability" change={pct(pwds.length)} color="gold" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <StatCard icon="📚" value={osys.length} label="Out-of-School Youth (OSY)" change={pct(osys.length)} color="red" />
        <StatCard icon="💼" value={working.length} label="Working Residents" change={pct(working.length)} color="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Senior Citizens by Age Group">
          <div className="h-52">
            {seniors.length > 0 ? (
              <Bar
                data={{ labels: ['60-69 yrs','70-79 yrs','80+ yrs'], datasets: [{ data: scByGroup, backgroundColor: '#3B82F6', borderRadius: 6 }] }}
                options={{ ...noLeg, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
              />
            ) : <Empty message="No senior citizens recorded" />}
          </div>
        </SectionCard>

        <SectionCard title="PWD by Disability Type">
          <div className="h-52">
            {pwds.length > 0 ? (
              <Bar
                data={{ labels: pwdTypes, datasets: [{ data: pwdByType, backgroundColor: '#F5A623', borderRadius: 6 }] }}
                options={{ ...noLeg, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
              />
            ) : <Empty message="No PWDs recorded" />}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Out-of-School Youth by Sitio">
          <div className="h-52">
            {osys.length > 0 ? (
              <Bar
                data={{ labels: purokLabels, datasets: [{ data: osyBySitio, backgroundColor: '#EF4444', borderRadius: 6 }] }}
                options={{ ...noLeg, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
              />
            ) : <Empty message="No out-of-school youth recorded" />}
          </div>
        </SectionCard>

        <SectionCard title="Working Residents by Sitio">
          <div className="h-52">
            {working.length > 0 ? (
              <Bar
                data={{ labels: purokLabels, datasets: [{ data: workingBySitio, backgroundColor: '#0D9E8C', borderRadius: 6 }] }}
                options={{ ...noLeg, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
              />
            ) : <Empty message="No working residents recorded" />}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Sector Registry">
        {sectorList.length > 0 ? (
          <div className="overflow-x-auto"><table className="data-table">
            <thead><tr><th>Name</th><th>Category</th><th>Sitio</th><th>Age</th><th>Civil Status</th></tr></thead>
            <tbody>
              {sectorList.map(r => (
                <tr key={r.id + r.cat}>
                  <td><strong>{r.first_name} {r.last_name}</strong></td>
                  <td><span className={`badge badge-${r.catColor}`}>{r.cat}</span></td>
                  <td>{r.purok}</td>
                  <td>{getAge(r.date_of_birth)}</td>
                  <td>{r.civil_status}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No sector data yet. Add residents and mark their categories.</p>
        )}
      </SectionCard>
    </div>
  )
}

function Empty({ message = 'No data yet' }) {
  return <div className="h-full flex items-center justify-center text-gray-300 text-sm">{message}</div>
}
