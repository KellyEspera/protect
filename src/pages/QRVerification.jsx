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
  const [cameraError, setCameraError] = useState(null)
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)
  const qc = useQueryClient()

  // Load residents
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-qr'],
    queryFn: async () => {
      const { data } = await supabase
        .from('residents')
        .select('id, resident_no, first_name, last_name, purok, sex, date_of_birth')
        .order('last_name')
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

  const handleSelect = (e) => {
    const r = residents.find(r => r.id === e.target.value)
    setSelected(r || null)
  }

  // Start real camera scanner
  const startScanner = async () => {
    setCameraError(null)
    setScanning(true)
    setScanned(null)

    // Dynamically import html5-qrcode
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      html5QrRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' }, // rear camera
        { fps: 10, qrbox: { width: 200, height: 200 } },
        async (decodedText) => {
          // Stop scanner FIRST, then process result
          try {
            await scanner.stop()
            html5QrRef.current = null
            setScanning(false)
          } catch {}
          handleScannedResult(decodedText)
        },
        () => {} // ignore scan errors (fires constantly while searching)
      )
    } catch (err) {
      setCameraError('Camera not available or permission denied. Use Simulate Scan instead.')
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

  // Simulate scan (for demo / testing)
  const simulateScan = () => {
    if (residents.length === 0) { toast.error('No residents in database yet.'); return }
    const r = residents[0]
    setScanned(r)
    logMutation.mutate({ resident_id: r.id, purpose })
    toast.success(`Verified: ${r.first_name} ${r.last_name}`)
  }

  const qrData = selected ? JSON.stringify({
    id: selected.resident_no,
    name: `${selected.first_name} ${selected.last_name}`,
    purok: selected.purok,
    barangay: 'San Joaquin',
    issued: new Date().toISOString().split('T')[0],
  }) : ''

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

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── GENERATE QR ── */}
        <SectionCard title="Generate QR Code">
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

          <div style={{ background: '#FAFAF7', borderRadius: 8, border: '2px dashed #E8E4DA', padding: 24, textAlign: 'center', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {selected ? (
              <>
                <div style={{ padding: 12, background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 12 }}>
                  <QRCode value={qrData} size={160} />
                </div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                  {selected.first_name} {selected.last_name}
                </div>
                <div style={{ fontSize: 12, color: '#9A9488', marginTop: 2 }}>
                  {selected.resident_no} · {selected.purok}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#9A9488' }}>Select a resident to generate QR</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={!selected}
              onClick={() => {
                if (!selected) return
                toast.info('Printing QR card...')
                window.print()
              }}
            >
              🖨️ Print QR Card
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              disabled={!selected}
              onClick={() => {
                if (!selected) return
                // Download as SVG
                const svg = document.querySelector('#qr-svg-wrapper svg')
                if (!svg) return toast.info('QR ready for download.')
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
          {selected && (
            <div id="qr-svg-wrapper" style={{ display: 'none' }}>
              <QRCode value={qrData} size={160} />
            </div>
          )}
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
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={simulateScan}>
              🔄 Simulate Scan
            </button>
          </div>

          {/* Scan result */}
          {scanned && (
            <div style={{ padding: 14, background: '#E6F4F1', borderRadius: 8, border: '1px solid #0A6B5E', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, background: '#0A6B5E', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>✓</div>
                <div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                    {scanned.first_name} {scanned.last_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#5A5A52', marginTop: 2 }}>
                    {scanned.resident_no} · {scanned.purok} · Purpose: {purpose}
                  </div>
                  <span className="badge badge-teal" style={{ marginTop: 4 }}>✓ Verified Resident</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent verifications — LIVE from Supabase */}
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 8 }}>
            Recent Verifications
          </div>
          {verifications.length > 0 ? (
            <table className="data-table">
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
            </table>
          ) : (
            <p style={{ fontSize: 12, color: '#9A9488', textAlign: 'center', padding: '12px 0' }}>
              No verifications yet. Scan a resident QR code to begin.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  )
}