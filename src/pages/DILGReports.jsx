import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { SectionCard } from '../components/ui/index'
import { toast } from 'react-toastify'
import { exportToPDF } from '../lib/exportUtils'

// ── DATA BACKUP HELPERS ───────────────────────────────────────
const BACKUP_KEY = 'protect_last_backup'
const BACKUP_LOG_KEY = 'protect_backup_log'
const BACKUP_FREQ_KEY = 'protect_backup_freq'

// Backup schedule options (in days)
const BACKUP_SCHEDULES = [
  { value: 7,  label: 'Weekly' },
  { value: 14, label: 'Every 2 weeks' },
  { value: 30, label: 'Monthly' },
]

async function runBackup() {
  const [
    { data: residents },
    { data: households },
    { data: incidents },
    { data: beneficiaries },
    { data: programs },
    { data: surveys },
  ] = await Promise.all([
    supabase.from('residents').select('*'),
    supabase.from('households').select('*'),
    supabase.from('incidents').select('*'),
    supabase.from('beneficiaries').select('*'),
    supabase.from('assistance_programs').select('*'),
    supabase.from('survey_responses').select('*'),
  ])

  const exportedAt = new Date().toISOString()
  const blob = new Blob([JSON.stringify({
    system: 'PROTECT Barangay Analytics System',
    barangay: 'Barangay San Joaquin, Basco, Batanes',
    exportedAt,
    version: '1.0',
    tables: { residents, households, incidents, beneficiaries, assistance_programs: programs, survey_responses: surveys },
  }, null, 2)], { type: 'application/json' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `protect-backup-${exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)

  // Save backup log to localStorage
  const now = Date.now()
  localStorage.setItem(BACKUP_KEY, now.toString())
  const log = JSON.parse(localStorage.getItem(BACKUP_LOG_KEY) || '[]')
  log.unshift({ date: exportedAt, rows: Object.values({ residents, households, incidents, beneficiaries, programs, surveys }).reduce((s, t) => s + (t?.length || 0), 0) })
  localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(log.slice(0, 5)))
  return log[0]
}

function useBackupState() {
  const [lastBackup, setLastBackup] = useState(() => {
    const ts = localStorage.getItem(BACKUP_KEY)
    return ts ? new Date(parseInt(ts)) : null
  })
  const [backupLog, setBackupLog] = useState(() => JSON.parse(localStorage.getItem(BACKUP_LOG_KEY) || '[]'))
  const [backing, setBacking] = useState(false)
  const [frequency, setFrequency] = useState(() => Number(localStorage.getItem(BACKUP_FREQ_KEY)) || 7)

  // Next backup is due `frequency` days after the last one
  const nextDue = lastBackup ? new Date(lastBackup.getTime() + frequency * 86400000) : null
  const isOverdue = !lastBackup || (Date.now() - lastBackup.getTime()) > frequency * 86400000
  const daysSince = lastBackup ? Math.floor((Date.now() - lastBackup.getTime()) / 86400000) : null
  const daysUntilDue = nextDue ? Math.ceil((nextDue.getTime() - Date.now()) / 86400000) : null

  const changeFrequency = (days) => {
    setFrequency(days)
    localStorage.setItem(BACKUP_FREQ_KEY, String(days))
  }

  // On load, remind the user once if a scheduled backup is overdue
  useEffect(() => {
    if (isOverdue && lastBackup) {
      toast.warn('⏰ Scheduled backup is due — please download a backup.', { toastId: 'backup-due' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doBackup = async () => {
    setBacking(true)
    try {
      const entry = await runBackup()
      setLastBackup(new Date(entry.date))
      setBackupLog(JSON.parse(localStorage.getItem(BACKUP_LOG_KEY) || '[]'))
      toast.success('Backup downloaded successfully!')
    } catch (err) {
      toast.error('Backup failed: ' + err.message)
    } finally {
      setBacking(false)
    }
  }

  return { lastBackup, backupLog, backing, isOverdue, daysSince, doBackup, frequency, changeFrequency, nextDue, daysUntilDue }
}

// ── AUDIT LOG HELPERS ─────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function describeLog(log) {
  const d = log.action === 'DELETE' ? log.old_data : log.new_data
  if (!d) return `${log.table_name} record`
  if (log.table_name === 'residents') {
    const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || '—'
    return d.resident_no ? `${name} (${d.resident_no})` : name
  }
  if (log.table_name === 'households') {
    return `Household ${d.household_no || '—'}`
  }
  if (log.table_name === 'incidents') {
    return `${d.case_no || 'Incident'} — ${d.incident_type || ''}`
  }
  return `${log.table_name} record`
}

const ACTION_STYLE = {
  INSERT: { label: 'Added',   bg: '#E8F8F4', color: '#0D9E8C', dot: '#0D9E8C' },
  UPDATE: { label: 'Updated', bg: '#FFF8E8', color: '#B8860B', dot: '#C9A84C' },
  DELETE: { label: 'Deleted', bg: '#FFF0F0', color: '#B83232', dot: '#EF4444' },
}

const TABLE_LABEL = { residents: 'Resident', households: 'Household', incidents: 'Incident' }

export default function DILGReports() {
  const [preview, setPreview] = useState(null)
  const qc = useQueryClient()
  const { lastBackup, backupLog, backing, isOverdue, daysSince, doBackup, frequency, changeFrequency, nextDue, daysUntilDue } = useBackupState()

  // Activity Log + Database Backup are admin functions — hidden from external roles (e.g. DILG rep)
  const { profile } = useAuthStore()
  const isManager = ['admin', 'officer', 'brgy_sec'].includes(profile?.role)

  const { data: auditLogs = [], isFetching: logsFetching, refetch: refetchLogs } = useQuery({
    queryKey: ['audit-logs'],
    enabled: isManager,
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name, role)')
        .order('changed_at', { ascending: false })
        .limit(30)
      return data || []
    },
    refetchInterval: 60000,
  })

  // Pull live data for reports
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-report'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*')
      return data || []
    },
  })

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-report'],
    queryFn: async () => {
      const { data } = await supabase.from('incidents').select('*')
      return data || []
    },
  })

  const { data: beneficiaries = [] } = useQuery({
    queryKey: ['beneficiaries-report'],
    queryFn: async () => {
      const { data } = await supabase.from('beneficiaries').select('*, assistance_programs(name)')
      return data || []
    },
  })

  // Disaster risk zones — drives the live Disaster Risk Assessment report
  const { data: riskZones = [] } = useQuery({
    queryKey: ['risk-zones-report'],
    queryFn: async () => {
      const { data } = await supabase.from('disaster_risk_zones').select('hazard_type, risk_level')
      return data || []
    },
  })

  const RISK_RANK = { High: 3, Medium: 2, Low: 1 }
  const highestRisk = (hazard) => {
    const zs = riskZones.filter(z => z.hazard_type === hazard)
    if (!zs.length) return 'Not assessed'
    const max = Math.max(...zs.map(z => RISK_RANK[z.risk_level] || 0))
    return Object.keys(RISK_RANK).find(k => RISK_RANK[k] === max) || '—'
  }

  const total = residents.length
  const now = new Date()
  const getAge = dob => Math.floor((now - new Date(dob)) / 31557600000)
  const males = residents.filter(r => r.sex === 'Male').length
  const females = residents.filter(r => r.sex === 'Female').length
  const seniors = residents.filter(r => r.is_senior_citizen).length
  const pwds = residents.filter(r => r.is_pwd).length
  const soloParents = residents.filter(r => r.is_solo_parent).length
  const hhHeads = residents.filter(r => r.is_household_head).length
  const poorHH = residents.filter(r => r.is_household_head && (r.monthly_income || 0) < 10000).length
  const povertyRate = hhHeads > 0 ? ((poorHH / hhHeads) * 100).toFixed(1) : '—'
  const activeBen = beneficiaries.filter(b => b.status === 'Active').length
  const totalReleased = beneficiaries.reduce((s, b) => s + (b.total_released || 0), 0)
  const resolvedInc = incidents.filter(i => i.status === 'Resolved').length
  const resRate = incidents.length > 0 ? Math.round((resolvedInc / incidents.length) * 100) : 0
  const year = now.getFullYear()

  // Dynamic report data built from live Supabase values
  const previewData = {
    barangay: [
      ['Total Registered Population', total.toLocaleString()],
      ['Total Household Heads', hhHeads.toString()],
      ['Male', `${males} (${total ? ((males/total)*100).toFixed(1) : 0}%)`],
      ['Female', `${females} (${total ? ((females/total)*100).toFixed(1) : 0}%)`],
      ['Senior Citizens', `${seniors} (${total ? ((seniors/total)*100).toFixed(1) : 0}%)`],
      ['Persons with Disability (PWD)', `${pwds} (${total ? ((pwds/total)*100).toFixed(1) : 0}%)`],
      ['Solo Parents', `${soloParents} (${total ? ((soloParents/total)*100).toFixed(1) : 0}%)`],
      ['Poverty Incidence (HH Heads < ₱10K)', `${povertyRate}%`],
      ['Number of Sitios', '3'],
      ['Report Period', `CY ${year}`],
    ],
    cbms: [
      ['Total Population', total.toLocaleString()],
      ['Senior Citizens', seniors.toString()],
      ['PWD', pwds.toString()],
      ['Solo Parents', soloParents.toString()],
      ['HH Heads below poverty line', poorHH.toString()],
      ['Active Beneficiaries', activeBen.toString()],
      ['Total Assistance Distributed', `₱${totalReleased.toLocaleString()}`],
    ],
    peace: [
      ['Total Incidents (YTD)', incidents.length.toString()],
      ['Ongoing Cases', incidents.filter(i => i.status === 'Ongoing').length.toString()],
      ['Resolved Cases', resolvedInc.toString()],
      ['Escalated Cases', incidents.filter(i => i.status === 'Escalated').length.toString()],
      ['Resolution Rate', `${resRate}%`],
      ['Most Common Type', (() => {
        if (!incidents.length) return '—'
        const counts = {}
        incidents.forEach(i => { counts[i.incident_type] = (counts[i.incident_type] || 0) + 1 })
        return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—'
      })()],
    ],
    assist: [
      ['Active Beneficiaries', activeBen.toString()],
      ['Pending Claims', beneficiaries.filter(b => b.status === 'Pending').length.toString()],
      ['Completed', beneficiaries.filter(b => b.status === 'Completed').length.toString()],
      ['Total Distributed', `₱${totalReleased.toLocaleString()}`],
      ['Report Period', `CY ${year}`],
    ],
    sector: [
      ['Senior Citizens', `${seniors} (${total ? ((seniors/total)*100).toFixed(1) : 0}%)`],
      ['Solo Parents', `${soloParents} (${total ? ((soloParents/total)*100).toFixed(1) : 0}%)`],
      ['Persons with Disability', `${pwds} (${total ? ((pwds/total)*100).toFixed(1) : 0}%)`],
      ['Report Period', `CY ${year}`],
    ],
    disaster: [
      ['Typhoon Risk Level', highestRisk('Typhoon')],
      ['Flood Risk Level', highestRisk('Flood')],
      ['Landslide Risk Level', highestRisk('Landslide')],
      ['Storm Surge Risk Level', highestRisk('Storm Surge')],
      ['Total Risk Zones Mapped', riskZones.length.toString()],
      ['Total Households', hhHeads.toString()],
      ['Report Period', `CY ${year}`],
    ],
  }

  const reports = [
    { id: 'barangay', icon: '🏛️', title: 'Barangay Profile Report', desc: 'Demographic and socioeconomic profile', badge: 'DILG Standard', badgeColor: 'teal' },
    { id: 'cbms', icon: '📊', title: 'CBMS Statistical Report', desc: 'Community-Based Monitoring System', badge: 'Required', badgeColor: 'blue' },
    { id: 'peace', icon: '🛡️', title: 'Peace & Order Report', desc: 'Crime statistics and incident summary', badge: 'Quarterly', badgeColor: 'red' },
    { id: 'assist', icon: '🎁', title: 'Assistance & Beneficiary Report', desc: 'Distribution records and program status', badge: 'Monthly', badgeColor: 'gold' },
    { id: 'sector', icon: '♿', title: 'Vulnerable Sector Report', desc: 'SC, Solo Parent, PWD statistics', badge: 'Semi-Annual', badgeColor: 'gray' },
    { id: 'disaster', icon: '🌀', title: 'Disaster Risk Assessment', desc: 'Vulnerability mapping and evacuation data', badge: 'Annual', badgeColor: 'gold' },
  ]

  const activeReport = reports.find(r => r.id === preview)

  return (
    <div>
      <SectionCard title="Automated DILG Report Generation" subtitle="All figures pulled live from your Supabase database">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reports.map(r => (
            <div
              key={r.id}
              className="border border-gray-200 rounded-xl p-4 flex gap-3 items-start cursor-pointer hover:border-teal hover:bg-teal-50/50 transition-all"
              onClick={() => setPreview(r.id)}
            >
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">{r.icon}</div>
              <div>
                <div className="font-semibold text-[13px] text-navy">{r.title}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{r.desc}</div>
                <span className={`badge badge-${r.badgeColor} mt-1.5`}>{r.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {preview && activeReport && (
        <SectionCard
          title={`${activeReport.title} — Preview`}
          subtitle={`Auto-generated from live data · ${now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}`}
          action={
            <div className="flex gap-2">
              <button
                className="btn btn-ghost text-xs"
                onClick={() => exportToPDF({ title: activeReport.title, rows: previewData[preview] || [] })}
              >
                📄 Export PDF
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => setPreview(null)}>✕ Close</button>
            </div>
          }
        >
          <div className="bg-gray-50 rounded-xl p-6 border">
            <div className="text-center mb-5 pb-4 border-b-2 border-navy">
              <div className="text-[11px] text-gray-400 uppercase tracking-widest">Republic of the Philippines</div>
              <div className="text-[11px] text-gray-400">Province of Batanes · Municipality of Basco</div>
              <h2 className="font-display text-lg font-bold text-navy mt-2">{activeReport.title.toUpperCase()}</h2>
              <p className="text-sm text-gray-400 mt-1">Barangay San Joaquin · CY {year}</p>
            </div>
            <div className="overflow-x-auto"><table className="data-table">
              <thead><tr><th>Indicator</th><th>Value</th></tr></thead>
              <tbody>
                {(previewData[preview] || []).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td><strong>{v}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      )}

      {/* Activity Log + Database Backup — admin only (hidden from DILG rep) */}
      {isManager && (<>
      {/* ── ACTIVITY LOG ────────────────────────────────── */}
      <SectionCard
        title="Activity Log"
        subtitle="Live record of every add, update, and delete across residents, households, and incidents"
        action={
          <button
            className="btn btn-ghost text-xs flex items-center gap-1"
            onClick={() => refetchLogs()}
            disabled={logsFetching}
          >
            {logsFetching ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
        }
      >
        {auditLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#C4BFB6', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            No activity yet. Changes to residents, households, and incidents will appear here.
            <div style={{ fontSize: 11, marginTop: 6, color: '#D4CFC6' }}>
              Make sure you ran <code>audit_logs.sql</code> in Supabase first.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Time</th>
                  <th style={{ width: 80 }}>Action</th>
                  <th style={{ width: 90 }}>Table</th>
                  <th>Record</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => {
                  const a = ACTION_STYLE[log.action] || ACTION_STYLE.UPDATE
                  return (
                    <tr key={log.id}>
                      <td>
                        <span style={{ fontSize: 11, color: '#9A9488' }} title={new Date(log.changed_at).toLocaleString('en-PH')}>
                          {timeAgo(log.changed_at)}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: a.bg, color: a.color }}>
                          {a.label}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: '#5A5A52' }}>
                          {TABLE_LABEL[log.table_name] || log.table_name}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#1A1A2E', fontWeight: 500 }}>
                        {describeLog(log)}
                      </td>
                      <td style={{ fontSize: 11, color: '#9A9488' }}>
                        {log.profiles?.full_name || log.profiles?.role || (log.changed_by ? 'User' : 'System')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p style={{ fontSize: 10, color: '#C4BFB6', marginTop: 8, textAlign: 'right' }}>
              Showing last 30 entries · Auto-refreshes every 60s
            </p>
          </div>
        )}
      </SectionCard>

      {/* ── DATABASE BACKUP ─────────────────────────────── */}
      <SectionCard
        title="Database Backup"
        subtitle="Download a full JSON backup of all barangay data"
        action={
          isOverdue ? (
            <span className="badge badge-red">
              {daysSince === null ? 'Never backed up' : `Overdue — ${daysSince}d ago`}
            </span>
          ) : (
            <span className="badge badge-teal">
              Backed up {daysSince === 0 ? 'today' : `${daysSince}d ago`}
            </span>
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div style={{ padding: '16px', background: isOverdue ? '#FFF0F0' : '#F0FBF9', border: `1px solid ${isOverdue ? '#F5C6C6' : '#B3E8E2'}`, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{isOverdue ? '⚠️' : '✅'}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: isOverdue ? '#B83232' : '#0D9E8C' }}>
              {isOverdue ? 'Backup Overdue' : 'Up to Date'}
            </div>
            <div style={{ fontSize: 11, color: '#9A9488', marginTop: 2 }}>
              {lastBackup ? `Last: ${lastBackup.toLocaleDateString('en-PH')}` : 'No backup yet'}
            </div>
          </div>
          <div style={{ padding: '16px', background: '#F5F2EC', border: '1px solid #E8E4DA', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📦</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>What's Included</div>
            <div style={{ fontSize: 10, color: '#9A9488', marginTop: 2, lineHeight: 1.6 }}>
              Residents · Households<br/>Incidents · Beneficiaries<br/>Programs · Surveys
            </div>
          </div>
          <div style={{ padding: '16px', background: '#F5F2EC', border: '1px solid #E8E4DA', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🗓️</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>Backup Schedule</div>
            <select
              value={frequency}
              onChange={e => changeFrequency(Number(e.target.value))}
              style={{ fontSize: 11, padding: '3px 6px', marginTop: 6, border: '1px solid #D4D0C8', borderRadius: 4, fontFamily: 'Inter,sans-serif', color: '#1A1A2E' }}
            >
              {BACKUP_SCHEDULES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div style={{ fontSize: 10, color: '#9A9488', marginTop: 6, lineHeight: 1.5 }}>
              {nextDue
                ? (isOverdue
                    ? <span style={{ color: '#B83232', fontWeight: 600 }}>Due now</span>
                    : <>Next due: {nextDue.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}<br/>({daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''} left)</>)
                : 'Run your first backup to start the schedule'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <button
            className="btn btn-primary"
            onClick={doBackup}
            disabled={backing}
            style={{ minWidth: 160 }}
          >
            {backing ? '⏳ Backing up...' : '⬇️ Download Backup'}
          </button>
          <p style={{ fontSize: 11, color: '#9A9488', margin: 0 }}>
            Downloads a <code>.json</code> file with all data. Store it in a safe location.
          </p>
        </div>

        {backupLog.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9A9488', marginBottom: 8 }}>Recent Backups</div>
            <div className="overflow-x-auto"><table className="data-table">
              <thead><tr><th>#</th><th>Date &amp; Time</th><th>Records</th></tr></thead>
              <tbody>
                {backupLog.map((b, i) => (
                  <tr key={i}>
                    <td>{backupLog.length - i}</td>
                    <td>{new Date(b.date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>{(b.rows || 0).toLocaleString()} records</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
      </>)}
    </div>
  )
}
