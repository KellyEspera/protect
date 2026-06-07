import { useQuery } from '@tanstack/react-query'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { SectionCard, StatCard } from '../components/ui/index'
import { supabase } from '../lib/supabase'

Chart.register(...registerables)
const noLeg = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const TEAL = '#0D9E8C'

function useResidents() {
  return useQuery({
    queryKey: ['residents-analytics'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*')
      return data || []
    },
  })
}

// ── Population Analytics ──────────────────────────────────────
export function PopulationAnalytics() {
  const { data: residents = [] } = useResidents()

  const total = residents.length
  const now = new Date()
  const getAge = dob => Math.floor((now - new Date(dob)) / 31557600000)
  const males = residents.filter(r => r.sex === 'Male').length
  const females = residents.filter(r => r.sex === 'Female').length
  const under18 = residents.filter(r => getAge(r.date_of_birth) < 18).length
  const seniors = residents.filter(r => r.is_senior_citizen).length

  const purokLabels = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5']
  const purokData = purokLabels.map(p => residents.filter(r => r.purok === p).length)

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={total.toLocaleString()} label="Total Population" color="teal" />
        <StatCard icon="⚧️" value={total ? `${((males/total)*100).toFixed(1)}%` : '—'} label="Male Ratio" color="blue" />
        <StatCard icon="👦" value={total ? `${((under18/total)*100).toFixed(1)}%` : '—'} label="Under 18" color="gold" />
        <StatCard icon="👴" value={total ? `${((seniors/total)*100).toFixed(1)}%` : '—'} label="Senior Citizens" color="red" />
      </div>

      <div className="grid grid-cols-2 gap-5">
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

      <SectionCard title="Population by Purok">
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

// ── Poverty Incidence ─────────────────────────────────────────
export function PovertyIncidence() {
  const { data: residents = [] } = useResidents()

  const total = residents.length
  const poorThreshold = 10000
  const poorHH = residents.filter(r => r.is_household_head && (r.monthly_income || 0) < poorThreshold).length
  const avgIncome = total > 0
    ? Math.round(residents.reduce((s, r) => s + (r.monthly_income || 0), 0) / total)
    : 0
  const povertyRate = total > 0 ? ((poorHH / residents.filter(r => r.is_household_head).length) * 100).toFixed(1) : '—'

  const purokLabels = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5']
  const purokPoverty = purokLabels.map(p => {
    const hhInPurok = residents.filter(r => r.purok === p && r.is_household_head)
    if (!hhInPurok.length) return 0
    return Math.round((hhInPurok.filter(r => (r.monthly_income || 0) < poorThreshold).length / hhInPurok.length) * 100)
  })

  const incomeClassification = [
    residents.filter(r => (r.monthly_income || 0) < 10000).length,
    residents.filter(r => r.monthly_income >= 10000 && r.monthly_income < 20000).length,
    residents.filter(r => r.monthly_income >= 20000 && r.monthly_income < 40000).length,
    residents.filter(r => r.monthly_income >= 40000).length,
  ]

  const poorResidents = residents
    .filter(r => r.is_household_head && (r.monthly_income || 0) < poorThreshold)
    .slice(0, 10)

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="🤝" value={`${povertyRate}%`} label="Poverty Incidence (HH Heads)" color="red" />
        <StatCard icon="🏚️" value={poorHH} label="Below ₱10,000/mo HH Heads" color="gold" />
        <StatCard icon="💰" value={`₱${avgIncome.toLocaleString()}`} label="Avg Monthly Income" color="teal" />
        <StatCard icon="📋" value={residents.filter(r => r.is_household_head).length} label="Registered HH Heads" color="blue" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Poverty Rate by Purok" subtitle="% of HH heads below ₱10,000/mo">
          <div className="h-52">
            {total > 0 ? (
              <Bar
                data={{ labels: purokLabels, datasets: [{ data: purokPoverty, backgroundColor: purokPoverty.map(v => v > 20 ? '#EF4444' : v > 10 ? '#F5A623' : '#0D9E8C'), borderRadius: 6 }] }}
                options={{ ...noLeg, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v+'%' } } } }}
              />
            ) : <Empty />}
          </div>
        </SectionCard>

        <SectionCard title="Income Classification">
          <div className="h-52">
            {total > 0 ? (
              <Doughnut
                data={{
                  labels: ['Below ₱10K (Poor)','₱10K–₱20K (Low)','₱20K–₱40K (Middle)','₱40K+ (High)'],
                  datasets: [{ data: incomeClassification, backgroundColor: ['#EF4444','#F5A623','#3B82F6','#0D9E8C'] }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8 } } } }}
              />
            ) : <Empty />}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Household Heads Below Poverty Line" action={<span className="badge badge-red">{poorHH} households</span>}>
        {poorResidents.length > 0 ? (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Purok</th><th>Monthly Income</th><th>PWD</th><th>Solo Parent</th><th>Senior</th></tr></thead>
            <tbody>
              {poorResidents.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.first_name} {r.last_name}</strong></td>
                  <td>{r.purok}</td>
                  <td>₱{(r.monthly_income || 0).toLocaleString()}</td>
                  <td>{r.is_pwd ? <span className="badge badge-gold">Yes</span> : 'No'}</td>
                  <td>{r.is_solo_parent ? <span className="badge badge-teal">Yes</span> : 'No'}</td>
                  <td>{r.is_senior_citizen ? <span className="badge badge-blue">Yes</span> : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No data yet. Add residents with income information.</p>
        )}
      </SectionCard>
    </div>
  )
}

