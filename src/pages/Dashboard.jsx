import { useQuery } from '@tanstack/react-query'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../lib/supabase'
import { StatCard, SectionCard, Badge } from '../components/ui/index'
import { exportToPDF } from '../lib/exportUtils'
import { Download } from 'lucide-react'

Chart.register(...registerables)

const chartDefaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const TEAL = '#0D9E8C'

export default function Dashboard() {
  // Live resident stats
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('purok, sex, is_senior_citizen, is_pwd, is_solo_parent, date_of_birth')
      return data || []
    },
  })

  // Live incidents
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('incidents').select('*').order('incident_date', { ascending: false }).limit(5)
      return data || []
    },
  })

  // Live beneficiary count
  const { data: beneficiaryCount = 0 } = useQuery({
    queryKey: ['beneficiary-count'],
    queryFn: async () => {
      const { count } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('status', 'Active')
      return count || 0
    },
  })

  // Live assistance by program
  const { data: programStats = [] } = useQuery({
    queryKey: ['program-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('beneficiaries')
        .select('assistance_programs(name)')
        .eq('status', 'Active')
      if (!data) return []
      const counts = {}
      data.forEach(b => {
        const name = b.assistance_programs?.name || 'Unknown'
        counts[name] = (counts[name] || 0) + 1
      })
      return Object.entries(counts).map(([name, count]) => ({ name, count }))
    },
  })

  // Computed stats from residents
  const total = residents.length
  const seniors = residents.filter(r => r.is_senior_citizen).length
  const pwds = residents.filter(r => r.is_pwd).length
  const soloParents = residents.filter(r => r.is_solo_parent).length
  const males = residents.filter(r => r.sex === 'Male').length
  const females = residents.filter(r => r.sex === 'Female').length

  // Age group breakdown
  const now = new Date()
  const getAge = dob => Math.floor((now - new Date(dob)) / 31557600000)
  const children = residents.filter(r => getAge(r.date_of_birth) < 18).length
  const youth    = residents.filter(r => { const a = getAge(r.date_of_birth); return a >= 18 && a <= 30 }).length
  const adults   = residents.filter(r => { const a = getAge(r.date_of_birth); return a >= 31 && a <= 59 }).length

  // Purok breakdown
  const purokCounts = ['Sitio Hunan','Sitio Hagu','Sitio Tuva'].map(p =>
    residents.filter(r => r.purok === p).length
  )

  const statusColor = { Ongoing: 'gold', Resolved: 'blue', Escalated: 'red', Dismissed: 'gray' }

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Community Dashboard Summary',
      rows: [
        ['Total Residents', String(total)],
        ['Male', `${males} (${total ? ((males/total)*100).toFixed(1) : 0}%)`],
        ['Female', `${females} (${total ? ((females/total)*100).toFixed(1) : 0}%)`],
        ['Children (0-17)', String(children)],
        ['Youth (18-30)', String(youth)],
        ['Adult (31-59)', String(adults)],
        ['Senior Citizens', String(seniors)],
        ['Persons with Disability', String(pwds)],
        ['Solo Parents', String(soloParents)],
        ['Active Beneficiaries', String(beneficiaryCount)],
        ['Residents — Sitio Hunan', String(purokCounts[0])],
        ['Residents — Sitio Hagu', String(purokCounts[1])],
        ['Residents — Sitio Tuva', String(purokCounts[2])],
      ],
    })
  }

  return (
    <div>
      {/* Export */}
      <div className="flex justify-end mb-3">
        <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={handleExportPDF} disabled={total === 0}>
          <Download size={13} /> Export Summary PDF
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value={total.toLocaleString()} label="Total Residents" color="teal" />
        <StatCard icon="👴" value={seniors} label="Senior Citizens" color="blue" />
        <StatCard icon="♿" value={pwds} label="Persons with Disability" color="gold" />
        <StatCard icon="🎁" value={beneficiaryCount} label="Active Beneficiaries" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sex distribution */}
        <SectionCard title="Sex Distribution" subtitle="From registered residents">
          <div className="h-48">
            {total > 0 ? (
              <Doughnut
                data={{
                  labels: [`Male (${males})`, `Female (${females})`],
                  datasets: [{ data: [males, females], backgroundColor: ['#3B82F6', '#EC4899'] }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
              />
            ) : <EmptyChart message="No residents yet" />}
          </div>
        </SectionCard>

        {/* Age group */}
        <SectionCard title="Demographics by Age Group">
          <div className="h-48">
            {total > 0 ? (
              <Doughnut
                data={{
                  labels: ['Children (0-17)', 'Youth (18-30)', 'Adult (31-59)', 'Senior (60+)'],
                  datasets: [{ data: [children, youth, adults, seniors], backgroundColor: ['#0D9E8C','#3B82F6','#F5A623','#EF4444'] }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8 } } } }}
              />
            ) : <EmptyChart message="No residents yet" />}
          </div>
        </SectionCard>

        {/* Residents by sitio */}
        <SectionCard title="Residents by Sitio">
          <div className="h-48">
            {total > 0 ? (
              <Bar
                data={{
                  labels: ['Sitio Hunan','Sitio Hagu','Sitio Tuva'],
                  datasets: [{ data: purokCounts, backgroundColor: TEAL, borderRadius: 6 }],
                }}
                options={{ ...chartDefaults, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' } } } }}
              />
            ) : <EmptyChart message="No residents yet" />}
          </div>
        </SectionCard>

        {/* Assistance by program */}
        <SectionCard title="Active Beneficiaries by Program">
          <div className="h-48">
            {programStats.length > 0 ? (
              <Bar
                data={{
                  labels: programStats.map(p => p.name),
                  datasets: [{ data: programStats.map(p => p.count), backgroundColor: ['#0D9E8C','#3B82F6','#F5A623','#8B5CF6','#EF4444'], borderRadius: 6 }],
                }}
                options={{ ...chartDefaults, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
              />
            ) : <EmptyChart message="No beneficiaries yet" />}
          </div>
        </SectionCard>
      </div>

      {/* Recent incidents */}
      <SectionCard
        title="Recent Incidents"
        action={incidents.filter(i => i.status === 'Ongoing').length > 0
          ? <Badge variant="red">{incidents.filter(i => i.status === 'Ongoing').length} ongoing</Badge>
          : null}
      >
        {incidents.length > 0 ? (
          <div className="overflow-x-auto"><table className="data-table">
            <thead><tr><th>Case No.</th><th>Type</th><th>Sitio</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {incidents.map(inc => (
                <tr key={inc.id}>
                  <td><span className="font-mono text-[11px] text-teal">{inc.case_no}</span></td>
                  <td>{inc.incident_type}</td>
                  <td>{inc.purok}</td>
                  <td>{new Date(inc.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td><Badge variant={statusColor[inc.status] || 'gray'}>{inc.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-6">No incidents recorded yet.</p>
        )}
      </SectionCard>

      {/* Sector summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="👴" value={seniors} label="Senior Citizens" change={total ? `${((seniors/total)*100).toFixed(1)}% of population` : ''} color="blue" />
        <StatCard icon="♿" value={pwds} label="Persons with Disability" change={total ? `${((pwds/total)*100).toFixed(1)}% of population` : ''} color="gold" />
        <StatCard icon="👩‍👧" value={soloParents} label="Solo Parents" change={total ? `${((soloParents/total)*100).toFixed(1)}% of population` : ''} color="teal" />
      </div>
    </div>
  )
}

function EmptyChart({ message }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-300 text-sm">
      {message}
    </div>
  )
}
