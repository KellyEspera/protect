// ============================================================================
//  QRVerification.jsx  —  "QR Verification" page
// ----------------------------------------------------------------------------
//  Generates a QR code per resident (react-qr-code) and scans them with the
//  camera (html5-qrcode). After identifying a resident, the officer picks a
//  purpose: ISSUE A DOCUMENT (opens a filled, print-ready barangay template for
//  the captain to sign) or PROCESS AN ASSISTANCE RELEASE (records the release
//  against the household's beneficiary record to prevent double-claiming).
//  Every scan/issuance is logged to the qr_verifications table.
// ============================================================================

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'
import { SectionCard, Badge } from '../components/ui/index'
import { toast } from 'react-toastify'

const PURPOSES = [
  'Barangay Clearance',
  'Certificate of Indigency',
  'Certificate of Residency',
  'Assistance Claim',
  'Business Permit',
  'ID Verification',
  'Others',
]

export default function QRVerification() {
  const [selected, setSelected]   = useState(null)
  const [scanned, setScanned]     = useState(null)
  const [scanning, setScanning]   = useState(false)
  const [purpose, setPurpose]     = useState('Barangay Clearance')
  const [remarks, setRemarks]     = useState('')          // purpose-of-request for documents
  const [releaseTarget, setReleaseTarget] = useState(null) // beneficiary being released
  const [releaseAmount, setReleaseAmount] = useState('')
  const [docPreview, setDocPreview] = useState(null)       // HTML of the document to preview/print
  const [cameraError, setCameraError] = useState(null)
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)
  const printPreviewRef = useRef(null)
  const qc = useQueryClient()

  // Print the document shown in the preview modal
  const doPrint = () => {
    const iframe = printPreviewRef.current
    if (!iframe) return
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  // Load residents
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-qr'],
    queryFn: async () => {
      const { data } = await supabase
        .from('residents')
        .select('id, resident_no, first_name, last_name, purok, sex, date_of_birth, monthly_income, household_id, is_household_head, is_senior_citizen, is_pwd, is_solo_parent')
        .order('last_name')
      return data || []
    },
  })

  // Households (for HH No.)
  const { data: households = [] } = useQuery({
    queryKey: ['households-qr'],
    queryFn: async () => {
      const { data } = await supabase.from('households').select('id, household_no')
      return data || []
    },
  })

  // Beneficiary enrollments (for assistance processing)
  const { data: beneficiaries = [] } = useQuery({
    queryKey: ['beneficiaries-qr'],
    queryFn: async () => {
      const { data } = await supabase
        .from('beneficiaries')
        .select('id, resident_id, status, last_release_date, total_released, assistance_programs(name)')
      return data || []
    },
  })

  // Load recent verifications live
  const { data: verifications = [] } = useQuery({
    queryKey: ['qr-verifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('qr_verifications')
        .select('*, residents(resident_no, first_name, last_name)')
        .order('verified_at', { ascending: false })
        .limit(10)
      return data || []
    },
  })

  // Log verification to Supabase
  const logMutation = useMutation({
    mutationFn: async ({ resident_id, purpose }) => {
      const { error } = await supabase.from('qr_verifications').insert({ resident_id, purpose })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['qr-verifications']),
    onError: (e) => console.error('Log error:', e.message),
  })

  // Record an assistance release on the scanned household's beneficiary
  const releaseMutation = useMutation({
    mutationFn: async ({ beneficiary, amount, claimedBy }) => {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('beneficiaries').update({
        last_release_date: today,
        total_released: (beneficiary.total_released || 0) + (Number(amount) || 0),
      }).eq('id', beneficiary.id)
      if (error) throw error
      // Log it as a verification event too
      await supabase.from('qr_verifications').insert({
        resident_id: claimedBy,
        purpose: `Assistance Release — ${beneficiary.assistance_programs?.name || 'Program'}`,
      })
    },
    onSuccess: () => {
      toast.success('Assistance release recorded!')
      qc.invalidateQueries(['beneficiaries-qr'])
      qc.invalidateQueries(['qr-verifications'])
      setReleaseTarget(null)
      setReleaseAmount('')
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSelect = (e) => {
    const r = residents.find(r => r.id === e.target.value)
    setSelected(r || null)
  }

  // Start real camera scanner
  const startScanner = async () => {
    setCameraError(null)

    // Browsers only allow camera access on a secure context: HTTPS or localhost.
    // Opening the app via a LAN IP (e.g. http://192.168.x.x:5173) blocks the camera.
    const host = window.location.hostname
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
    if (!window.isSecureContext && !isLocalhost) {
      setCameraError(
        `Camera is blocked because this page is opened via "${host}" over plain HTTP. ` +
        `Browsers only allow the camera on https:// or http://localhost. ` +
        `Open the app on this computer at http://localhost:5173, or use Simulate Scan.`
      )
      return
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('This browser does not support camera access here. Use Simulate Scan instead.')
      return
    }

    setScanning(true)
    setScanned(null)

    // Dynamically import html5-qrcode
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      // Wait a tick so the #qr-reader div is mounted before we attach to it
      await new Promise(r => setTimeout(r, 0))
      const scanner = new Html5Qrcode('qr-reader')
      html5QrRef.current = scanner

      const onDecoded = async (decodedText) => {
        try {
          await scanner.stop()
          html5QrRef.current = null
          setScanning(false)
        } catch {}
        handleScannedResult(decodedText)
      }
      const config = { fps: 10, qrbox: { width: 200, height: 200 } }

      // Try the rear camera first; fall back to any available camera
      try {
        await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => {})
      } catch {
        await scanner.start({ facingMode: 'user' }, config, onDecoded, () => {})
      }
    } catch (err) {
      const name = err?.name || ''
      let msg
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Click the camera icon in the address bar to allow access, then try again.'
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No camera was found on this device. Use Simulate Scan instead.'
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = 'The camera is already in use by another app. Close it and try again.'
      } else {
        msg = `Camera could not start (${name || err?.message || 'unknown error'}). Use Simulate Scan instead.`
      }
      setCameraError(msg)
      setScanning(false)
    }
  }

  const stopScanner = () => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {})
      html5QrRef.current = null
    }
    setScanning(false)
  }

  // Clean up on unmount
  useEffect(() => {
    return () => { if (html5QrRef.current) html5QrRef.current.stop().catch(() => {}) }
  }, [])

  const handleScannedResult = (text) => {
    try {
      const data = JSON.parse(text)
      // Match by resident_no
      const match = residents.find(r => r.resident_no === data.id)
      if (match) {
        setScanned(match)
        logMutation.mutate({ resident_id: match.id, purpose })
        toast.success(`Verified: ${match.first_name} ${match.last_name}`)
      } else {
        toast.error('QR code not recognized. Resident not found in database.')
      }
    } catch {
      toast.error('Invalid QR code format.')
    }
  }

  // Simulate scan — uses the resident selected on the left (their QR)
  const simulateScan = () => {
    if (!selected) { toast.error('Select a resident on the left first to simulate scanning their QR.'); return }
    setScanned(selected)
    logMutation.mutate({ resident_id: selected.id, purpose })
    toast.success(`Verified: ${selected.first_name} ${selected.last_name}`)
  }

  const qrData = selected ? JSON.stringify({
    id: selected.resident_no,
    name: `${selected.first_name} ${selected.last_name}`,
    purok: selected.purok,
    barangay: 'San Joaquin',
    issued: new Date().toISOString().split('T')[0],
  }) : ''

  const handlePrintCertificate = (resident, certPurpose, requestPurpose = '') => {
    const age = resident.date_of_birth
      ? Math.floor((Date.now() - new Date(resident.date_of_birth).getTime()) / 31557600000)
      : '—'
    const dob = resident.date_of_birth
      ? new Date(resident.date_of_birth).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      : '—'
    const issued = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    const docNo = `BRY-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const fullName = `${resident.first_name} ${resident.last_name}`.toUpperCase()
    const sitio = resident.purok || 'Barangay San Joaquin'

    const CERT_TITLE = {
      'Barangay Clearance':       'BARANGAY CLEARANCE',
      'Certificate of Indigency': 'CERTIFICATE OF INDIGENCY',
      'Certificate of Residency': 'CERTIFICATE OF RESIDENCY',
      'Assistance Claim':         'CERTIFICATE OF INDIGENCY',
      'Business Permit':          'BARANGAY BUSINESS CLEARANCE',
    }
    const title = CERT_TITLE[certPurpose] || 'BARANGAY CERTIFICATION'

    const CERT_BODY = {
      'Barangay Clearance': `This is to certify that <strong>${fullName}</strong>, ${age} years old, ${resident.sex || ''}, a bonafide resident of ${sitio}, Barangay San Joaquin, Municipality of Basco, Province of Batanes, Philippines, has no derogatory record on file at this office as of the date of this certification, and is known to be of good moral character and law-abiding citizen in the community.<br/><br/>This certification is issued upon the request of the above-named person for whatever legal purpose it may serve.`,

      'Certificate of Indigency': `This is to certify that <strong>${fullName}</strong>, ${age} years old, ${resident.sex || ''}, a bonafide resident of ${sitio}, Barangay San Joaquin, Municipality of Basco, Province of Batanes, Philippines, is one of the identified indigent/low-income residents of this barangay and belongs to an underprivileged family whose income is insufficient to meet the family's basic needs.<br/><br/>This certification is issued upon the request of the above-named person for whatever legal purpose it may serve.`,

      'Certificate of Residency': `This is to certify that <strong>${fullName}</strong>, ${age} years old, born on ${dob}, ${resident.sex || ''}, is a bonafide resident of ${sitio}, Barangay San Joaquin, Municipality of Basco, Province of Batanes, Philippines.<br/><br/>This certification is issued upon the request of the above-named person for whatever legal purpose it may serve.`,

      'Business Permit': `This is to certify that <strong>${fullName}</strong>, a bonafide resident of ${sitio}, Barangay San Joaquin, Municipality of Basco, Province of Batanes, Philippines, has applied for a Barangay Business Clearance and has been found to have no violations or pending cases in this barangay.<br/><br/>This clearance is issued for business permit application purposes only.`,
    }
    let body = CERT_BODY[certPurpose] || CERT_BODY['Certificate of Residency']
    if (requestPurpose && requestPurpose.trim()) {
      body += `<br/><br/>This certification is issued specifically for the purpose of <strong>${requestPurpose.trim()}</strong>.`
    }

    setDocPreview(`<!DOCTYPE html><html><head>
<title>${title} — ${fullName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',Times,serif;background:#fff;color:#1a1a1a;padding:20mm 25mm;font-size:12pt;line-height:1.6}
  .header{text-align:center;margin-bottom:16pt;padding-bottom:12pt;border-bottom:3px double #1A3A5C}
  .header .republic{font-size:9pt;letter-spacing:1.5pt;color:#555;text-transform:uppercase}
  .header .province{font-size:9pt;color:#555}
  .header .brgy{font-size:16pt;font-weight:700;color:#1A3A5C;margin:4pt 0 2pt;letter-spacing:1pt}
  .header .addr{font-size:9pt;color:#777}
  .seal{font-size:48pt;margin:6pt 0}
  .cert-title{text-align:center;margin:20pt 0 16pt}
  .cert-title h2{font-size:15pt;font-weight:700;letter-spacing:2pt;text-decoration:underline;color:#1A3A5C}
  .doc-no{text-align:right;font-size:9pt;color:#777;margin-bottom:14pt}
  .greeting{margin-bottom:10pt}
  .body-text{text-align:justify;margin-bottom:14pt;font-size:11.5pt}
  .closing{margin-bottom:28pt;font-size:11.5pt}
  .sig-section{display:flex;justify-content:space-between;margin-top:16pt}
  .sig-block{text-align:center;width:45%}
  .sig-line{border-top:1.5px solid #1a1a1a;margin-bottom:4pt;width:100%}
  .sig-name{font-weight:700;font-size:11pt}
  .sig-title{font-size:9pt;color:#555}
  .footer{margin-top:28pt;padding-top:8pt;border-top:1px solid #ccc;text-align:center;font-size:8.5pt;color:#999}
  .orbox{border:1px solid #ccc;padding:8pt 12pt;font-size:9pt;color:#777;margin-top:12pt;display:inline-block}
  @media print{body{padding:15mm 20mm}}
</style></head><body>
<div class="header">
  <div class="republic">Republic of the Philippines</div>
  <div class="province">Province of Batanes &nbsp;·&nbsp; Municipality of Basco</div>
  <div class="seal">🏛️</div>
  <div class="brgy">BARANGAY SAN JOAQUIN</div>
  <div class="addr">Basco, Batanes, Philippines</div>
</div>

<div class="cert-title"><h2>${title}</h2></div>

<div class="doc-no">Doc. No.: ${docNo} &nbsp;|&nbsp; Date: ${issued}</div>

<div class="greeting">To Whom It May Concern:</div>

<div class="body-text">${body}</div>

<div class="closing">
  Given this <strong>${new Date().getDate()}${['th','st','nd','rd'][Math.min(new Date().getDate()%10,3)]||'th'} day of ${new Date().toLocaleDateString('en-PH',{month:'long'})}, ${new Date().getFullYear()}</strong> at Barangay San Joaquin, Basco, Batanes, Philippines.
</div>

<div class="sig-section">
  <div class="sig-block">
    <div class="sig-line"></div>
    <div class="sig-name">PUNONG BARANGAY</div>
    <div class="sig-title">Barangay San Joaquin</div>
  </div>
  <div style="text-align:right;font-size:9pt;color:#777">
    <div class="orbox">
      O.R. No.: ____________<br/>
      Amount: ₱ ____________<br/>
      Date Paid: ____________
    </div>
  </div>
</div>

<div class="footer">
  This document is electronically generated by the PROTECT Barangay Analytics System &nbsp;·&nbsp; Resident ID: ${resident.resident_no}
</div>

</body></html>`)
  }

  const handlePrintID = () => {
    if (!selected) return
    const qrSvg = document.getElementById('brgy-id-qr')?.querySelector('svg')?.outerHTML || ''
    const dob = selected.date_of_birth
      ? new Date(selected.date_of_birth).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      : '—'
    const issued = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    setDocPreview(`<!DOCTYPE html><html><head>
<title>Barangay ID — ${selected.first_name} ${selected.last_name}</title>
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
      <div class="name">${selected.last_name.toUpperCase()}, ${selected.first_name.toUpperCase()}</div>
      <div class="row"><span class="lbl">Sitio: </span>${selected.purok}</div>
      <div class="row"><span class="lbl">Date of Birth: </span>${dob}</div>
      <div class="row"><span class="lbl">Sex: </span>${selected.sex}</div>
    </div>
    <div class="qr">${qrSvg}</div>
  </div>
  <div class="ftr">
    <div class="sig"><div class="line"></div>Punong Barangay</div>
    <div class="sig" style="text-align:right"><span class="lbl">Issued:</span><br/>${issued}</div>
  </div>
</div>
</body></html>`)
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  }

  // ── Derived data for the scanned resident ──
  const scannedAge = scanned?.date_of_birth ? Math.floor((Date.now() - new Date(scanned.date_of_birth)) / 31557600000) : null
  const scannedHHNo = scanned ? (households.find(h => h.id === scanned.household_id)?.household_no || null) : null
  const members = scanned?.household_id ? residents.filter(r => r.household_id === scanned.household_id) : (scanned ? [scanned] : [])
  const head = members.find(m => m.is_household_head) || (scanned?.is_household_head ? scanned : null)
  const memberIds = new Set(members.map(m => m.id))
  const householdBeneficiaries = beneficiaries.filter(b => memberIds.has(b.resident_id))
  const recentDocs = scanned ? verifications.filter(v => v.resident_id === scanned.id).slice(0, 4) : []
  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr), now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── BARANGAY ID + QR ── */}
        <SectionCard title="Barangay ID with QR Code">
          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Select Resident</label>
            <select className="form-select" onChange={handleSelect} defaultValue="">
              <option value="">-- Select Resident --</option>
              {residents.map(r => (
                <option key={r.id} value={r.id}>
                  {r.last_name}, {r.first_name} ({r.resident_no})
                </option>
              ))}
            </select>
          </div>

          {/* ID Card Preview */}
          {selected ? (
            <div style={{ border: '2px solid #1A3A5C', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {/* Header */}
              <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.4px' }}>REPUBLIC OF THE PHILIPPINES</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>Province of Batanes · Municipality of Basco</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '2px 0' }}>BARANGAY SAN JOAQUIN</div>
                <div style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '1.5px', fontWeight: 700 }}>BARANGAY IDENTIFICATION CARD</div>
              </div>
              {/* Body */}
              <div style={{ display: 'flex', gap: 12, padding: 12, background: '#fff' }}>
                <div style={{ width: 60, height: 72, border: '1.5px solid #ccc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f8f8f8', fontSize: 9, color: '#aaa', textAlign: 'center' }}>
                  PHOTO<br/>HERE
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E', marginBottom: 4 }}>
                    {selected.last_name.toUpperCase()}, {selected.first_name.toUpperCase()}
                  </div>
                  {[
                    ['Sitio', selected.purok],
                    ['Date of Birth', selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'],
                    ['Sex', selected.sex],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ fontSize: 11, color: '#333', marginBottom: 2 }}>
                      <span style={{ color: '#888', fontSize: 10 }}>{lbl}: </span>{val}
                    </div>
                  ))}
                </div>
                <div id="brgy-id-qr" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 2 }}>
                  <QRCode value={qrData} size={72} />
                </div>
              </div>
              {/* Footer */}
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
          ) : (
            <div style={{ background: '#FAFAF7', borderRadius: 8, border: '2px dashed #E8E4DA', padding: 32, textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🪪</div>
              <p style={{ fontSize: 13, color: '#9A9488' }}>Select a resident to preview their Barangay ID</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!selected} onClick={handlePrintID}>
              🖨️ Print ID Card
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              disabled={!selected}
              onClick={() => {
                if (!selected) return
                const svg = document.getElementById('brgy-id-qr')?.querySelector('svg')
                if (!svg) return
                const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `${selected.resident_no}_QR.svg`; a.click()
                URL.revokeObjectURL(url)
              }}
            >
              ⬇️ Download QR
            </button>
          </div>
        </SectionCard>

        {/* ── SCAN & VERIFY ── */}
        <SectionCard title="QR Scan & Verify">

          {/* Purpose selector */}
          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Purpose of Verification</label>
            <select className="form-select" value={purpose} onChange={e => setPurpose(e.target.value)}>
              {PURPOSES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Camera scanner area */}
          <div style={{ background: '#FAFAF7', borderRadius: 8, border: '2px dashed #E8E4DA', marginBottom: 12, overflow: 'hidden', minHeight: 180 }}>
            {/* html5-qrcode mounts here */}
            <div id="qr-reader" style={{ width: '100%' }} />

            {!scanning && (
              <div style={{ padding: 24, textAlign: 'center' }}>
                {cameraError ? (
                  <p style={{ fontSize: 12, color: '#B83232', marginBottom: 12 }}>{cameraError}</p>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                    <p style={{ fontSize: 12, color: '#9A9488', marginBottom: 12 }}>
                      Click <strong>Start Scanner</strong> to activate the camera
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Scanner controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {!scanning ? (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={startScanner}>
                📷 Start Scanner
              </button>
            ) : (
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={stopScanner}>
                ⏹ Stop Scanner
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ flex: 1, opacity: selected ? 1 : 0.5 }}
              onClick={simulateScan}
              title={selected ? `Simulate scanning ${selected.first_name} ${selected.last_name}` : 'Select a resident on the left first'}
            >
              🔄 Simulate Scan{selected ? `: ${selected.first_name}` : ''}
            </button>
          </div>

          {/* Scan result */}
          {scanned && (() => {
            const age = scannedAge ?? '—'
            // Document purposes show the Issue Document section; "Assistance Claim" shows Process Assistance
            const showDoc = ['Barangay Clearance', 'Certificate of Indigency', 'Certificate of Residency', 'Business Permit'].includes(purpose)
            const isAssistance = purpose === 'Assistance Claim'
            const needsIncomeCheck = purpose === 'Certificate of Indigency'
            const income = scanned.monthly_income || 0
            const qualifies = income < 10000
            const initials = `${scanned.first_name?.[0] || ''}${scanned.last_name?.[0] || ''}`.toUpperCase()
            const isHead = scanned.is_household_head

            return (
            <div style={{ padding: 14, background: '#E6F4F1', borderRadius: 8, border: '1px solid #0A6B5E', marginBottom: 12 }}>
              {/* Identity */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, background: '#0A6B5E', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>
                    {scanned.first_name} {scanned.last_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#5A5A52', marginTop: 2 }}>
                    {scanned.purok} · {age} yrs · {scanned.sex}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="badge badge-teal">✓ Verified</span>
                    {isHead ? <span className="badge badge-gold">👑 Household Head</span> : (head && <span className="badge badge-gray">Member</span>)}
                    {scanned.is_senior_citizen && <span className="badge badge-blue">Senior</span>}
                    {scanned.is_pwd && <span className="badge badge-gold">PWD</span>}
                    {scanned.is_solo_parent && <span className="badge badge-teal">Solo Parent</span>}
                  </div>
                </div>
              </div>

              {/* Household line */}
              {scannedHHNo && (
                <div style={{ background: '#fff', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#5A5A52' }}>
                  🏠 <strong style={{ color: '#1A1A2E' }}>{scannedHHNo}</strong> · {members.length} member{members.length !== 1 ? 's' : ''}
                  {head && !isHead && <> · Head: <strong style={{ color: '#1A1A2E' }}>{head.first_name} {head.last_name}</strong></>}
                </div>
              )}

              {/* ── DOCUMENT SECTION (only for document purposes) ── */}
              {showDoc && (
              <div style={{ background: '#fff', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', marginBottom: 6 }}>📄 Issue Document</div>
                <div style={{ fontSize: 11, color: '#5A5A52', marginBottom: 6 }}>Document: <strong style={{ color: '#1A1A2E' }}>{purpose}</strong></div>
                {/* Purpose of request */}
                <input
                  className="form-input"
                  placeholder="Purpose of request (e.g. employment, scholarship)"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  style={{ fontSize: 12, marginBottom: 8 }}
                />
                {needsIncomeCheck && (
                  <div style={{ marginBottom: 8, fontSize: 11 }}>
                    {qualifies
                      ? <span style={{ color: '#0A6B5E', fontWeight: 700 }}>✓ Eligible <span style={{ color: '#9A9488', fontWeight: 400 }}>— income ₱{income.toLocaleString()} below ₱10,000</span></span>
                      : <span style={{ color: '#B8860B', fontWeight: 700 }}>⚠ Review <span style={{ color: '#9A9488', fontWeight: 400 }}>— income ₱{income.toLocaleString()} above ₱10,000</span></span>}
                  </div>
                )}
                <button className="btn btn-primary" style={{ width: '100%', fontSize: 12 }} onClick={() => handlePrintCertificate(scanned, purpose, remarks)}>
                  🖨️ Issue &amp; Print {purpose.replace('Certificate of ', '')}
                </button>
              </div>
              )}

              {/* ── ASSISTANCE SECTION (only when purpose is Assistance Claim) ── */}
              {isAssistance && (
              <div style={{ background: '#fff', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', marginBottom: 6 }}>🎁 Process Assistance</div>
                {householdBeneficiaries.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#9A9488', margin: 0 }}>This household isn't enrolled in any assistance program. Enroll them in Beneficiary Tracking.</p>
                ) : (
                  <>
                    {!isHead && head && (
                      <p style={{ fontSize: 11, color: '#B8860B', marginTop: 0, marginBottom: 8 }}>⚠ Not the household head — release will be recorded as claimed on behalf of <strong>{head.first_name} {head.last_name}</strong>.</p>
                    )}
                    {householdBeneficiaries.map(b => {
                      const claimedThisMonth = isCurrentMonth(b.last_release_date)
                      return (
                        <div key={b.id} style={{ borderTop: '1px solid #F0EDE4', paddingTop: 8, marginTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>{b.assistance_programs?.name || 'Program'}</div>
                              <div style={{ fontSize: 10, color: '#9A9488' }}>
                                {b.status} · Last release: {b.last_release_date || 'none'} · Total ₱{(b.total_released || 0).toLocaleString()}
                              </div>
                            </div>
                            {releaseTarget?.id !== b.id && (
                              <button className="btn btn-ghost px-2 py-1 text-xs" style={{ flexShrink: 0 }} onClick={() => { setReleaseTarget(b); setReleaseAmount('') }}>
                                Record Release
                              </button>
                            )}
                          </div>
                          {claimedThisMonth && releaseTarget?.id !== b.id && (
                            <div style={{ fontSize: 10, color: '#B83232', marginTop: 3 }}>⚠ Already released this month</div>
                          )}
                          {releaseTarget?.id === b.id && (
                            <div style={{ marginTop: 8, background: '#F5F2EC', borderRadius: 6, padding: 8 }}>
                              {claimedThisMonth && <div style={{ fontSize: 10, color: '#B83232', marginBottom: 6 }}>⚠ This household already claimed this month — recording another release.</div>}
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input type="number" min="0" className="form-input" placeholder="Amount ₱" value={releaseAmount} onChange={e => setReleaseAmount(e.target.value)} style={{ fontSize: 12 }} />
                                <button className="btn btn-primary text-xs" style={{ whiteSpace: 'nowrap' }} disabled={releaseMutation.isPending}
                                  onClick={() => releaseMutation.mutate({ beneficiary: b, amount: releaseAmount, claimedBy: scanned.id })}>
                                  {releaseMutation.isPending ? '...' : '✓ Confirm'}
                                </button>
                                <button className="btn btn-ghost text-xs" onClick={() => setReleaseTarget(null)}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
              )}

              {/* Recent issuances for this resident */}
              {recentDocs.length > 0 && (
                <div style={{ fontSize: 11, color: '#5A5A52', marginBottom: 10 }}>
                  <strong>Recent:</strong> {recentDocs.map(d => `${d.purpose} (${formatDate(d.verified_at)})`).join(' · ')}
                </div>
              )}

              <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12 }} onClick={() => { setScanned(null); setRemarks(''); setReleaseTarget(null) }}>
                ↻ Scan Another
              </button>
            </div>
            )
          })()}

          {/* Recent verifications — LIVE from Supabase */}
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 8 }}>
            Recent Verifications
          </div>
          {verifications.length > 0 ? (
            <div className="overflow-x-auto"><table className="data-table">
              <thead>
                <tr><th>ID</th><th>Name</th><th>Purpose</th><th>Date</th><th>Time</th></tr>
              </thead>
              <tbody>
                {verifications.map(v => (
                  <tr key={v.id}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0A6B5E' }}>{v.residents?.resident_no || '—'}</span></td>
                    <td>{v.residents ? `${v.residents.first_name} ${v.residents.last_name}` : '—'}</td>
                    <td>{v.purpose}</td>
                    <td style={{ fontSize: 11, color: '#9A9488' }}>{formatDate(v.verified_at)}</td>
                    <td style={{ fontSize: 11, color: '#9A9488' }}>{formatTime(v.verified_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : (
            <p style={{ fontSize: 12, color: '#9A9488', textAlign: 'center', padding: '12px 0' }}>
              No verifications yet. Scan a resident QR code to begin.
            </p>
          )}
        </SectionCard>
      </div>

      {/* Document preview + print modal */}
      {docPreview && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,39,64,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDocPreview(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#fff' }}>Document Preview</div>
              <button onClick={() => setDocPreview(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>&times;</button>
            </div>

            <iframe
              ref={printPreviewRef}
              srcDoc={docPreview}
              title="Document preview"
              style={{ flex: 1, width: '100%', border: 'none', background: '#fff', minHeight: 320 }}
            />

            <div style={{ padding: '12px 18px', borderTop: '1px solid #E8E4DA', display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#FAFAF7' }}>
              <button className="btn btn-ghost" onClick={() => setDocPreview(null)}>Close</button>
              <button className="btn btn-primary" onClick={doPrint}>🖨️ Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}