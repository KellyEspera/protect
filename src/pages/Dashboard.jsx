import { useQuery } from '@tanstack/react-query'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { mockResidents, mockIncidents, populationByYear } from '../lib/mockData'
import { StatCard, SectionCard, Badge } from '../components/ui/index'

Chart.register(...registerables)

const chartDefaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const TEAL = '#0D9E8C'

export default function Dashboard() {
  const { data: residents = mockResidents } = useQuery({
    queryKey: ['residents-summary'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*')
      return data || mockResidents
    },
  })

  const { data: incidents = mockIncidents } = useQuery({
    queryKey: ['incidents-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('incidents').select('*').order('incident_date', { ascending: false }).limit(5)
      return data || mockIncidents
    },
  })

  const totalPop = residents.length || 1284
  const seniors = residents.filter(r => r.is_senior_citizen).length || 207
  const pwds = residents.filter(r => r.is_pwd).length || 48

  const popLabels = populationByYear.map(d => d.year.toString())
  const popData = populationByYear.map(d => d.count)

  const statusColor = { Ongoing: 'gold', Resolved: 'blue', Escalated: 'red', Dismissed: 'gray' }

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={totalPop.toLocaleString()} label="Total Residents" change="+23 this quarter" color="teal" />
        <StatCard icon="🏠" value="342" label="Registered Households" change="+8 this month" color="gold" />
        <StatCard icon="🤝" value="18.4%" label="Poverty Incidence" change="-1.2% vs last year" changeType="down" color="red" />
        <StatCard icon="🎁" value="218" label="Active Beneficiaries" change="+12 enrolled" color="blue" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Population trend */}
        <SectionCard title="Population Trend" subtitle="2019 to 2026">
          <div className="h-48">
            <Line
              data={{
                labels: popLabels,
                datasets: [{
                  data: popData,
                  borderColor: TEAL,
                  backgroundColor: 'rgba(13,158,140,.08)',
                  tension: 0.4,
                  fill: true,
                  pointBackgroundColor: TEAL,
                  pointRadius: 3,
                }],
              }}
              options={{ ...chartDefaults, scales: { y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,.04)' } } } }}
            />
          </div>
        </SectionCard>

        {/* Demographics */}
        <SectionCard title="Demographics by Age Group">
          <div className="h-48">
            <Doughnut
              data={{
                labels: ['Children (0-17)', 'Youth (18-30)', 'Adult (31-59)', 'Senior (60+)'],
                datasets: [{
                  data: [364, 282, 431, 207],
                  backgroundColor: ['#0D9E8C', '#3B82F6', '#F5A623', '#EF4444'],
                }],
              }}
              options={{ ...chartDefaults, plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } } }}
            />
          </div>
        </SectionCard>

        {/* Recent incidents */}
        <SectionCard
          title="Recent Incidents"
          action={<Badge variant="red">{incidents.filter(i => i.status === 'Ongoing').length} ongoing</Badge>}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th><th>Purok</th><th>Date</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 4).map(inc => (
                <tr key={inc.id}>
                  <td>{inc.incident_type}</td>
                  <td>{inc.purok}</td>
                  <td>{new Date(inc.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</td>
                  <td><Badge variant={statusColor[inc.status] || 'gray'}>{inc.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        {/* Assistance chart */}
        <SectionCard title="Assistance by Program">
          <div className="h-44">
            <Bar
              data={{
                labels: ['4Ps', 'Rice Subsidy', 'Medical', 'Educational'],
                datasets: [{
                  data: [89, 67, 42, 20],
                  backgroundColor: ['#0D9E8C', '#3B82F6', '#F5A623', '#8B5CF6'],
                  borderRadius: 6,
                }],
              }}
              options={{ ...chartDefaults, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' } } } }}
            />
          </div>
        </SectionCard>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mt-5">
        <StatCard icon="👴" value={seniors} label="Senior Citizens" change={`${((seniors/totalPop)*100).toFixed(1)}% of population`} color="blue" />
        <StatCard icon="♿" value={pwds} label="Persons with Disability" change="3.7% of population" color="gold" />
        <StatCard icon="👤" value="34" label="Solo Parents" change="2.6% of population" color="purple" />
      </div>
    </div>
  )
}
