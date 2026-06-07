// QRVerification.jsx
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'
import { mockResidents } from '../lib/mockData'
import { SectionCard, Badge } from '../components/ui/index'
import { toast } from 'react-toastify'


export default function QRVerification() {
  const [selected, setSelected] = useState(null)
  const [scanned, setScanned] = useState(null)

  const { data: residents = mockResidents } = useQuery({
    queryKey: ['residents-qr'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('id, resident_no, first_name, last_name, purok, sex, date_of_birth').order('last_name')
      return data || mockResidents
    },
  })

  const handleSelect = (e) => {
    const r = residents.find(r => r.id === e.target.value || r.resident_no === e.target.value)
    setSelected(r || null)
  }

  const simulateScan = () => {
    const r = residents[0]
    setScanned(r)
    supabase.from('qr_verifications').insert({ resident_id: r.id, purpose: 'Simulated Scan' }).then(() => {})
    toast.success('Resident verified successfully!')
  }

  const qrData = selected ? JSON.stringify({
    id: selected.resident_no,
    name: `${selected.first_name} ${selected.last_name}`,
    purok: selected.purok,
    barangay: 'San Joaquin',
    issued: new Date().toISOString().split('T')[0],
  }) : ''

  const qrWrapRef = useRef(null)

  const downloadQR = () => {
    try {
      const wrap = qrWrapRef.current
      if (!wrap) {
        toast.error('QR not ready')
        return
      }

      const svg = wrap.querySelector('svg')
      if (!svg) {
        toast.error('QR SVG not found')
        return
      }

      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svg)

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      const safeName = (selected?.resident_no || 'QR').toString().replace(/[^a-z0-9_-]/gi, '_')
      a.download = `QR_${safeName}.svg`
      document.body.appendChild(a)
      a.click()
      a.remove()

      URL.revokeObjectURL(url)
      toast.success('QR downloaded')
    } catch (err) {
      toast.error('Failed to download QR')
    }
  }


  return (
    <div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Generate QR Code">
          <div className="mb-3">
            <label className="form-label">Select Resident</label>
            <select className="form-select mt-1" onChange={handleSelect} defaultValue="">
              <option value="">-- Select Resident --</option>
              {residents.map(r => (
                <option key={r.id || r.resident_no} value={r.id || r.resident_no}>
                  {r.first_name} {r.last_name} ({r.resident_no})
                </option>
              ))}
            </select>
          </div>
          <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
            {selected ? (
              <>
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-white rounded-xl shadow-sm" ref={qrWrapRef}>
                    <QRCode value={qrData} size={150} />
                  </div>
                </div>

                <p className="text-sm font-semibold text-navy">{selected.first_name} {selected.last_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selected.resident_no} · {selected.purok}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 py-6">Select a resident to generate QR</p>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="btn btn-primary flex-1"
              onClick={() => toast.info('Printing QR card...')}
            >
              🖨️ Print QR Card
            </button>
            <button
              className="btn btn-ghost"
              onClick={downloadQR}
              disabled={!selected}
              title={selected ? 'Download QR as SVG' : 'Select a resident first'}
            >
              ⬇️ Download
            </button>
          </div>

        </SectionCard>

        <SectionCard title="QR Scan & Verify">
          <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center mb-4">
            <div className="text-5xl mb-2">📷</div>
            <p className="text-sm text-gray-400 mb-3">Camera scanner active</p>
            <button className="btn btn-primary" onClick={simulateScan}>Simulate Scan</button>
          </div>
          {scanned && (
            <div className="p-4 bg-teal-light rounded-xl border border-teal/20">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-teal rounded-full flex items-center justify-center text-white text-lg">✓</div>
                <div>
                  <div className="font-semibold text-navy">{scanned.first_name} {scanned.last_name}</div>
                  <div className="text-xs text-gray-500">{scanned.resident_no} · {scanned.purok}</div>
                  <Badge variant="teal">Verified Resident</Badge>
                </div>
              </div>
            </div>
          )}
          <div className="mt-4">
            <p className="font-display text-[13px] font-semibold text-navy mb-2">Recent Verifications</p>
            <table className="data-table">
              <thead><tr><th>ID</th><th>Name</th><th>Purpose</th><th>Time</th></tr></thead>
              <tbody>
                <tr><td>RES-0001</td><td>Maria Santos</td><td>Brgy. Clearance</td><td>10:24 AM</td></tr>
                <tr><td>RES-0015</td><td>Carlos Tadena</td><td>Assistance Claim</td><td>9:48 AM</td></tr>
                <tr><td>RES-0032</td><td>Ana Flores</td><td>Cert. of Indigency</td><td>9:12 AM</td></tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
