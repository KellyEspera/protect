import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { StatCard } from '../components/ui/index'

const PUROKS = ['Sitio Hunan', 'Sitio Hagu', 'Sitio Tuva']

const SITIO_CENTERS = {
  'Sitio Hunan': [20.44531, 121.98450],  // Barangay Hall (west / inland)
  'Sitio Tuva':  [20.44600, 121.99050],  // northeast / up the hill
  'Sitio Hagu':  [20.44150, 121.98850],  // south / toward Valugan coast
}

const TYPE_COLORS = {
  'Public Intoxication / Disorderly Conduct': '#F97316',
  'Minor Physical Altercation': '#EF4444',
  'Domestic Dispute': '#A855F7',
  'Property Damage (Typhoon-related)': '#3B82F6',
  'Environmental / Ordinance Violation': '#0D9E8C',
  'Stray Animal Complaint': '#C9A84C',
  'Noise Disturbance': '#6B7280',
  'Others': '#8B5CF6',
}

const DATE_FILTERS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '3mo', days: 90 },
  { label: 'All', days: null },
]

function getCrimeColor(count, maxCount) {
  if (count === 0 || maxCount === 0) return { fill: '#22C55E', border: '#16A34A' }
  const r = count / maxCount
  if (r <= 0.33) return { fill: '#F59E0B', border: '#D97706' }
  if (r <= 0.66) return { fill: '#F97316', border: '#EA580C' }
  return { fill: '#EF4444', border: '#DC2626' }
}

