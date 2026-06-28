// ============================================================================
//  AdminTools.jsx  —  "System & Audit" (admin only)
// ----------------------------------------------------------------------------
//  Admin/governance tools that used to live in DILG Reports:
//    • Activity Log    — a live viewer of the audit_logs table (who changed what)
//    • Database Backup — downloads a full JSON backup of all barangay data, with
//      a simple schedule reminder.
//  Grouped under Admin (next to User Management) because these are system
//  administration functions, not report documents.
// ============================================================================

import { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard } from '../components/ui/index'
import { toast } from 'react-toastify'

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

// Pulls every table, bundles it into one JSON file, and triggers a download.
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

  // Build an in-memory link and click it to save the file to the user's machine.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `protect-backup-${exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)

  // Remember when we last backed up (in localStorage) so we can show the schedule.
  const now = Date.now()
  localStorage.setItem(BACKUP_KEY, now.toString())
  const log = JSON.parse(localStorage.getItem(BACKUP_LOG_KEY) || '[]')
  log.unshift({ date: exportedAt, rows: Object.values({ residents, households, incidents, beneficiaries, programs, surveys }).reduce((s, t) => s + (t?.length || 0), 0) })
  localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(log.slice(0, 5)))
  return log[0]
}

// Small hook holding all the backup UI state (last backup, schedule, etc.).
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
// Turns a timestamp into "5m ago" / "2h ago" / "3d ago".
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Builds a human-readable description of an audit row from its before/after JSON.
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

export default function AdminTools() {
  const { lastBackup, backupLog, backing, isOverdue, daysSince, doBackup, frequency, changeFrequency, nextDue, daysUntilDue } = useBackupState()

  // Live audit log — paginated (10 per page), auto-refreshes every 60 seconds.
  const LOG_PAGE_SIZE = 10
  const [logPage, setLogPage] = useState(0)   // 0-indexed
  const { data: auditData = { rows: [], count: 0 }, isFetching: logsFetching, refetch: refetchLogs } = useQuery({
    queryKey: ['audit-logs', logPage],
    placeholderData: keepPreviousData,   // v5: keep showing the old page while the next loads (no empty flash)
    queryFn: async () => {
      // NOTE: no FK between audit_logs.changed_by and profiles, so we can't embed
      // profiles(...) directly — fetch the log rows, then look up the actors.
      const from = logPage * LOG_PAGE_SIZE
      const to = from + LOG_PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('changed_at', { ascending: false })
        .range(from, to)
      if (error) { console.error('audit_logs read error:', error.message); throw error }
      const logs = data || []
      // Attach each actor's profile (name/role) via a separate lookup
      const ids = [...new Set(logs.map(l => l.changed_by).filter(Boolean))]
      let profById = {}
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, role').in('id', ids)
        profById = Object.fromEntries((profs || []).map(p => [p.id, p]))
      }
      return { rows: logs.map(l => ({ ...l, profiles: profById[l.changed_by] || null })), count: count || 0 }
    },
    refetchInterval: 60000,
  })
  const auditLogs = auditData.rows
  const totalLogs = auditData.count
  const totalLogPages = Math.max(1, Math.ceil(totalLogs / LOG_PAGE_SIZE))

  return (
    <div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#9A9488' }}>
                {totalLogs === 0 ? 'No entries' : `Showing ${logPage * LOG_PAGE_SIZE + 1}–${logPage * LOG_PAGE_SIZE + auditLogs.length} of ${totalLogs}`}
                <span style={{ color: '#C4BFB6' }}> · auto-refreshes every 60s</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-ghost text-xs"
                  disabled={logPage === 0}
                  onClick={() => setLogPage(p => Math.max(0, p - 1))}
                >← Prev</button>
                <span style={{ fontSize: 11, color: '#5A5A52' }}>Page {logPage + 1} of {totalLogPages}</span>
                <button
                  className="btn btn-ghost text-xs"
                  disabled={logPage >= totalLogPages - 1}
                  onClick={() => setLogPage(p => Math.min(totalLogPages - 1, p + 1))}
                >Next →</button>
              </div>
            </div>
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
    </div>
  )
}
