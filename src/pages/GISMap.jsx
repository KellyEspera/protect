// GISMap.jsx
import { useEffect, useRef } from 'react'
import { SectionCard } from '../components/ui/index'
import { StatCard } from '../components/ui/index'

export default function GISMap() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  useEffect(() => {
    if (mapInstance.current) return
    import('leaflet').then(L => {
      const map = L.default.map(mapRef.current).setView([20.4486, 121.9702], 14)
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      const colors = ['#0D9E8C', '#F5A623', '#3B82F6']
      const sitios = ['Sitio Hunan', 'Sitio Hagu', 'Sitio Tuva']
      const pts = [
        [20.449, 121.9685], [20.4498, 121.97], [20.4486, 121.971], [20.4479, 121.9695], [20.4502, 121.972],
        [20.4475, 121.968], [20.451, 121.9688], [20.4465, 121.9715], [20.452, 121.9705], [20.4458, 121.9698],
        [20.4533, 121.9715], [20.447, 121.973], [20.4542, 121.97], [20.448, 121.974], [20.4495, 121.975],
        [20.4515, 121.966], [20.445, 121.968], [20.4525, 121.9735], [20.444, 121.9705], [20.4535, 121.969],
      ]
      pts.forEach((p, i) => {
        const ci = i % sitios.length
        L.default.circleMarker(p, { radius: 7, fillColor: colors[ci], color: '#fff', weight: 2, fillOpacity: 0.9 })
          .addTo(map)
          .bindPopup(`<b>Household ${i + 1}</b><br>${sitios[ci]}<br>Barangay San Joaquin`)
      })
      mapInstance.current = map
    })
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null } }
  }, [])

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="🏠" value="342" label="Mapped Households" color="teal" />
        <StatCard icon="📍" value="3" label="Sitios / Zones" color="gold" />
        <StatCard icon="🎯" value="97.4%" label="Geocoded Accuracy" color="blue" />
      </div>
      <SectionCard
        title="GIS Household Map"
        subtitle="Barangay San Joaquin, Basco, Batanes · OpenStreetMap"
        action={
          <div className="flex gap-1.5 flex-wrap">
            {['Sitio Hunan','Sitio Hagu','Sitio Tuva'].map((p, i) => (
              <span key={p} className="badge badge-gray text-[10px]">{p}</span>
            ))}
          </div>
        }
      >
        <div ref={mapRef} style={{ height: 400, borderRadius: 10, border: '1px solid #E2E8F0' }} />
      </SectionCard>
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard } from '../components/ui/index'
import { toast } from 'react-toastify'

const PUROKS = ['Sitio Hunan', 'Sitio Hagu', 'Sitio Tuva']
const HOUSING_TYPES = ['Concrete', 'Semi-concrete', 'Wood', 'Makeshift']

const PUROK_COLORS = {
  'Sitio Hunan': '#0D9E8C',
  'Sitio Hagu':  '#F5A623',
  'Sitio Tuva':  '#3B82F6',
}