export default function CrimeHotspotMap() {
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const crimeRef    = useRef([])

  const [dateFilter, setDateFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState('All')

  // Inject responsive CSS once
  useEffect(() => {
    if (document.getElementById('map-responsive-css')) return
    const s = document.createElement('style')
    s.id = 'map-responsive-css'
    s.textContent = `
      .map-grid { display: grid; grid-template-columns: 1fr 280px; gap: 14px; }
      .map-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
      .gis-stats { display: grid; gap: 12px; margin-bottom: 16px; }
      .map-canvas { height: 500px; border-radius: 6px; border: 1px solid #E8E4DA; overflow: hidden; }
      @media (max-width: 1024px) { .map-grid { grid-template-columns: 1fr 240px; } }
      @media (max-width: 768px) {
        .map-grid { grid-template-columns: 1fr; }
        .map-stats { grid-template-columns: repeat(2, 1fr); }
        .gis-stats { grid-template-columns: repeat(3, 1fr) !important; }
        .map-canvas { height: 350px; }
      }
      @media (max-width: 500px) {
        .map-stats { grid-template-columns: 1fr 1fr; }
        .gis-stats { grid-template-columns: repeat(2, 1fr) !important; }
      }
    `
    document.head.appendChild(s)
  }, [])

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-hotspot'],
    queryFn: async () => {
      const { data } = await supabase.from('incidents')
        .select('id, incident_type, purok, incident_date, status, latitude, longitude')
        .order('incident_date', { ascending: false })
      return data || []
    },
    refetchInterval: 30000,
  })

  // Filtered incidents
  const filtered = incidents.filter(inc => {
    if (typeFilter !== 'All' && inc.incident_type !== typeFilter) return false
    if (dateFilter) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - dateFilter)
      if (inc.incident_date && new Date(inc.incident_date) < cutoff) return false
    }
    return true
  })

  const sitioCounts = PUROKS.map(p => ({
    purok: p,
    total: filtered.filter(i => i.purok === p).length,
    byType: Object.entries(
      filtered.filter(i => i.purok === p)
        .reduce((acc, i) => { acc[i.incident_type] = (acc[i.incident_type] || 0) + 1; return acc }, {})
    ).sort((a, b) => b[1] - a[1]),
  }))

  const maxCrime   = Math.max(...sitioCounts.map(s => s.total), 1)
  const hotspot    = sitioCounts.reduce((a, b) => a.total >= b.total ? a : b)
  const allTypes   = [...new Set(incidents.map(i => i.incident_type))].filter(Boolean)
  const resolved   = filtered.filter(i => i.status === 'Resolved').length
  const topType    = incidents.length > 0
    ? Object.entries(incidents.reduce((a, i) => { a[i.incident_type] = (a[i.incident_type] || 0) + 1; return a }, {}))
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    : '—'

  // Init map
  useEffect(() => {
    if (mapInstance.current) return
    import('leaflet').then(L => {
      const map = L.default.map(mapRef.current, { zoomControl: true }).setView([20.4445, 121.9875], 15)
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map)
      mapInstance.current = map

      if (!document.getElementById('hotspot-style')) {
        const s = document.createElement('style')
        s.id = 'hotspot-style'
        s.textContent = `
          @keyframes hs-pulse{0%{transform:scale(1);opacity:.85}50%{transform:scale(1.35);opacity:.25}100%{transform:scale(1);opacity:.85}}
          .hs-ring{border-radius:50%;animation:hs-pulse 2s ease-in-out infinite;pointer-events:none}
        `
        document.head.appendChild(s)
      }
    })
    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }
    }
  }, [])

  // Sync crime circles + markers
  useEffect(() => {
    if (!mapInstance.current) return
    import('leaflet').then(L => {
      crimeRef.current.forEach(l => { try { mapInstance.current.removeLayer(l) } catch {} })
      crimeRef.current = []

      sitioCounts.forEach(({ purok, total, byType }) => {
        const center = SITIO_CENTERS[purok]
        if (!center) return
        const { fill, border } = getCrimeColor(total, maxCrime)
        const radius = Math.max(80, Math.sqrt(total + 1) * 90)

        if (total > 0) {
          const outer = L.default.circle(center, { radius: radius * 2, color: 'none', fillColor: fill, fillOpacity: 0.07, interactive: false }).addTo(mapInstance.current)
          const inner = L.default.circle(center, { radius, color: border, weight: 1.5, fillColor: fill, fillOpacity: 0.2, interactive: false }).addTo(mapInstance.current)
          crimeRef.current.push(outer, inner)
        }

        const ds = total > 0 ? Math.max(22, Math.min(48, 18 + total * 2.5)) : 18
        const rs = ds + 16
        const icon = L.default.divIcon({
          html: `<div style="position:relative;width:${ds}px;height:${ds}px;display:flex;align-items:center;justify-content:center">
            ${total > 0 ? `<div class="hs-ring" style="position:absolute;width:${rs}px;height:${rs}px;background:${fill};left:${-(rs-ds)/2}px;top:${-(rs-ds)/2}px;opacity:.35"></div>` : ''}
            <div style="position:relative;z-index:1;width:${ds}px;height:${ds}px;border-radius:50%;background:${fill};border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${ds>28?13:11}px;font-family:Inter,sans-serif">${total > 0 ? total : ''}</div>
          </div>`,
          className: '', iconAnchor: [ds / 2, ds / 2],
        })

        const popup = `<div style="font-family:Inter,sans-serif;min-width:190px">
          <div style="font-weight:700;font-size:13px;color:#1A1A2E;margin-bottom:6px;padding-bottom:5px;border-bottom:3px solid ${fill}">🔴 ${purok}</div>
          <div style="font-size:12px;color:#5A5A52;margin-bottom:8px"><b style="color:${fill};font-size:17px">${total}</b> incident${total !== 1 ? 's' : ''}</div>
          ${byType.length
            ? byType.map(([t, c]) => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #F5F2EC">
                <span style="display:flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${TYPE_COLORS[t]||'#6B7280'};display:inline-block"></span>${t}</span>
                <b style="color:${TYPE_COLORS[t]||'#6B7280'}">${c}</b></div>`).join('')
            : '<div style="font-size:11px;color:#9A9488">No incidents in period</div>'}
        </div>`

        const mk = L.default.marker(center, { icon })
          .addTo(mapInstance.current)
          .bindPopup(popup, { maxWidth: 240 })
        crimeRef.current.push(mk)
      })

      // Individual incident pins (only those with an exact location)
      filtered.forEach(inc => {
        if (inc.latitude == null || inc.longitude == null) return
        const color = TYPE_COLORS[inc.incident_type] || '#6B7280'
        const dot = L.default.divIcon({
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
          className: '', iconAnchor: [6, 6],
        })
        const date = inc.incident_date ? new Date(inc.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
        const m = L.default.marker([inc.latitude, inc.longitude], { icon: dot })
          .addTo(mapInstance.current)
          .bindPopup(`<div style="font-family:Inter,sans-serif;min-width:150px">
            <div style="font-weight:700;font-size:12px;color:#1A1A2E;margin-bottom:3px">${inc.incident_type}</div>
            <div style="font-size:11px;color:#5A5A52">${inc.purok} · ${date}</div>
            <div style="font-size:11px;color:${inc.status === 'Resolved' ? '#0D9E8C' : '#B83232'};margin-top:2px">${inc.status}</div>
          </div>`, { maxWidth: 220 })
        crimeRef.current.push(m)
      })
    })
  }, [sitioCounts, maxCrime, filtered])

  return (
    <div>
      {/* Stats */}
      <div className="map-stats">
        <StatCard icon="🚨" value={filtered.length} label="Total Incidents" color="red" />
        <StatCard icon="🔴" value={hotspot.total > 0 ? hotspot.purok.replace('Sitio ', '') : 'None'} label="Crime Hotspot" color="navy" />
        <StatCard icon="✅" value={resolved} label="Cases Resolved" color="teal" />
        <StatCard icon="⚡" value={topType} label="Most Common" color="gold" />
      </div>

      <div className="map-grid">

        {/* Map */}
        <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: '#FAFAF7', borderBottom: '1px solid #E8E4DA', padding: '12px 16px' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>Crime Hotspot Map</div>
            <div style={{ fontSize: 10, color: '#9A9488', marginTop: 1 }}>Barangay San Joaquin · Click a marker to see details</div>
          </div>

          {/* Legend */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #F0EDE4', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Low',      c: '#F59E0B' },
              { label: 'Moderate', c: '#F97316' },
              { label: 'High',     c: '#EF4444' },
              { label: 'Safe',     c: '#22C55E' },
            ].map(({ label, c }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A52' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}88`, flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>

          <div ref={mapRef} className="map-canvas" />
          <p style={{ fontSize: 10, color: '#9A9488', textAlign: 'center', padding: '7px 0', margin: 0, background: '#FAFAF7', borderTop: '1px solid #F0EDE4' }}>
            Pulsing circles show incident density per sitio
          </p>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Filters */}
          <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: '#FAFAF7', borderBottom: '1px solid #E8E4DA', padding: '10px 14px' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Filters</div>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Date range */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9A9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Date Range</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DATE_FILTERS.map(f => (
                    <button key={f.label} onClick={() => setDateFilter(f.days)} style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                      background: dateFilter === f.days ? '#1A3A5C' : '#F5F2EC',
                      color: dateFilter === f.days ? '#fff' : '#5A5A52',
                      border: `1px solid ${dateFilter === f.days ? '#1A3A5C' : '#D4D0C8'}`,
                    }}>{f.label}</button>
                  ))}
                </div>
              </div>
              {/* Crime type */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9A9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Crime Type</div>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #D4D0C8', borderRadius: 4, color: '#1A1A2E', fontFamily: 'Inter,sans-serif', background: '#fff' }}
                >
                  <option value="All">All Types ({filtered.length})</option>
                  {allTypes.map(t => (
                    <option key={t} value={t}>{t} ({incidents.filter(i => i.incident_type === t).length})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sitio ranking */}
          <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: '#FAFAF7', borderBottom: '1px solid #E8E4DA', padding: '10px 14px' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Sitio Ranking</div>
              <div style={{ fontSize: 10, color: '#9A9488', marginTop: 1 }}>by incident count</div>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...sitioCounts].sort((a, b) => b.total - a.total).map(({ purok, total, byType }) => {
                const { fill } = getCrimeColor(total, maxCrime)
                const pct = maxCrime > 0 ? (total / maxCrime) * 100 : 0
                return (
                  <div key={purok}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>{purok.replace('Sitio ', '')}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: fill }}>{total}</span>
                    </div>
                    <div style={{ height: 6, background: '#F0EDE4', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: fill, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                    {byType.length > 0 && (
                      <div style={{ fontSize: 10, color: '#9A9488' }}>
                        Top: {byType[0][0]} ({byType[0][1]})
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent incidents */}
          <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: '#FAFAF7', borderBottom: '1px solid #E8E4DA', padding: '10px 14px' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Recent Incidents</div>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: '#9A9488' }}>No incidents in selected period</div>
              ) : filtered.slice(0, 20).map(inc => (
                <div key={inc.id} style={{ padding: '8px 14px', borderBottom: '1px solid #F5F2EC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLORS[inc.incident_type] || '#6B7280', flexShrink: 0 }} />
                      {inc.incident_type}
                    </div>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                      background: inc.status === 'Resolved' ? '#F0FBF9' : '#FFF0F0',
                      color: inc.status === 'Resolved' ? '#0D9E8C' : '#B83232',
                    }}>{inc.status}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#9A9488', marginTop: 2 }}>
                    {inc.purok} · {inc.incident_date
                      ? new Date(inc.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
