// ============================================================================
//  NeedsAssessment.jsx  —  "Community Needs Assessment" (staff view)
// ----------------------------------------------------------------------------
//  Aggregates the needs survey responses that residents submit through the
//  public form. Shows how many responses came in, ranks the priority needs,
//  and how many sitios are covered. Read-only — residents do the submitting on
//  the public page; staff only review the results here.
// ============================================================================

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

        <SectionCard title="Recent Submissions" action={<span className="badge badge-teal">{responses.length} responses</span>}>
          {responses.length > 0 ? (
            <div className="space-y-3" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {[...responses]
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                .slice(0, 30)
                .map(r => (
                  <div key={r.id} className="flex gap-3 p-3 rounded-lg border border-gray-100">
                    {/* Photo thumbnail (click to open full size) — only if attached */}
                    {r.photo_url && (
                      <a href={r.photo_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <img src={r.photo_url} alt="submission" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #E2E8F0' }} />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[13px] font-medium text-navy">{r.priority_need}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{r.purok}</span>
                      </div>
                      {r.comments && <p className="text-xs text-gray-600 mt-1 break-words">{r.comments}</p>}
                      <div className="text-[10px] text-gray-400 mt-1">
                        {r.photo_url ? '📷 photo attached · ' : ''}{r.created_at ? new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-sm text-navy font-medium mb-2">No responses yet</p>
              <p className="text-xs text-gray-400">
                Residents submit their needs through the public portal at <span className="font-mono text-teal">/announcements</span>
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