export default function GISMap() {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const markersRef   = useRef({})   // id -> leaflet marker
  const tempMarker   = useRef(null) // unconfirmed click pin
  const qc           = useQueryClient()

  const [pendingPin, setPendingPin] = useState(null) // { lat, lng }
  const [form, setForm]             = useState({ household_no: '', purok: 'Sitio Hunan', address: '', housing_type: 'Concrete', head_name: '' })
  const [editTarget, setEditTarget] = useState(null) // household id being edited
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterPurok, setFilterPurok]   = useState('All')

  // ── Load households from Supabase ──
  const { data: households = [] } = useQuery({
    queryKey: ['households-map'],
    queryFn: async () => {
      const { data } = await supabase
        .from('households')
        .select('*')
        .order('household_no')
      return data || []
    },
  })

  // ── Save new household ──
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('households').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Household pinned and saved!')
      qc.invalidateQueries(['households-map'])
      setPendingPin(null)
      setForm({ household_no: '', purok: 'Sitio Hunan', address: '', housing_type: 'Concrete', head_name: '' })
      if (tempMarker.current && mapInstance.current) {
        mapInstance.current.removeLayer(tempMarker.current)
        tempMarker.current = null
      }
    },
    onError: (e) => toast.error(e.message),
  })

  // ── Update household ──
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { error } = await supabase.from('households').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Household updated!')
      qc.invalidateQueries(['households-map'])
      setEditTarget(null)
    },
    onError: (e) => toast.error(e.message),
  })

  // ── Delete household ──
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('households').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Household removed.')
      qc.invalidateQueries(['households-map'])
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e.message),
  })

  // ── Init map ──
  useEffect(() => {
    if (mapInstance.current) return
    import('leaflet').then(L => {
      const map = L.default.map(mapRef.current, { zoomControl: true }).setView([20.4486, 121.9702], 15)
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Click to place pin
      map.on('click', (e) => {
        const { lat, lng } = e.latlng

        // Remove previous temp marker
        if (tempMarker.current) map.removeLayer(tempMarker.current)

        // Drop a temporary pulsing marker
        const tempIcon = L.default.divIcon({
          html: `<div style="
            width:18px;height:18px;border-radius:50%;
            background:#C9A84C;border:3px solid #fff;
            box-shadow:0 0 0 3px rgba(201,168,76,0.4);
            animation:pulse 1s infinite;
          "></div>
          <style>@keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(201,168,76,0.4)}50%{box-shadow:0 0 0 8px rgba(201,168,76,0.1)}}</style>`,
          className: '',
          iconAnchor: [9, 9],
        })

        tempMarker.current = L.default.marker([lat, lng], { icon: tempIcon }).addTo(map)
        setPendingPin({ lat, lng })
      })

      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // ── Sync household markers whenever data or filter changes ──
  useEffect(() => {
    if (!mapInstance.current) return
    import('leaflet').then(L => {
      // Remove all existing markers
      Object.values(markersRef.current).forEach(m => mapInstance.current.removeLayer(m))
      markersRef.current = {}

      const filtered = filterPurok === 'All' ? households : households.filter(h => h.purok === filterPurok)

      filtered.forEach(h => {
        if (!h.latitude || !h.longitude) return

        const color = PUROK_COLORS[h.purok] || '#1A3A5C'
        const icon = L.default.divIcon({
          html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:${color};border:2.5px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,0.35);
            cursor:pointer;
          "></div>`,
          className: '',
          iconAnchor: [7, 7],
        })

        const marker = L.default.marker([h.latitude, h.longitude], { icon })
          .addTo(mapInstance.current)
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:180px">
              <div style="font-weight:700;font-size:13px;color:#1A1A2E;margin-bottom:4px">${h.household_no || 'Household'}</div>
              <div style="font-size:11px;color:#5A5A52;line-height:1.6">
                <b>Purok:</b> ${h.purok}<br/>
                ${h.address ? `<b>Address:</b> ${h.address}<br/>` : ''}
                ${h.housing_type ? `<b>Type:</b> ${h.housing_type}<br/>` : ''}
                ${h.head_name ? `<b>HH Head:</b> ${h.head_name}<br/>` : ''}
                <b>Coords:</b> ${h.latitude.toFixed(5)}, ${h.longitude.toFixed(5)}
              </div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button onclick="window.__editHH('${h.id}')" style="flex:1;padding:4px 0;background:#1A3A5C;color:#fff;border:none;border-radius:3px;font-size:11px;cursor:pointer;font-family:Inter,sans-serif">Edit</button>
                <button onclick="window.__deleteHH('${h.id}')" style="flex:1;padding:4px 0;background:#B83232;color:#fff;border:none;border-radius:3px;font-size:11px;cursor:pointer;font-family:Inter,sans-serif">Remove</button>
              </div>
            </div>
          `, { maxWidth: 240 })

        markersRef.current[h.id] = marker
      })

      // Global handlers for popup buttons
      window.__editHH = (id) => {
        const h = households.find(x => x.id === id)
        if (!h) return
        setEditTarget(h)
        setForm({ household_no: h.household_no || '', purok: h.purok, address: h.address || '', housing_type: h.housing_type || 'Concrete', head_name: h.head_name || '' })
      }
      window.__deleteHH = (id) => setDeleteTarget(id)
    })
  }, [households, filterPurok])

  // ── Stats ──
  const mapped = households.length
  const purokCounts = PUROKS.map(p => ({ purok: p, count: households.filter(h => h.purok === p).length }))

  const handleSave = () => {
    if (!pendingPin) return
    if (!form.household_no.trim()) { toast.error('Please enter a Household No.'); return }
    saveMutation.mutate({
      household_no: form.household_no.trim(),
      purok: form.purok,
      address: form.address.trim(),
      housing_type: form.housing_type,
      head_name: form.head_name.trim(),
      latitude: pendingPin.lat,
      longitude: pendingPin.lng,
    })
  }

  const handleUpdate = () => {
    if (!editTarget) return
    updateMutation.mutate({
      id: editTarget.id,
      payload: {
        household_no: form.household_no.trim(),
        purok: form.purok,
        address: form.address.trim(),
        housing_type: form.housing_type,
        head_name: form.head_name.trim(),
      },
    })
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatCard icon="🏠" value={mapped} label="Mapped Households" color="navy" />
        <StatCard icon="📍" value="5" label="Puroks / Zones" color="gold" />
        <StatCard icon="🗺️" value={mapped > 0 ? '✓ Live' : 'Pending'} label="Map Data" color="teal" />
        <StatCard icon="📌" value={pendingPin ? 'Placing...' : 'Ready'} label="Pin Status" color={pendingPin ? 'gold' : 'navy'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

        {/* Map */}
        <SectionCard
          title="GIS Household Map"
          subtitle="Barangay San Joaquin, Basco, Batanes · Click anywhere to place a household pin"
          action={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={filterPurok}
                onChange={e => setFilterPurok(e.target.value)}
                style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #D4D0C8', borderRadius: 4, color: '#1A1A2E', fontFamily: 'Inter, sans-serif' }}
              >
                <option value="All">All Puroks</option>
                {PUROKS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          }
        >
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            {PUROKS.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A52' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: PUROK_COLORS[p], border: '1.5px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                {p} ({purokCounts.find(x => x.purok === p)?.count || 0})
              </div>
            ))}
          </div>
          <div ref={mapRef} style={{ height: 420, borderRadius: 6, border: '1px solid #E8E4DA', overflow: 'hidden' }} />
          <p style={{ fontSize: 11, color: '#9A9488', marginTop: 8, textAlign: 'center' }}>
            💡 Click on the map to drop a pin · Click an existing pin to view details, edit, or remove
          </p>
        </SectionCard>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* New pin form */}
          {pendingPin && !editTarget && (
            <div style={{ background: '#fff', border: '2px solid #C9A84C', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '10px 14px' }}>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>New Household Pin</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                  {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
                </div>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Household No. *</label>
                  <input className="form-input" placeholder="e.g. HH-001" value={form.household_no} onChange={e => setForm({ ...form, household_no: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Purok *</label>
                  <select className="form-select" value={form.purok} onChange={e => setForm({ ...form, purok: e.target.value })}>
                    {PUROKS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Household Head</label>
                  <input className="form-input" placeholder="Name of HH head" value={form.head_name} onChange={e => setForm({ ...form, head_name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Address / Sitio</label>
                  <input className="form-input" placeholder="Sitio / Street" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Housing Type</label>
                  <select className="form-select" value={form.housing_type} onChange={e => setForm({ ...form, housing_type: e.target.value })}>
                    {HOUSING_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={saveMutation.isPending} onClick={handleSave}>
                    {saveMutation.isPending ? 'Saving...' : '📌 Save Pin'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => {
                    setPendingPin(null)
                    if (tempMarker.current && mapInstance.current) {
                      mapInstance.current.removeLayer(tempMarker.current)
                      tempMarker.current = null
                    }
                  }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Edit form */}
          {editTarget && (
            <div style={{ background: '#fff', border: '2px solid #1A3A5C', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '10px 14px' }}>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>Edit Household</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{editTarget.household_no}</div>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Household No.</label>
                  <input className="form-input" value={form.household_no} onChange={e => setForm({ ...form, household_no: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Purok</label>
                  <select className="form-select" value={form.purok} onChange={e => setForm({ ...form, purok: e.target.value })}>
                    {PUROKS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Household Head</label>
                  <input className="form-input" value={form.head_name} onChange={e => setForm({ ...form, head_name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Address / Sitio</label>
                  <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Housing Type</label>
                  <select className="form-select" value={form.housing_type} onChange={e => setForm({ ...form, housing_type: e.target.value })}>
                    {HOUSING_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={updateMutation.isPending} onClick={handleUpdate}>
                    {updateMutation.isPending ? 'Saving...' : '✓ Update'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* No pending state */}
          {!pendingPin && !editTarget && (
            <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>Click to Pin</div>
              <p style={{ fontSize: 11, color: '#9A9488', lineHeight: 1.6 }}>
                Click anywhere on the map to drop a household pin. A form will appear here to fill in the details.
              </p>
            </div>
          )}

          {/* Household list */}
          <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: '#FAFAF7', borderBottom: '1px solid #E8E4DA', padding: '10px 14px' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Pinned Households</div>
              <div style={{ fontSize: 10, color: '#9A9488', marginTop: 2 }}>{mapped} total</div>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {households.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: '#9A9488' }}>No households pinned yet</div>
              ) : (
                households.map(h => (
                  <div key={h.id} style={{ padding: '8px 14px', borderBottom: '1px solid #F5F2EC', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => {
                      if (mapInstance.current && h.latitude && h.longitude) {
                        mapInstance.current.flyTo([h.latitude, h.longitude], 18, { duration: 1 })
                        markersRef.current[h.id]?.openPopup()
                      }
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PUROK_COLORS[h.purok] || '#1A3A5C', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.household_no}</div>
                      <div style={{ fontSize: 10, color: '#9A9488' }}>{h.purok} {h.head_name ? `· ${h.head_name}` : ''}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,39,64,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 6, overflow: 'hidden', width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#B83232', borderBottom: '3px solid #8B1A1A', padding: '12px 18px' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#fff' }}>Confirm Removal</div>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <p style={{ fontSize: 13, color: '#1A1A2E', marginBottom: 16 }}>Are you sure you want to remove this household pin? This cannot be undone.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1, background: '#B83232', color: '#fff', border: 'none' }}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget)}>
                  {deleteMutation.isPending ? 'Removing...' : 'Yes, Remove'}
                </button>
                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}