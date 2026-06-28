// ============================================================================
//  GISMap.jsx  —  "GIS Household Map" page
// ----------------------------------------------------------------------------
//  An interactive Leaflet + OpenStreetMap of the barangay. Households appear as
//  colour-coded pins per sitio. Clicking a pin shows who lives there and their
//  sector flags (PWD/Senior/Solo). Clicking empty space drops a new pin; you
//  pick the household head and save. Important: if that head ALREADY has a
//  household (auto-created in Resident Profiling), the save UPDATES that
//  household's location instead of inserting a duplicate household number.
//  Map tiles are cached by a service worker for limited offline viewing.
// ============================================================================

// GISMap.jsx
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SectionCard, StatCard } from '../components/ui/index'
import { toast } from 'react-toastify'
import { useAuthStore } from '../store/authStore'
import { canEdit } from '../lib/permissions'

const PUROKS = ['Sitio Hunan', 'Sitio Hagu', 'Sitio Tuva']
const HOUSING_TYPES = ['Concrete', 'Semi-concrete', 'Wood', 'Makeshift']

const EMPTY_HH_FORM = { household_no: '', purok: 'Sitio Hunan', address: '', housing_type: 'Concrete', head_name: '', resident_id: '', existing_household_id: null }

// ── Offline tile helpers ──────────────────────────────────────
function latLngToTile(lat, lng, z) {
  const n = Math.pow(2, z)
  const x = Math.floor((lng + 180) / 360 * n)
  const y = Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n
  )
  return { x, y }
}

// Tile list for Basco, Batanes at zoom 13–16
function getBascoTiles() {
  const bounds = { minLat: 20.41, maxLat: 20.49, minLng: 121.93, maxLng: 122.01 }
  const tiles = []
  for (let z = 13; z <= 16; z++) {
    const tl = latLngToTile(bounds.maxLat, bounds.minLng, z)
    const br = latLngToTile(bounds.minLat, bounds.maxLng, z)
    for (let x = tl.x; x <= br.x; x++) {
      for (let y = tl.y; y <= br.y; y++) {
        tiles.push({ z, x, y })
      }
    }
  }
  return tiles
}

const PUROK_COLORS = {
  'Sitio Hunan': '#0D9E8C',
  'Sitio Hagu':  '#F5A623',
  'Sitio Tuva':  '#3B82F6',
}

