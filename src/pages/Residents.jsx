// ============================================================================
//  Residents.jsx  —  "Resident Profiling" (the biggest, most-used page)
// ----------------------------------------------------------------------------
//  The master registry of residents: search / filter / sort, add / edit / view,
//  CSV & XLSX import, PDF/Excel export, and PII masking (contact & PhilHealth
//  numbers are hidden until revealed). Key rule: marking a resident as a
//  "Household Head" AUTO-CREATES a household with the next 4-digit number
//  (HH-0001). All form input is sanitized (sanitize.js) before saving, and edits
//  are gated by canEdit() so read-only roles see no add/edit/delete buttons.
// ============================================================================

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { supabase } from '../lib/supabase'
import { mockResidents } from '../lib/mockData'
import { SectionCard, Badge, Modal, Loader, EmptyState } from '../components/ui/index'
import { Plus, Search, Eye, Edit2, Download, FileSpreadsheet, Upload, CreditCard } from 'lucide-react'
import QRCode from 'react-qr-code'
import { exportResidentsToPDF, exportResidentsToExcel } from '../lib/exportUtils'
import { sanitizeResidentForm } from '../lib/sanitize'
import { useAuthStore } from '../store/authStore'
import { canEdit } from '../lib/permissions'
import * as XLSX from 'xlsx'

const PUROKS = ['Sitio Hunan', 'Sitio Hagu', 'Sitio Tuva']
const CIVIL = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
const emptyForm = {
  resident_no: '', first_name: '', last_name: '', middle_name: '', date_of_birth: '',
  sex: 'Male', civil_status: 'Single', purok: 'Sitio Hunan', monthly_income: '',
  occupation: '', contact_number: '',
  is_household_head: false, is_pwd: false, pwd_type: '', is_solo_parent: false,
  is_senior_citizen: false, is_voter: false, is_out_of_school_youth: false,
  household_id: '',
}

// Build the list of page buttons: first, last, current ±1, with "…" gaps.
function pageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items = [1]
  if (current > 3) items.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) items.push(i)
  if (current < total - 2) items.push('…')
  items.push(total)
  return items
}