// ── Sector Statistics ─────────────────────────────────────────
export function SectorStatistics() {
  const { data: residents = [] } = useResidents()

  const seniors = residents.filter(r => r.is_senior_citizen)
  const soloParents = residents.filter(r => r.is_solo_parent)
  const pwds = residents.filter(r => r.is_pwd)

  const now = new Date()
  const getAge = dob => Math.floor((now - new Date(dob)) / 31557600000)

  const scByGroup = [
    seniors.filter(r => { const a = getAge(r.date_of_birth); return a >= 60 && a <= 69 }).length,
    seniors.filter(r => { const a = getAge(r.date_of_birth); return a >= 70 && a <= 79 }).length,
    seniors.filter(r => getAge(r.date_of_birth) >= 80).length,
  ]

  const pwdTypes = ['Physical','Visual','Hearing','Intellectual','Psychosocial']
  const pwdByType = pwdTypes.map(t => pwds.filter(r => r.pwd_type === t).length)

  const sectorList = [...seniors.slice(0,3).map(r => ({ ...r, cat: 'Senior Citizen', catColor: 'blue' })),
    ...soloParents.slice(0,2).map(r => ({ ...r, cat: 'Solo Parent', catColor: 'teal' })),
    ...pwds.slice(0,2).map(r => ({ ...r, cat: 'PWD', catColor: 'gold' }))]

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="👴" value={seniors.length} label="Senior Citizens" change={residents.length ? `${((seniors.length/residents.length)*100).toFixed(1)}% of population` : ''} color="blue" />
        <StatCard icon="👩‍👧" value={soloParents.length} label="Solo Parents" change={residents.length ? `${((soloParents.length/residents.length)*100).toFixed(1)}% of population` : ''} color="teal" />
        <StatCard icon="♿" value={pwds.length} label="Persons with Disability" change={residents.length ? `${((pwds.length/residents.length)*100).toFixed(1)}% of population` : ''} color="gold" />
      </div>

      <div className="grid grid-cols-2 gap-5">
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

      <SectionCard title="Vulnerable Sector Registry">
        {sectorList.length > 0 ? (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Category</th><th>Purok</th><th>Age</th><th>Civil Status</th></tr></thead>
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
          </table>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No vulnerable sector data yet. Add residents and mark their categories.</p>
        )}
      </SectionCard>
    </div>
  )
}

function Empty({ message = 'No data yet' }) {
  return <div className="h-full flex items-center justify-center text-gray-300 text-sm">{message}</div>
}