export default function GISMap() {
  const { profile } = useAuthStore()
  const canWrite = canEdit(profile?.role)
  const canWriteRef = useRef(canWrite)
  canWriteRef.current = canWrite

  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const markersRef   = useRef({})
  const tempMarker   = useRef(null)
  const qc           = useQueryClient()

  const [pendingPin, setPendingPin] = useState(null)
  const [form, setForm]             = useState(EMPTY_HH_FORM)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterPurok, setFilterPurok]   = useState('All')
  const [hhHeadSearch, setHhHeadSearch] = useState('')
  const [showHHDropdown, setShowHHDropdown] = useState(false)

  // Offline state
  const [online, setOnline]             = useState(() => navigator.onLine)
  const [caching, setCaching]           = useState(false)
  const [cacheProgress, setCacheProgress] = useState({ done: 0, total: 0 })
  const [cachedTiles, setCachedTiles]   = useState(0)

  // ── Load households ──
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

  // ── Load all residents (to list household members in the popup) ──
  const { data: allMembers = [] } = useQuery({
    queryKey: ['household-members'],
    queryFn: async () => {
      const { data } = await supabase
        .from('residents')
        .select('id, first_name, last_name, household_id, date_of_birth, is_household_head, is_pwd, pwd_type, is_senior_citizen, is_solo_parent, is_out_of_school_youth')
      return data || []
    },
  })

  // Group residents by household_id
  const membersByHH = {}
  allMembers.forEach(r => {
    if (!r.household_id) return
    ;(membersByHH[r.household_id] = membersByHH[r.household_id] || []).push(r)
  })

  // ── Load HH Heads from residents ──
  const { data: hhHeads = [] } = useQuery({
    queryKey: ['hh-heads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('id, first_name, last_name, purok, household_id, households(household_no)')
        .eq('is_household_head', true)
        .order('last_name')
      if (error) return []
      return data || []
    },
  })

  // ── Save household pin ──
  // If the head already has a household (created in Resident Profiling), we UPDATE
  // that record's location instead of inserting a duplicate household number.
  const saveMutation = useMutation({
    mutationFn: async ({ id, ...payload }) => {
      if (id) {
        const { error } = await supabase.from('households').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('households').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Household pinned and saved!')
      qc.invalidateQueries(['households-map'])
      setPendingPin(null)
      setForm(EMPTY_HH_FORM)
      setHhHeadSearch('')
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

  // ── Init map ──
  useEffect(() => {
    if (mapInstance.current) return
    import('leaflet').then(L => {
      const map = L.default.map(mapRef.current, { zoomControl: true }).setView([20.44531, 121.98450], 16)
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      map.on('click', (e) => {
        if (!canWriteRef.current) return   // read-only roles can't add households
        const { lat, lng } = e.latlng
        if (tempMarker.current) map.removeLayer(tempMarker.current)
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

  // ── Sync markers ──
  useEffect(() => {
    if (!mapInstance.current) return
    import('leaflet').then(L => {
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

        // Residents living in this household
        const members = membersByHH[h.id] || []
        const ageOf = (dob) => dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) : '—'
        const pwdCount    = members.filter(m => m.is_pwd).length
        const seniorCount = members.filter(m => m.is_senior_citizen).length
        const soloCount   = members.filter(m => m.is_solo_parent).length
        const flagTag = (txt, color) => `<span style="display:inline-block;background:${color}22;color:${color};font-size:9px;font-weight:700;padding:0 4px;border-radius:3px;margin-left:3px">${txt}</span>`
        const membersHtml = members.length
          ? members.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #F5F2EC;font-size:11px">
              <span>${m.is_household_head ? '👑 ' : ''}${m.first_name} ${m.last_name} <span style="color:#9A9488">(${ageOf(m.date_of_birth)})</span></span>
              <span style="flex-shrink:0">${m.is_pwd ? flagTag('PWD', '#C9A84C') : ''}${m.is_senior_citizen ? flagTag('SC', '#3B82F6') : ''}${m.is_solo_parent ? flagTag('SP', '#0D9E8C') : ''}${m.is_out_of_school_youth ? flagTag('OSY', '#EF4444') : ''}</span>
            </div>`).join('')
          : '<div style="font-size:11px;color:#9A9488;padding:4px 0">No residents assigned yet. Add them in Resident Profiling.</div>'
        const summary = members.length
          ? `${members.length} member${members.length !== 1 ? 's' : ''}${pwdCount ? ` · ${pwdCount} PWD` : ''}${seniorCount ? ` · ${seniorCount} senior${seniorCount !== 1 ? 's' : ''}` : ''}${soloCount ? ` · ${soloCount} solo parent${soloCount !== 1 ? 's' : ''}` : ''}`
          : 'No members yet'

        const marker = L.default.marker([h.latitude, h.longitude], { icon })
          .addTo(mapInstance.current)
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:220px">
              <div style="font-weight:700;font-size:13px;color:#1A1A2E;margin-bottom:4px">${h.household_no || 'Household'}</div>
              <div style="font-size:11px;color:#5A5A52;line-height:1.6">
                <b>Sitio:</b> ${h.purok}<br/>
                ${h.address ? `<b>Address:</b> ${h.address}<br/>` : ''}
                ${h.housing_type ? `<b>Type:</b> ${h.housing_type}<br/>` : ''}
                ${h.head_name ? `<b>HH Head:</b> ${h.head_name}<br/>` : ''}
              </div>
              <div style="margin-top:8px;border-top:1px solid #E8E4DA;padding-top:6px">
                <div style="font-weight:700;font-size:11px;color:#1A1A2E;margin-bottom:3px">👥 Residents <span style="font-weight:400;color:#9A9488">— ${summary}</span></div>
                <div style="max-height:150px;overflow-y:auto">${membersHtml}</div>
              </div>
              ${canWriteRef.current ? `<div style="display:flex;gap:6px;margin-top:8px">
                <button onclick="window.__editHH('${h.id}')" style="flex:1;padding:4px 0;background:#1A3A5C;color:#fff;border:none;border-radius:3px;font-size:11px;cursor:pointer;font-family:Inter,sans-serif">Edit</button>
                <button onclick="window.__deleteHH('${h.id}')" style="flex:1;padding:4px 0;background:#B83232;color:#fff;border:none;border-radius:3px;font-size:11px;cursor:pointer;font-family:Inter,sans-serif">Remove</button>
              </div>` : ''}
            </div>
          `, { maxWidth: 280 })

        markersRef.current[h.id] = marker
      })

      window.__editHH = (id) => {
        const h = households.find(x => x.id === id)
        if (!h) return
        setEditTarget(h)
        setForm({ household_no: h.household_no || '', purok: h.purok, address: h.address || '', housing_type: h.housing_type || 'Concrete', head_name: h.head_name || '', resident_id: '' })
        setHhHeadSearch(h.head_name || '')
      }
      window.__deleteHH = (id) => setDeleteTarget(id)
    })
  }, [households, filterPurok, allMembers])

  // ── Service Worker + Online/Offline ──
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({ type: 'GET_TILE_COUNT' })
      })
      const onMsg = (e) => {
        if (e.data?.type === 'PRECACHE_PROGRESS') {
          setCacheProgress({ done: e.data.done, total: e.data.total })
        }
        if (e.data?.type === 'PRECACHE_DONE') {
          setCaching(false)
          toast.success(`Map tiles saved! Offline map is ready for Basco, Batanes.`)
          navigator.serviceWorker.ready.then(r => r.active?.postMessage({ type: 'GET_TILE_COUNT' }))
        }
        if (e.data?.type === 'TILE_COUNT') setCachedTiles(e.data.count)
        if (e.data?.type === 'TILES_CLEARED') { setCachedTiles(0); toast.success('Offline tiles cleared.') }
      }
      navigator.serviceWorker.addEventListener('message', onMsg)
      return () => navigator.serviceWorker.removeEventListener('message', onMsg)
    }
  }, [])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const handleSaveOffline = () => {
    if (!('serviceWorker' in navigator)) { toast.error('Service Workers not supported.'); return }
    const tiles = getBascoTiles()
    setCaching(true)
    setCacheProgress({ done: 0, total: tiles.length })
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({ type: 'PRECACHE_TILES', tiles })
    })
  }

  const handleClearCache = () => {
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({ type: 'CLEAR_TILES' })
    })
  }

  // ── HH Head selection handler ──
  const handleSelectHHHead = (resident) => {
    const fullName = `${resident.first_name} ${resident.last_name}`
    const householdNo = resident.households?.household_no || ''
    setForm(prev => ({
      ...prev,
      head_name: fullName,
      resident_id: resident.id,
      household_no: householdNo,
      purok: resident.purok,
      existing_household_id: resident.household_id || null,   // their household from Resident Profiling
    }))
    setHhHeadSearch(fullName)
    setShowHHDropdown(false)
  }

  // Filter HH heads by search
  const filteredHHHeads = hhHeads.filter(r =>
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(hhHeadSearch.toLowerCase())
  )

  // Stats
  const mapped = households.length
  // How many households actually have a saved map location (a real pin).
  // Households created from Resident Profiling have no coordinates until
  // someone places them on the map here, so this can be < total.
  const located = households.filter(h => h.latitude && h.longitude).length
  const purokCounts = PUROKS.map(p => ({ purok: p, count: households.filter(h => h.purok === p).length }))

  // Auto-generate the next 4-digit household number (HH-0001, HH-0002, ...)
  const nextHouseholdNo = (() => {
    const max = households.reduce((m, h) => {
      const match = String(h.household_no || '').match(/(\d+)/)
      const n = match ? parseInt(match[1], 10) : 0
      return n > m ? n : m
    }, 0)
    return `HH-${String(max + 1).padStart(4, '0')}`
  })()

  const handleSave = () => {
    if (!pendingPin) return
    const fields = {
      purok: form.purok,
      address: form.address.trim(),
      housing_type: form.housing_type,
      head_name: form.head_name.trim(),
      latitude: pendingPin.lat,
      longitude: pendingPin.lng,
    }
    if (form.existing_household_id) {
      // Head already has a household (from Resident Profiling) — attach this location to it
      saveMutation.mutate({ id: form.existing_household_id, ...fields })
    } else {
      // Brand-new household — auto-assign the next 4-digit number
      saveMutation.mutate({ household_no: form.household_no.trim() || nextHouseholdNo, ...fields })
    }
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

  // Shared HH Head selector UI
  const HHHeadSelector = ({ label = 'Household Head' }) => (
    <div style={{ position: 'relative' }}>
      <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        className="form-input"
        placeholder="Search registered HH head..."
        value={hhHeadSearch}
        onChange={e => { setHhHeadSearch(e.target.value); setShowHHDropdown(true) }}
        onFocus={() => setShowHHDropdown(true)}
        autoComplete="off"
      />
      {showHHDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #D4D0C8', borderRadius: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto',
        }}>
          {filteredHHHeads.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 11, color: '#9A9488', textAlign: 'center' }}>
              {hhHeads.length === 0
                ? 'No household heads registered yet. Add a resident and mark them as HH Head first.'
                : 'No match found'}
            </div>
          ) : (
            filteredHHHeads.map(r => (
              <div
                key={r.id}
                onClick={() => handleSelectHHHead(r)}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F5F2EC' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F2EC'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>
                  {r.first_name} {r.last_name}
                </div>
                <div style={{ fontSize: 10, color: '#9A9488', marginTop: 1 }}>
                  {r.purok}
                  {r.households?.household_no ? ` · ${r.households.household_no}` : ' · No HH No. yet'}
                </div>
              </div>
            ))
          )}
          <div
            style={{ padding: '6px 12px', fontSize: 10, color: '#9A9488', borderTop: '1px solid #F5F2EC', cursor: 'pointer', textAlign: 'center' }}
            onClick={() => setShowHHDropdown(false)}
          >
            Close
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div onClick={() => setShowHHDropdown(false)}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }} className="gis-stats">
        <StatCard icon="🏠" value={mapped} label="Mapped Households" color="navy" />
        <StatCard icon="📍" value="3" label="Sitios / Zones" color="gold" />
        <StatCard icon="🗺️" value={mapped > 0 ? '✓ Live' : 'Pending'} label="Map Data" color="teal" />
        <StatCard icon="📌" value={pendingPin ? 'Placing...' : 'Ready'} label="Pin Status" color={pendingPin ? 'gold' : 'navy'} />
        <StatCard icon={online ? '🟢' : '🔴'} value={online ? 'Online' : 'Offline'} label={cachedTiles > 0 ? `${cachedTiles} tiles cached` : 'No offline cache'} color={online ? 'teal' : 'red'} />
      </div>

      <div className="map-grid">

        {/* ── Map ─────────────────────────────────────── */}
        <SectionCard
          title="GIS Map — Barangay San Joaquin"
          subtitle="Basco, Batanes · Click anywhere on the map to place a household pin"
          action={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {caching ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 100, height: 6, background: '#E8E4DA', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${cacheProgress.total ? (cacheProgress.done / cacheProgress.total) * 100 : 0}%`, height: '100%', background: '#0D9E8C', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#5A5A52' }}>{cacheProgress.done}/{cacheProgress.total}</span>
                </div>
              ) : (
                <button
                  onClick={handleSaveOffline}
                  disabled={!online || caching}
                  style={{ fontSize: 11, padding: '4px 10px', background: cachedTiles > 0 ? '#F0FBF9' : '#1A3A5C', color: cachedTiles > 0 ? '#0D9E8C' : '#fff', border: `1px solid ${cachedTiles > 0 ? '#0D9E8C' : '#1A3A5C'}`, borderRadius: 4, cursor: online ? 'pointer' : 'not-allowed', fontFamily: 'Inter,sans-serif', opacity: online ? 1 : 0.5 }}
                  title={cachedTiles > 0 ? `${cachedTiles} tiles cached — click to refresh` : 'Save map tiles for offline use'}
                >
                  💾 {cachedTiles > 0 ? `Offline Ready (${cachedTiles})` : 'Save Offline'}
                </button>
              )}
              {cachedTiles > 0 && !caching && (
                <button
                  onClick={handleClearCache}
                  style={{ fontSize: 11, padding: '4px 8px', background: '#FFF0F0', color: '#B83232', border: '1px solid #B83232', borderRadius: 4, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                  title="Clear cached tiles"
                >
                  🗑️
                </button>
              )}
            </div>
          }
        >
          {/* Sitio filter + legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <select
              value={filterPurok}
              onChange={e => setFilterPurok(e.target.value)}
              style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #D4D0C8', borderRadius: 4, color: '#1A1A2E', fontFamily: 'Inter,sans-serif' }}
            >
              <option value="All">All Sitios</option>
              {PUROKS.map(p => <option key={p}>{p}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PUROKS.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A52' }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: PUROK_COLORS[p], border: '1.5px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', flexShrink: 0 }} />
                  {p.replace('Sitio ', '')} ({purokCounts.find(x => x.purok === p)?.count || 0})
                </div>
              ))}
            </div>
          </div>
          <div ref={mapRef} className="map-canvas" />
          <p style={{ fontSize: 11, color: '#9A9488', marginTop: 8, textAlign: 'center' }}>
            💡 Click on the map to drop a pin · Click an existing pin to view details, edit, or remove
          </p>
        </SectionCard>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onClick={e => e.stopPropagation()}>

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

                {/* HH Head searchable dropdown */}
                <HHHeadSelector label="Household Head *" />

                {/* The selected head's existing Household No. (auto-created in Resident Profiling) */}
                {form.household_no.trim() && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FBF9', border: '1px solid #B3E8E2', borderRadius: 6, padding: '8px 12px' }}>
                    <span style={{ fontSize: 11, color: '#5A5A52' }}>Household No.</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0A6B5E', fontSize: 13 }}>{form.household_no}</span>
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Sitio *</label>
                  <select className="form-select" value={form.purok} onChange={e => setForm({ ...form, purok: e.target.value })}>
                    {PUROKS.map(p => <option key={p}>{p}</option>)}
                  </select>
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
                    setHhHeadSearch('')
                    setForm(EMPTY_HH_FORM)
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
                  <input className="form-input" placeholder="e.g. HH-0001" value={form.household_no} onChange={e => setForm({ ...form, household_no: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Sitio</label>
                  <select className="form-select" value={form.purok} onChange={e => setForm({ ...form, purok: e.target.value })}>
                    {PUROKS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>

                {/* HH Head selector for edit too */}
                <HHHeadSelector label="Household Head" />

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
                  <button className="btn btn-ghost" onClick={() => { setEditTarget(null); setHhHeadSearch('') }}>Cancel</button>
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
              {hhHeads.length > 0 && (
                <div style={{ marginTop: 10, padding: '6px 10px', background: '#F0FBF9', borderRadius: 4, border: '1px solid #0D9E8C' }}>
                  <p style={{ fontSize: 10, color: '#0D9E8C', margin: 0 }}>
                    ✅ {hhHeads.length} registered HH head{hhHeads.length > 1 ? 's' : ''} available
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Household list */}
          <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: '#FAFAF7', borderBottom: '1px solid #E8E4DA', padding: '10px 14px' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Households</div>
              <div style={{ fontSize: 10, color: '#9A9488', marginTop: 2 }}>{mapped} registered · {located} on map</div>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {households.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: '#9A9488' }}>No households registered yet</div>
              ) : (
                households.map(h => {
                  const onMap = Boolean(h.latitude && h.longitude)
                  return (
                  <div key={h.id} style={{ padding: '8px 14px', borderBottom: '1px solid #F5F2EC', display: 'flex', alignItems: 'center', gap: 8, cursor: onMap ? 'pointer' : 'default' }}
                    title={onMap ? 'Click to fly to this household on the map' : 'Not placed on the map yet — click the map to pin it'}
                    onClick={() => {
                      if (mapInstance.current && onMap) {
                        mapInstance.current.flyTo([h.latitude, h.longitude], 18, { duration: 1 })
                        markersRef.current[h.id]?.openPopup()
                      }
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PUROK_COLORS[h.purok] || '#1A3A5C', flexShrink: 0, opacity: onMap ? 1 : 0.35 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.household_no}</div>
                      <div style={{ fontSize: 10, color: '#9A9488' }}>{h.purok} {h.head_name ? `· ${h.head_name}` : ''}</div>
                    </div>
                    {/* Shows whether this household actually has a map pin yet */}
                    <span style={{ fontSize: 9, flexShrink: 0, color: onMap ? '#0D9E8C' : '#C0A062' }}>
                      {onMap ? '📍 on map' : 'not located'}
                    </span>
                  </div>
                  )
                })
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