// Auto-generate next HH No. based on existing households
async function generateHouseholdNo() {
  const { data } = await supabase
    .from('households')
    .select('household_no')
    .order('created_at', { ascending: false })
  if (!data || data.length === 0) return 'HH-0001'
  // Extract numeric parts and find max
  const nums = data
    .map(h => parseInt((h.household_no || '').replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `HH-${String(next).padStart(4, '0')}`
}

export default function Residents() {
  const { profile } = useAuthStore()
  const canWrite = canEdit(profile?.role)

  const [search, setSearch] = useState('')
  const [sitioFilter, setSitioFilter]   = useState('All')
  const [sectorFilter, setSectorFilter] = useState('All')
  const [sortKey, setSortKey] = useState('resident_no')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)   // residents table pagination (1-indexed)
  const PAGE_SIZE = 10
  const tableScrollRef = useRef(null)   // to reset scroll to top when the page changes
  const [modalOpen, setModalOpen] = useState(false)
  const [viewResident, setViewResident] = useState(null)
  const [showSensitive, setShowSensitive] = useState(false)   // mask PII (contact, PhilHealth) until revealed

  // Mask sensitive values — show only the last 4 characters
  const maskPII = (val) => {
    if (!val) return '—'
    const s = String(val)
    return s.length <= 4 ? '••••' : '•'.repeat(s.length - 4) + s.slice(-4)
  }
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStats, setUploadStats] = useState(null)
  const [idResident, setIdResident] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const fileInputRef = useRef(null)
  const exportRef = useRef(null)
  const qc = useQueryClient()

  const makeQrData = (r) => JSON.stringify({
    id: r.resident_no,
    name: `${r.first_name} ${r.last_name}`,
    purok: r.purok,
    barangay: 'San Joaquin',
    issued: new Date().toISOString().split('T')[0],
  })

  const handlePrintResidentID = (r) => {
    const qrSvg = document.getElementById('res-id-qr')?.querySelector('svg')?.outerHTML || ''
    const dob = r.date_of_birth
      ? new Date(r.date_of_birth).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      : '—'
    const issued = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    const win = window.open('', '_blank', 'width=700,height=520')
    win.document.write(`<!DOCTYPE html><html><head>
<title>Barangay ID — ${r.first_name} ${r.last_name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#e5e5e5}
  .card{width:85.6mm;background:#fff;border:2px solid #1A3A5C;border-radius:4mm;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.2)}
  .hdr{background:#1A3A5C;color:#fff;text-align:center;padding:3mm 2mm;border-bottom:3px solid #C9A84C}
  .hdr .r{font-size:5.5pt;letter-spacing:.4pt;opacity:.85}
  .hdr .b{font-size:8pt;font-weight:700;margin:1mm 0 .5mm}
  .hdr .t{font-size:6pt;color:#C9A84C;letter-spacing:1.5pt;font-weight:700}
  .body{display:flex;gap:3mm;padding:3mm}
  .photo{width:18mm;height:22mm;border:1.5px solid #ccc;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#f8f8f8;font-size:5pt;color:#aaa;text-align:center;border-radius:1mm}
  .info{flex:1}
  .name{font-size:8pt;font-weight:700;color:#1A1A2E;margin-bottom:2mm}
  .row{font-size:6pt;color:#333;margin-bottom:1mm}
  .lbl{color:#888;font-size:5.5pt}
  .qr{display:flex;align-items:flex-start;justify-content:center;padding-top:1mm}
  .qr svg{width:18mm!important;height:18mm!important}
  .ftr{background:#f0ede4;border-top:1px solid #d4d0c8;padding:2mm 3mm;display:flex;justify-content:space-between;align-items:flex-end}
  .sig{font-size:4.5pt;color:#444;text-align:center}
  .sig .line{border-top:1px solid #444;width:22mm;margin-bottom:.8mm}
  @media print{body{background:#fff}}
</style></head><body>
<div class="card">
  <div class="hdr">
    <div class="r">REPUBLIC OF THE PHILIPPINES</div>
    <div class="r">Province of Batanes &bull; Municipality of Basco</div>
    <div class="b">BARANGAY SAN JOAQUIN</div>
    <div class="t">BARANGAY IDENTIFICATION CARD</div>
  </div>
  <div class="body">
    <div class="photo">PHOTO<br/>HERE</div>
    <div class="info">
      <div class="name">${r.last_name.toUpperCase()}, ${r.first_name.toUpperCase()}</div>
      <div class="row"><span class="lbl">Resident No.: </span>${r.resident_no}</div>
      <div class="row"><span class="lbl">Sitio: </span>${r.purok}</div>
      <div class="row"><span class="lbl">Date of Birth: </span>${dob}</div>
      <div class="row"><span class="lbl">Sex: </span>${r.sex}</div>
    </div>
    <div class="qr">${qrSvg}</div>
  </div>
  <div class="ftr">
    <div class="sig"><div class="line"></div>Punong Barangay</div>
    <div class="sig" style="text-align:right"><span class="lbl">Issued:</span><br/>${issued}</div>
  </div>
</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`)
    win.document.close()
  }

  const { data: residents = mockResidents, isLoading } = useQuery({
    queryKey: ['residents'],
    queryFn: async () => {
      // Read the residents table directly (not the residents_with_age view):
      // the view has a fixed column list that omits newer columns like
      // is_out_of_school_youth, which made the OSY badge never appear. The table
      // has every column plus `age`, and the UI computes age as a fallback.
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .order('resident_no')
      if (error || !data?.length) return mockResidents
      return data
    },
  })

  const { data: households = [] } = useQuery({
    queryKey: ['households-list'],
    queryFn: async () => {
      const [{ data: hhs }, { data: heads }] = await Promise.all([
        supabase.from('households').select('id, household_no, head_name').order('household_no'),
        supabase.from('residents').select('household_id, first_name, last_name').eq('is_household_head', true),
      ])
      // Build a map of household_id → HH Head full name from the residents table
      const headMap = {}
      ;(heads || []).forEach(r => { headMap[r.household_id] = `${r.first_name} ${r.last_name}` })
      // Prefer stored head_name; fall back to the actual HH Head resident's name
      return (hhs || []).map(h => ({
        ...h,
        head_name: h.head_name || headMap[h.id] || null,
      }))
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const wantsHead   = payload.is_household_head
      const fullName    = `${payload.first_name} ${payload.last_name}`
      const selectedHH  = payload.household_id || null   // household chosen in the form (may be null)

      // Only send columns that actually exist on the residents table, so a form
      // field or a trimmed/renamed column can never cause a "column does not
      // exist" insert failure. (age is computed in the app, not stored on save.)
      const RESIDENT_COLS = [
        'resident_no', 'first_name', 'last_name', 'middle_name', 'date_of_birth',
        'sex', 'civil_status', 'purok', 'monthly_income', 'occupation', 'contact_number',
        'is_household_head', 'is_pwd', 'pwd_type', 'is_solo_parent', 'is_senior_citizen',
        'is_voter', 'is_out_of_school_youth', 'household_id',
      ]
      const clean = (obj) => Object.fromEntries(
        Object.entries(obj).filter(([k]) => RESIDENT_COLS.includes(k))
      )

      // Make `householdId` headed by this resident: stamp head_name and demote
      // whoever was previously flagged head of that household (excluding ourself).
      const promoteToHead = async (householdId, excludeResidentId) => {
        let demote = supabase.from('residents')
          .update({ is_household_head: false })
          .eq('household_id', householdId)
          .eq('is_household_head', true)
        if (excludeResidentId) demote = demote.neq('id', excludeResidentId)
        await demote
        await supabase.from('households').update({ head_name: fullName }).eq('id', householdId)
      }

      // Create a brand-new household for this resident and return its id.
      const createHousehold = async () => {
        const household_no = await generateHouseholdNo()
        const { data: newHH, error: hhErr } = await supabase
          .from('households')
          .insert({ household_no, purok: payload.purok, head_name: fullName })
          .select('id')
          .single()
        if (hhErr) throw hhErr
        return newHH.id
      }

      if (editId) {
        // --- EDIT MODE ---
        const { data: oldResident } = await supabase
          .from('residents')
          .select('is_household_head, household_id')
          .eq('id', editId)
          .single()

        if (wantsHead) {
          if (selectedHH) {
            // Make this resident the head of the EXISTING selected household
            await promoteToHead(selectedHH, editId)
            payload.household_id = selectedHH
          } else if (oldResident?.household_id) {
            // No new selection but already in a household → become its head
            await promoteToHead(oldResident.household_id, editId)
            payload.household_id = oldResident.household_id
          } else {
            // Not in any household → create a fresh one
            payload.household_id = await createHousehold()
          }
        } else {
          // Not a head — they're a plain member of whatever they selected (or none)
          payload.household_id = selectedHH
          // If they USED to be a head, drop the head_name on their old household
          if (oldResident?.is_household_head && oldResident?.household_id) {
            await supabase.from('households').update({ head_name: null }).eq('id', oldResident.household_id)
          }
        }

        const { error } = await supabase.from('residents').update(clean(payload)).eq('id', editId)
        if (error) throw error

      } else {
        // --- ADD MODE ---
        let household_id = selectedHH

        if (wantsHead) {
          if (selectedHH) {
            // New resident becomes head of the EXISTING selected household
            await promoteToHead(selectedHH, null)
            household_id = selectedHH
          } else {
            // Create a fresh household for them
            household_id = await createHousehold()
          }
        }

        const { error } = await supabase.from('residents').insert(clean({ ...payload, household_id }))
        if (error) {
          // If we just created a household for this (would-be) head, roll it back
          // so a failed insert doesn't leave an orphan household pin behind.
          if (wantsHead && !selectedHH && household_id) {
            await supabase.from('households').delete().eq('id', household_id)
          }
          throw error
        }
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Resident updated!' : 'Resident added!')
      qc.invalidateQueries(['residents'])
      qc.invalidateQueries(['households-list']) // refresh the "Assign to Household" dropdown
      qc.invalidateQueries(['households-map'])  // refresh GIS map too
      setModalOpen(false)
      setForm(emptyForm)
      setEditId(null)
    },
    onError: (err) => toast.error(err.message),
  })

  // ── CSV / XLSX Upload Handler ──
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-uploaded
    e.target.value = ''

    setUploading(true)
    setUploadStats(null)

    try {
      // 1. Parse the file
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (!rows.length) {
        toast.error('File is empty or has no valid rows.')
        setUploading(false)
        return
      }

      // 2. Map Excel columns → DB fields
      const yesNo = (val) => String(val).trim().toLowerCase() === 'yes'

      const mapped = rows.map(row => ({
        resident_no:            String(row['Resident No.'] || '').trim(),
        last_name:              String(row['Last Name'] || '').trim(),
        first_name:             String(row['First Name'] || '').trim(),
        middle_name:            String(row['Middle Name'] || '').trim() || null,
        purok:                  String(row['Purok'] || row['Sitio'] || '').trim(),
        date_of_birth:          row['Date of Birth'] ? String(row['Date of Birth']).trim() : null,
        sex:                    String(row['Sex'] || 'Male').trim(),
        civil_status:           String(row['Civil Status'] || 'Single').trim(),
        is_household_head:      yesNo(row['HH Head']),
        is_pwd:                 yesNo(row['PWD']),
        pwd_type:               String(row['PWD Type'] || '').trim() || null,
        is_solo_parent:         yesNo(row['Solo Parent']),
        is_senior_citizen:      yesNo(row['Senior Citizen']),
        monthly_income:         row['Monthly Income'] ? Number(row['Monthly Income']) || 0 : 0,
        occupation:             String(row['Occupation'] || '').trim() || null,
        contact_number:         row['Contact No.'] ? String(row['Contact No.']).trim() : null,
        is_voter:               yesNo(row['Voter'] || ''),
        is_out_of_school_youth: yesNo(row['OSY'] || row['Out-of-School Youth'] || ''),
      })).filter(r => r.resident_no && r.first_name && r.last_name)

      if (!mapped.length) {
        toast.error('No valid rows found. Make sure columns match the expected format.')
        setUploading(false)
        return
      }

      // 3. Get existing residents to determine insert vs update
      const { data: existing } = await supabase
        .from('residents')
        .select('id, resident_no, is_household_head, household_id')

      const existingMap = {}
      ;(existing || []).forEach(r => { existingMap[r.resident_no] = r })

      let inserted = 0, updated = 0, hhCreated = 0, errors = 0

      // 4. Process each row
      for (const row of mapped) {
        try {
          const existingResident = existingMap[row.resident_no]

          if (existingResident) {
            // ── UPDATE existing resident ──
            const payload = { ...row }

            // Handle HH Head change on update
            const becameHHHead = row.is_household_head && !existingResident.is_household_head
            const removedHHHead = !row.is_household_head && existingResident.is_household_head

            if (becameHHHead) {
              const household_no = await generateHouseholdNo()
              const { data: newHH, error: hhErr } = await supabase
                .from('households')
                .insert({
                  household_no,
                  purok: row.purok,
                  head_name: `${row.first_name} ${row.last_name}`,
                })
                .select('id')
                .single()
              if (!hhErr) {
                payload.household_id = newHH.id
                hhCreated++
              }
            } else if (removedHHHead && existingResident.household_id) {
              payload.household_id = null
            }

            const { error } = await supabase
              .from('residents')
              .update(payload)
              .eq('id', existingResident.id)
            if (error) throw error
            updated++

          } else {
            // ── INSERT new resident ──
            let household_id = null

            if (row.is_household_head) {
              const household_no = await generateHouseholdNo()
              const { data: newHH, error: hhErr } = await supabase
                .from('households')
                .insert({
                  household_no,
                  purok: row.purok,
                  head_name: `${row.first_name} ${row.last_name}`,
                })
                .select('id')
                .single()
              if (!hhErr) {
                household_id = newHH.id
                hhCreated++
              }
            }

            const { error } = await supabase
              .from('residents')
              .insert({ ...row, household_id })
            if (error) throw error
            inserted++
          }
        } catch (err) {
          console.error(`Error processing ${row.resident_no}:`, err)
          errors++
        }
      }

      // 5. Show results
      setUploadStats({ total: mapped.length, inserted, updated, hhCreated, errors })
      qc.invalidateQueries(['residents'])
      qc.invalidateQueries(['households-map'])
      toast.success(`Import complete! ${inserted} added, ${updated} updated.`)

    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to parse file. Please check the format.')
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (r) => {
    setForm({ ...r })
    setEditId(r.id)
    setModalOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.resident_no) form.resident_no = `RES-${String(residents.length + 1).padStart(4, '0')}`
    const sanitized = sanitizeResidentForm(form)
    saveMutation.mutate(sanitized)
  }

  const resAge = (r) => r.age ?? Math.floor((Date.now() - new Date(r.date_of_birth)) / 31557600000)

  // Sector membership test for the sector dropdown
  const matchesSector = (r) => {
    switch (sectorFilter) {
      case 'Senior':      return r.is_senior_citizen
      case 'PWD':         return r.is_pwd
      case 'Solo Parent': return r.is_solo_parent
      case 'OSY':         return r.is_out_of_school_youth
      case 'HH Head':     return r.is_household_head
      default:            return true
    }
  }

  // Search + sitio + sector filters
  const filtered = residents.filter(r =>
    `${r.first_name} ${r.last_name} ${r.resident_no} ${r.purok}`.toLowerCase().includes(search.toLowerCase())
    && (sitioFilter === 'All' || r.purok === sitioFilter)
    && matchesSector(r)
  )

  // Column sort
  const sorted = [...filtered].sort((a, b) => {
    let av, bv
    if (sortKey === 'name') { av = `${a.last_name} ${a.first_name}`; bv = `${b.last_name} ${b.first_name}` }
    else if (sortKey === 'age') { av = resAge(a); bv = resAge(b) }
    else { av = a[sortKey] ?? ''; bv = b[sortKey] ?? '' }
    if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase() }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  // Pagination — clamp the current page to the available range, then slice
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset the table scroll to the top whenever the page changes, so switching
  // to a shorter page never leaves the view scrolled past the (fewer) rows.
  useEffect(() => { tableScrollRef.current?.scrollTo({ top: 0 }) }, [safePage])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)   // jump back to the first page when the sort changes
  }
  const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  const statusBadge = (r) => {
    const badges = []
    if (r.is_senior_citizen) badges.push(<Badge key="senior" variant="blue">Senior</Badge>)
    if (r.is_pwd) badges.push(<Badge key="pwd" variant="gold">PWD</Badge>)
    if (r.is_solo_parent) badges.push(<Badge key="solo" variant="teal">Solo Parent</Badge>)
    if (r.is_out_of_school_youth) badges.push(<Badge key="osy" variant="red">OSY</Badge>)
    if (!badges.length) return <span style={{ fontSize: 11, color: '#C4BFB6' }}>—</span>
    return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{badges}</div>
  }

  return (
    <div>
      <SectionCard
        title="Household Profiling Dashboard"
        subtitle={`${residents.length} residents registered`}
        action={
          <div className="flex gap-2">
            {/* Export dropdown */}
            <div ref={exportRef} style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost flex items-center gap-1.5 text-xs"
                onClick={() => setShowExportMenu(v => !v)}
              >
                <Download size={13} /> Export ▾
              </button>
              {showExportMenu && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 140, overflow: 'hidden',
                  }}>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#1A1A2E', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F5F2EC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onClick={() => { exportResidentsToPDF(residents); setShowExportMenu(false) }}
                    >
                      <Download size={13} style={{ color: '#B83232' }} /> Export as PDF
                    </button>
                    <div style={{ borderTop: '1px solid #F0EDE4' }} />
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#1A1A2E', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F5F2EC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onClick={() => { exportResidentsToExcel(residents); setShowExportMenu(false) }}
                    >
                      <FileSpreadsheet size={13} style={{ color: '#1D6F42' }} /> Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
            {canWrite && (
              <>
                <button
                  className="btn btn-ghost flex items-center gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={13} /> {uploading ? 'Importing...' : 'Import'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button className="btn btn-primary flex items-center gap-2" onClick={() => { setForm(emptyForm); setEditId(null); setModalOpen(true) }}>
                  <Plus size={14} /> Add Resident
                </button>
              </>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="form-input pl-8"
              placeholder="Search name, ID, or sitio..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select className="form-select w-auto" value={sitioFilter} onChange={e => { setSitioFilter(e.target.value); setPage(1) }}>
            <option value="All">All Sitios</option>
            {PUROKS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="form-select w-auto" value={sectorFilter} onChange={e => { setSectorFilter(e.target.value); setPage(1) }}>
            <option value="All">All Sectors</option>
            <option value="Senior">Senior Citizen</option>
            <option value="PWD">PWD</option>
            <option value="Solo Parent">Solo Parent</option>
            <option value="OSY">Out-of-School Youth</option>
            <option value="HH Head">Household Head</option>
          </select>
          <span className="text-xs text-gray-400 ml-auto">{sorted.length} of {residents.length} shown</span>
        </div>

        {isLoading ? <Loader /> : sorted.length === 0 ? <EmptyState message="No residents found" /> : (
          <div ref={tableScrollRef} className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff' }}>
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('resident_no')}>Res. ID{sortArrow('resident_no')}</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Name{sortArrow('name')}</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('purok')}>Sitio{sortArrow('purok')}</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('age')}>Age{sortArrow('age')}</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('sex')}>Sex{sortArrow('sex')}</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('civil_status')}>Civil Status{sortArrow('civil_status')}</th>
                  <th>HH Head</th><th>Category</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="font-mono text-[11px] text-teal">{r.resident_no}</span></td>
                    <td><strong>{r.first_name} {r.last_name}</strong></td>
                    <td>{r.purok}</td>
                    <td>{r.age ?? Math.floor((Date.now() - new Date(r.date_of_birth)) / 31557600000)}</td>
                    <td>{r.sex}</td>
                    <td>{r.civil_status}</td>
                    <td>{r.is_household_head ? <Badge variant="teal">Yes</Badge> : <Badge variant="gray">No</Badge>}</td>
                    <td>{statusBadge(r)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost px-2 py-1 text-xs flex items-center gap-1" onClick={() => setViewResident(r)}><Eye size={12} /> View</button>
                        {canWrite && (
                          <button className="btn btn-ghost px-2 py-1 text-xs flex items-center gap-1" onClick={() => handleEdit(r)}><Edit2 size={12} /> Edit</button>
                        )}
                        <button className="btn btn-ghost px-2 py-1 text-xs flex items-center gap-1" onClick={() => setIdResident(r)}><CreditCard size={12} /> ID</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — numbered */}
        {!isLoading && sorted.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <span className="text-xs text-gray-400">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{(safePage - 1) * PAGE_SIZE + pageRows.length} of {sorted.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className="btn btn-ghost text-xs"
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >‹ Previous</button>

              {pageItems(safePage, totalPages).map((it, i) =>
                it === '…' ? (
                  <span key={`e${i}`} style={{ padding: '0 6px', color: '#9A9488', fontSize: 12 }}>…</span>
                ) : (
                  <button
                    key={it}
                    onClick={() => setPage(it)}
                    style={{
                      minWidth: 30, height: 30, borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: it === safePage ? '1px solid #0D9E8C' : '1px solid #E8E4DA',
                      background: it === safePage ? '#0D9E8C' : '#fff',
                      color: it === safePage ? '#fff' : '#1A1A2E',
                      fontWeight: it === safePage ? 700 : 500,
                    }}
                  >{it}</button>
                )
              )}

              <button
                className="btn btn-ghost text-xs"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >Next ›</button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Resident' : 'Add New Resident'}>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="form-label">First Name *</label>
              <input className="form-input mt-1" required value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input className="form-input mt-1" required value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Middle Name</label>
              <input className="form-input mt-1" value={form.middle_name} onChange={e => setForm({...form, middle_name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Date of Birth *</label>
              <input type="date" className="form-input mt-1" required value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Sex *</label>
              <select className="form-select mt-1" value={form.sex} onChange={e => setForm({...form, sex: e.target.value})}>
                <option>Male</option><option>Female</option>
              </select>
            </div>
            <div>
              <label className="form-label">Civil Status</label>
              <select className="form-select mt-1" value={form.civil_status} onChange={e => setForm({...form, civil_status: e.target.value})}>
                {CIVIL.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Sitio *</label>
              <select className="form-select mt-1" value={form.purok} onChange={e => setForm({...form, purok: e.target.value})}>
                {PUROKS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Monthly Income (₱) *</label>
              <input type="number" className="form-input mt-1" required min="0" placeholder="0" value={form.monthly_income} onChange={e => setForm({...form, monthly_income: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Occupation</label>
              <input className="form-input mt-1" value={form.occupation} onChange={e => setForm({...form, occupation: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Contact Number</label>
              <input className="form-input mt-1" value={form.contact_number} onChange={e => setForm({...form, contact_number: e.target.value})} />
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="form-label mb-2">Special Categories</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['is_household_head', 'Household Head'],
                ['is_voter', 'Registered Voter'],
                ['is_pwd', 'Person with Disability (PWD)'],
                ['is_solo_parent', 'Solo Parent'],
                ['is_senior_citizen', 'Senior Citizen (60+)'],
                ['is_out_of_school_youth', 'Out-of-School Youth (OSY)'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form[key]} onChange={e => setForm({...form, [key]: e.target.checked})} className="rounded" />
                  {label}
                </label>
              ))}
            </div>

            {/* Household section — adapts to whether this resident is the head */}
            {form.is_household_head ? (
              <div className="mt-3">
                <label className="form-label">Household (as head)</label>
                <select
                  className="form-select mt-1"
                  value={form.household_id || ''}
                  onChange={e => setForm({ ...form, household_id: e.target.value })}
                >
                  <option value="">— Create a new household —</option>
                  {households.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.household_no}{h.head_name ? ` — ${h.head_name}` : ''}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: '#9A9488', marginTop: 4 }}>
                  Leave as <strong>“Create a new household”</strong> to start a fresh one (a 4-digit
                  HH No. is auto-generated), or pick an <strong>existing household</strong> to make
                  this resident its head (the previous head becomes a member).
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <label className="form-label">Assign to Household</label>
                <select
                  className="form-select mt-1"
                  value={form.household_id || ''}
                  onChange={e => setForm({ ...form, household_id: e.target.value })}
                >
                  <option value="">— Unassigned —</option>
                  {households.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.household_no}{h.head_name ? ` — ${h.head_name}` : ''}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: '#9A9488', marginTop: 4 }}>
                  Select the household this resident belongs to (e.g. their family's household).
                </p>
              </div>
            )}

            {form.is_pwd && (
              <div className="mt-2">
                <label className="form-label">Disability Type</label>
                <select className="form-select mt-1" value={form.pwd_type} onChange={e => setForm({...form, pwd_type: e.target.value})}>
                  <option>Physical</option><option>Visual</option><option>Hearing</option><option>Intellectual</option><option>Psychosocial</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editId ? 'Update Record' : 'Save Resident'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* View Resident Modal */}
      {viewResident && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,39,64,0.6)', padding: 24 }}
          onClick={() => setViewResident(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 6, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  {viewResident.first_name} {viewResident.last_name}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {viewResident.resident_no} · {viewResident.purok}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => { setViewResident(null); handleEdit(viewResident) }}
                  style={{ padding: '5px 12px', background: '#C9A84C', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => { setViewResident(null); setShowSensitive(false) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>

              {/* Category badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {viewResident.is_household_head && <span className="badge badge-teal">Household Head</span>}
                {viewResident.is_senior_citizen  && <span className="badge badge-blue">Senior Citizen</span>}
                {viewResident.is_pwd             && <span className="badge badge-gold">PWD{viewResident.pwd_type ? ` — ${viewResident.pwd_type}` : ''}</span>}
                {viewResident.is_solo_parent     && <span className="badge badge-teal">Solo Parent</span>}
                {viewResident.is_voter               && <span className="badge badge-gray">Registered Voter</span>}
                {viewResident.is_out_of_school_youth && <span className="badge badge-red">Out-of-School Youth</span>}
              </div>

              {/* Info sections */}
              {[
                ['Personal Information', [
                  ['Resident No.',   viewResident.resident_no],
                  ['Full Name',      `${viewResident.last_name}, ${viewResident.first_name}${viewResident.middle_name ? ' ' + viewResident.middle_name : ''}`],
                  ['Date of Birth',  viewResident.date_of_birth ? new Date(viewResident.date_of_birth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'],
                  ['Age',            viewResident.age ?? Math.floor((Date.now() - new Date(viewResident.date_of_birth)) / 31557600000)],
                  ['Sex',            viewResident.sex],
                  ['Civil Status',   viewResident.civil_status],
                ]],
                ['Residence & Contact', [
                  ['Sitio',           viewResident.purok],
                  ['Household No.',   households.find(h => h.id === viewResident.household_id)?.household_no || '—'],
                  ['Contact Number', viewResident.contact_number ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {showSensitive ? viewResident.contact_number : maskPII(viewResident.contact_number)}
                      <button
                        onClick={() => setShowSensitive(s => !s)}
                        title={showSensitive ? 'Hide contact number' : 'Reveal contact number (PII)'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
                      >
                        {showSensitive ? '🙈' : '👁️'}
                      </button>
                    </span>
                  ) : '—'],
                ]],
                ['Socioeconomic', [
                  ['Occupation',     viewResident.occupation             || '—'],
                  ['Monthly Income', viewResident.monthly_income ? `₱${Number(viewResident.monthly_income).toLocaleString()}` : '—'],
                ]],
              ].map(([section, rows]) => (
                <div key={section} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8A8478', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #F0EDE4' }}>
                    {section}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '6px 16px' }}>
                    {rows.map(([label, value]) => (
                      <div key={label} style={{ padding: '4px 0' }}>
                        <div style={{ fontSize: 10, color: '#9A9488', marginBottom: 1 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A2E' }}>{value || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Upload Results Modal */}
      {uploadStats && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,39,64,0.6)', padding: 24 }}
          onClick={() => setUploadStats(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 6, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '12px 20px' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>
                Import Complete
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: 12, background: '#F5FBF9', borderRadius: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0D9E8C' }}>{uploadStats.inserted}</div>
                  <div style={{ fontSize: 11, color: '#5A5A52' }}>Added</div>
                </div>
                <div style={{ textAlign: 'center', padding: 12, background: '#FFF9EB', borderRadius: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C' }}>{uploadStats.updated}</div>
                  <div style={{ fontSize: 11, color: '#5A5A52' }}>Updated</div>
                </div>
                <div style={{ textAlign: 'center', padding: 12, background: '#F0F7FF', borderRadius: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#3B82F6' }}>{uploadStats.hhCreated}</div>
                  <div style={{ fontSize: 11, color: '#5A5A52' }}>HH Records Created</div>
                </div>
                {uploadStats.errors > 0 && (
                  <div style={{ textAlign: 'center', padding: 12, background: '#FFF0F0', borderRadius: 6 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#B83232' }}>{uploadStats.errors}</div>
                    <div style={{ fontSize: 11, color: '#5A5A52' }}>Errors</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: '#9A9488', textAlign: 'center' }}>
                Total rows processed: {uploadStats.total}
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 16 }}
                onClick={() => setUploadStats(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resident ID Card Modal */}
      {idResident && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,39,64,0.6)', padding: 24 }}
          onClick={() => setIdResident(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#fff' }}>Barangay ID Card</div>
              <button onClick={() => setIdResident(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>&times;</button>
            </div>

            {/* ID Card Preview */}
            <div style={{ padding: 20 }}>
              <div style={{ border: '2px solid #1A3A5C', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
                {/* Card header */}
                <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.4px' }}>REPUBLIC OF THE PHILIPPINES</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>Province of Batanes · Municipality of Basco</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '2px 0' }}>BARANGAY SAN JOAQUIN</div>
                  <div style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '1.5px', fontWeight: 700 }}>BARANGAY IDENTIFICATION CARD</div>
                </div>
                {/* Card body */}
                <div style={{ display: 'flex', gap: 12, padding: 12, background: '#fff', alignItems: 'flex-start' }}>
                  <div style={{ width: 56, height: 68, border: '1.5px solid #ccc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f8f8f8', fontSize: 9, color: '#aaa', textAlign: 'center' }}>
                    PHOTO<br/>HERE
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E', marginBottom: 4 }}>
                      {idResident.last_name.toUpperCase()}, {idResident.first_name.toUpperCase()}
                    </div>
                    {[
                      ['Resident No.', idResident.resident_no],
                      ['Sitio', idResident.purok],
                      ['Date of Birth', idResident.date_of_birth ? new Date(idResident.date_of_birth).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'],
                      ['Sex', idResident.sex],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ fontSize: 11, color: '#333', marginBottom: 2 }}>
                        <span style={{ color: '#888', fontSize: 10 }}>{lbl}: </span>{val}
                      </div>
                    ))}
                  </div>
                  <div id="res-id-qr" style={{ flexShrink: 0 }}>
                    <QRCode value={makeQrData(idResident)} size={68} />
                  </div>
                </div>
                {/* Card footer */}
                <div style={{ background: '#F5F2EC', borderTop: '1px solid #E8E4DA', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: 9, color: '#555', textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #555', width: 80, marginBottom: 2 }} />
                    Punong Barangay
                  </div>
                  <div style={{ fontSize: 9, color: '#888' }}>
                    Issued: {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handlePrintResidentID(idResident)}
                >
                  🖨️ Print ID Card
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const svg = document.getElementById('res-id-qr')?.querySelector('svg')
                    if (!svg) return
                    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${idResident.resident_no}_QR.svg`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  ⬇️ Download QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uploading Overlay */}
      {uploading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,39,64,0.7)' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '32px 40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📤</div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>Importing residents...</div>
            <p style={{ fontSize: 12, color: '#9A9488' }}>Processing your file. This may take a moment.</p>
          </div>
        </div>
      )}
    </div>
  )
}