// PopulationAnalytics.jsx
import { Bar, Line, Pie } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { SectionCard, StatCard } from '../components/ui/index'
import { populationByYear } from '../lib/mockData'

Chart.register(...registerables)
const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const TEAL = '#0D9E8C'

export function PopulationAnalytics() {
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="👥" value="1,284" label="Total Population" color="teal" />
        <StatCard icon="⚧️" value="49.5%" label="Male Ratio" color="blue" />
        <StatCard icon="👦" value="28.3%" label="Under 18" color="gold" />
        <StatCard icon="👴" value="16.1%" label="Senior Citizens" color="red" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Population by Year" subtitle="2019-2026">
          <div className="h-56">
            <Line
              data={{ labels: populationByYear.map(d => d.year), datasets: [{ data: populationByYear.map(d => d.count), borderColor: TEAL, backgroundColor: 'rgba(13,158,140,.08)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: TEAL }] }}
              options={{ ...opts, scales: { y: { beginAtZero: false } } }}
            />
          </div>
        </SectionCard>
        <SectionCard title="Sex Distribution">
          <div className="h-56">
            <Pie
              data={{ labels: ['Male (636)', 'Female (648)'], datasets: [{ data: [636, 648], backgroundColor: ['#3B82F6', '#EC4899'] }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
            />
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Population by Purok">
        <div className="h-48">
          <Bar
            data={{ labels: ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5'], datasets: [{ data: [287,265,241,298,193], backgroundColor: TEAL, borderRadius: 6 }] }}
            options={{ ...opts, scales: { y: { beginAtZero: true } } }}
          />
        </div>
      </SectionCard>
    </div>
  )
}

// PovertyIncidence.jsx
export function PovertyIncidence() {
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="🤝" value="18.4%" label="Poverty Incidence" color="red" />
        <StatCard icon="🏚️" value="63" label="Poor Households" color="gold" />
        <StatCard icon="💰" value="₱8,240" label="Avg Monthly Income" color="teal" />
        <StatCard icon="📉" value="-1.2%" label="YoY Change" color="blue" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Poverty Rate by Purok">
          <div className="h-52">
            <Bar
              data={{ labels: ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5'], datasets: [{ data: [16,20,24,17,11], backgroundColor: ['#F5A623','#EF4444','#EF4444','#F5A623','#0D9E8C'], borderRadius: 6 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 30, ticks: { callback: v => v+'%' } } } }}
            />
          </div>
        </SectionCard>
        <SectionCard title="Income Classification">
          <div className="h-52">
            <Pie
              data={{ labels: ['Poor (18%)','Low Income (29%)','Middle (37%)','High (16%)'], datasets: [{ data: [18,29,37,16], backgroundColor: ['#EF4444','#F5A623','#3B82F6','#0D9E8C'] }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }}
            />
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Identified Poor Households" action={<span className="badge badge-red">63 households</span>}>
        <table className="data-table">
          <thead><tr><th>HH ID</th><th>Household Head</th><th>Purok</th><th>Members</th><th>Monthly Income</th><th>Classification</th><th>Programs</th></tr></thead>
          <tbody>
            {[
              ['HH-021','Rosa Marcos','Purok 3',6,'₱3,200','Poor','4Ps, Rice'],
              ['HH-034','Andres Batac','Purok 2',4,'₱4,100','Poor','4Ps'],
              ['HH-047','Nelia Darilag','Purok 3',8,'₱2,800','Poor','4Ps, Medical, Rice'],
              ['HH-052','Tomas Ablan','Purok 4',5,'₱4,500','Near Poor','Rice'],
              ['HH-061','Corazon Ibanag','Purok 1',3,'₱5,100','Near Poor','Medical'],
            ].map(([id,head,purok,mem,inc,cls,prog]) => (
              <tr key={id}>
                <td><span className="font-mono text-[11px] text-teal">{id}</span></td>
                <td>{head}</td><td>{purok}</td><td>{mem}</td><td>{inc}</td>
                <td><span className={`badge ${cls==='Poor'?'badge-red':'badge-gold'}`}>{cls}</span></td>
                <td className="text-xs text-gray-500">{prog}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  )
}

// SectorStatistics.jsx
export function SectorStatistics() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="👴" value="207" label="Senior Citizens" change="16.1% of population" color="blue" />
        <StatCard icon="👩‍👧" value="34" label="Solo Parents" change="2.6% of population" color="teal" />
        <StatCard icon="♿" value="48" label="Persons with Disability" change="3.7% of population" color="gold" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Senior Citizens by Age Group">
          <div className="h-52">
            <Bar
              data={{ labels: ['60-69 yrs','70-79 yrs','80+ yrs'], datasets: [{ data: [98,67,42], backgroundColor: '#3B82F6', borderRadius: 6 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
            />
          </div>
        </SectionCard>
        <SectionCard title="PWD by Disability Type">
          <div className="h-52">
            <Bar
              data={{ labels: ['Physical','Visual','Hearing','Intellectual'], datasets: [{ data: [21,10,9,8], backgroundColor: '#F5A623', borderRadius: 6 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
            />
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Vulnerable Sector Registry">
        <table className="data-table">
          <thead><tr><th>Reg. No.</th><th>Name</th><th>Category</th><th>Purok</th><th>Age</th><th>Benefits</th><th>Status</th></tr></thead>
          <tbody>
            {[
              ['SC-001','Lucia Valdez','Senior Citizen','blue','Purok 5',67,'OSCA Pension'],
              ['SC-002','Benigno Cruz','Senior Citizen','blue','Purok 1',74,'OSCA Pension, Medical'],
              ['SP-001','Mia Balanoy','Solo Parent','teal','Purok 3',31,'Solo Parent ID, Livelihood'],
              ['PWD-001','Raul Domingo','PWD','gold','Purok 2',45,'PWD ID, Tax Exemption'],
              ['PWD-002','Carla Sta. Ana','PWD','gold','Purok 4',22,'PWD ID, Educational'],
            ].map(([no,name,cat,color,purok,age,benefits]) => (
              <tr key={no}>
                <td><span className="font-mono text-[11px] text-teal">{no}</span></td>
                <td>{name}</td>
                <td><span className={`badge badge-${color}`}>{cat}</span></td>
                <td>{purok}</td><td>{age}</td>
                <td className="text-xs text-gray-500">{benefits}</td>
                <td><span className="badge badge-teal">Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  )
}
