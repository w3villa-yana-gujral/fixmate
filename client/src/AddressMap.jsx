import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const fallbackCenter = [20.5937, 78.9629]

export default function AddressMap({ latitude, longitude, label }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const hasPoint = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
  const lat = hasPoint ? Number(latitude) : fallbackCenter[0]
  const lng = hasPoint ? Number(longitude) : fallbackCenter[1]

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([lat, lng], hasPoint ? 15 : 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map)
    mapRef.current = map
    const resize = () => map.invalidateSize()
    window.setTimeout(resize, 80)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setView([lat, lng], hasPoint ? 16 : 4)
    if (hasPoint) {
      if (markerRef.current) markerRef.current.setLatLng([lat, lng])
      else markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map)
      if (label) markerRef.current.bindPopup(label)
    }
    map.invalidateSize()
  }, [lat, lng, hasPoint, label])

  return <div className="leaflet-map" ref={containerRef} />
}
