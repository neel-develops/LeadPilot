import React, { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Circle, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const TEMP = { hot: '#f25f5c', warm: '#f5c518', cold: '#00BAF2' }
const initials = (n = '') => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

const repIcon = (r, on) => L.divIcon({
  className: '',
  html: `<div class="osm-rep ${on ? 'on' : ''}">${initials(r.name)}</div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
})
const visitIcon = (v, on, label) => L.divIcon({
  className: '',
  html: `<div class="osm-visit ${on ? 'on' : ''}" style="--c:${TEMP[v.temperature] || '#8d8d95'}">${label ?? ''}</div>`,
  iconSize: [26, 26], iconAnchor: [13, 13],
})
const pinIcon = L.divIcon({ className: '', html: '<div class="osm-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

function Fit({ points }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 13 })
    else if (points.length === 1) map.setView(points[0], 13)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** OpenStreetMap view of reps, visits and assignment lines. */
export default function OsmMap({ reps = [], visits = [], selectedRep, onRep, selectedVisit, onVisit, height = 470, numbered = false, pin, radiusKm = 12, fit = true }) {
  const repById = useMemo(() => Object.fromEntries(reps.map((r) => [r.id, r])), [reps])
  const shownVisits = visits.filter((v) => v.lat && (!selectedRep || v.agent_id === selectedRep))
  const points = [
    ...(selectedRep ? reps.filter((r) => r.id === selectedRep) : reps).map((r) => [r.home_lat, r.home_lng]),
    ...shownVisits.map((v) => [v.lat, v.lng]),
    ...(pin ? [pin] : []),
  ]
  return (
    <div className="osm-wrap" style={{ height }}>
      <MapContainer center={[18.53, 73.86]} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }} attributionControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {fit && <Fit points={points} />}
        {reps.filter((r) => !selectedRep || r.id === selectedRep).map((r) => (
          <React.Fragment key={'c' + r.id}>
            {selectedRep === r.id && <Circle center={[r.home_lat, r.home_lng]} radius={radiusKm * 1000} pathOptions={{ color: '#00BAF2', weight: 1, dashArray: '6 6', fillOpacity: 0.06 }} />}
          </React.Fragment>
        ))}
        {shownVisits.map((v) => {
          const r = repById[v.agent_id]
          if (!r) return null
          return <Polyline key={'l' + v.id} positions={[[r.home_lat, r.home_lng], [v.lat, v.lng]]}
            pathOptions={{ color: selectedVisit === v.id ? '#00BAF2' : '#5aa9d6', weight: selectedVisit === v.id ? 3 : 1.6, dashArray: '6 6', opacity: 0.85 }} />
        })}
        {shownVisits.map((v, i) => (
          <Marker key={'v' + v.id} position={[v.lat, v.lng]} icon={visitIcon(v, selectedVisit === v.id, numbered ? i + 1 : '')} eventHandlers={{ click: () => onVisit?.(v.id) }}>
            <Tooltip direction="top" offset={[0, -12]}>{v.lead_name} · {v.shop_label || ''}<br />{v.slot_label} · {v.rep_name}</Tooltip>
          </Marker>
        ))}
        {reps.filter((r) => !selectedRep || r.id === selectedRep).map((r) => (
          <Marker key={r.id} position={[r.home_lat, r.home_lng]} icon={repIcon(r, selectedRep === r.id)} eventHandlers={{ click: () => onRep?.(selectedRep === r.id ? null : r.id) }}>
            <Tooltip direction="top" offset={[0, -16]}>{r.name} · {r.area}{r.upcoming != null ? ` · ${r.upcoming} upcoming` : ''}</Tooltip>
          </Marker>
        ))}
        {pin && <Marker position={pin} icon={pinIcon} />}
      </MapContainer>
    </div>
  )
}
