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

      const colors = ['#0D9E8C', '#F5A623', '#3B82F6', '#EF4444', '#8B5CF6']
      const puroks = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5']
      const pts = [
        [20.449, 121.9685], [20.4498, 121.97], [20.4486, 121.971], [20.4479, 121.9695], [20.4502, 121.972],
        [20.4475, 121.968], [20.451, 121.9688], [20.4465, 121.9715], [20.452, 121.9705], [20.4458, 121.9698],
        [20.4533, 121.9715], [20.447, 121.973], [20.4542, 121.97], [20.448, 121.974], [20.4495, 121.975],
        [20.4515, 121.966], [20.445, 121.968], [20.4525, 121.9735], [20.444, 121.9705], [20.4535, 121.969],
      ]
      pts.forEach((p, i) => {
        const ci = i % 5
        L.default.circleMarker(p, { radius: 7, fillColor: colors[ci], color: '#fff', weight: 2, fillOpacity: 0.9 })
          .addTo(map)
          .bindPopup(`<b>Household ${i + 1}</b><br>${puroks[ci]}<br>Barangay Kayvaluganan`)
      })
      mapInstance.current = map
    })
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null } }
  }, [])

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard icon="🏠" value="342" label="Mapped Households" color="teal" />
        <StatCard icon="📍" value="5" label="Puroks / Zones" color="gold" />
        <StatCard icon="🎯" value="97.4%" label="Geocoded Accuracy" color="blue" />
      </div>
      <SectionCard
        title="GIS Household Map"
        subtitle="Barangay Kayvaluganan, Basco, Batanes · OpenStreetMap"
        action={
          <div className="flex gap-1.5 flex-wrap">
            {['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5'].map((p, i) => (
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
