import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard } from '../components/ui/index'

export default function NeedsAssessment() {
  const { data: responses = [] } = useQuery({
    queryKey: ['survey-responses'],
    queryFn: async () => {
      const { data } = await supabase.from('survey_responses').select('*')
      return data || []
    },
  })

  const needOptions = [
    { need: 'Health Services', icon: '🏥' },
    { need: 'Road / Infrastructure', icon: '🛣️' },
    { need: 'Educational Support', icon: '🎓' },
    { need: 'Livelihood Programs', icon: '💼' },
    { need: 'Water Supply', icon: '💧' },
    { need: 'Peace & Order', icon: '🚔' },
    { need: 'Others', icon: '📌' },
  ]

  // Count responses per need from live data
  const needCounts = needOptions.map(n => ({
    ...n,
    count: responses.filter(r => r.priority_need === n.need).length,
  }))
  const maxCount = Math.max(...needCounts.map(n => n.count), 1)
  const topNeed = needCounts.sort((a, b) => b.count - a.count)[0]

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard icon="📋" value={responses.length} label="Survey Responses" color="teal" />
        <StatCard icon="🏆" value={responses.length > 0 ? topNeed.need.split(' ')[0] : '—'} label="Top Priority Need" color="gold" />
        <StatCard icon="🗂️" value={[...new Set(responses.map(r => r.purok))].length || 0} label="Sitios Covered" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Priority Needs Ranking" subtitle={`Based on ${responses.length} response${responses.length !== 1 ? 's' : ''}`}>
          {responses.length > 0 ? (
            <div className="space-y-3">
              {needCounts.sort((a, b) => b.count - a.count).map(n => (
                <div key={n.need} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{n.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="text-navy font-medium">{n.need}</span>
                      <span className="text-gray-500">{n.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div
                        className="h-2 bg-teal rounded-full transition-all"
                        style={{ width: `${(n.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-300 text-sm py-8">No survey responses yet.</p>
          )}
        </SectionCard>

        <SectionCard title="Response Summary" action={<span className="badge badge-teal">{responses.length} responses</span>}>
          <div className="text-center py-6">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm text-navy font-medium mb-2">Community responses are being collected</p>
            <p className="text-xs text-gray-400">
              Residents submit their needs through the public portal at <span className="font-mono text-teal">/announcements</span>
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
