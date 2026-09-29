import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

import markerIconPng from "leaflet/dist/images/marker-icon.png"
import markerShadowPng from "leaflet/dist/images/marker-shadow.png"

const markerIcon = L.icon({
  iconUrl: markerIconPng,
  shadowUrl: markerShadowPng,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

type Coords = { lat: number; lng: number }

interface MapClickPickerProps {
  /** Koordinat terpilih (controlled — dikendalikan penuh oleh parent). */
  value: Coords
  onChange: (coords: Coords) => void
  /** Radius jangkauan dalam kilometer. Digambar sebagai lingkaran sungguhan di peta. */
  radiusKm?: number
  zoom?: number
  className?: string
}

/** Menangkap klik di peta. Wajib jadi child <MapContainer> agar useMapEvents bisa dipakai. */
function ClickCatcher({ onPick }: { onPick: (c: Coords) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

/**
 * Menggeser viewport peta saat `value` berubah dari luar (mis. hasil GPS).
 * FIX: ini pengganti trik `key={lat-lng}` yang sebelumnya me-remount
 * seluruh peta setiap koordinat berubah (berkedip + zoom ter-reset).
 */
function Recenter({ center, zoom }: { center: Coords; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true })
  }, [center.lat, center.lng])
  return null
}

/** Menyesuaikan viewport agar seluruh lingkaran radius muat di layar. */
function FitRadius({ center, radiusKm }: { center: Coords; radiusKm?: number }) {
  const map = useMap()
  useEffect(() => {
    if (!radiusKm) return
    const circle = L.circle([center.lat, center.lng], { radius: radiusKm * 1000 }).addTo(map)
    map.fitBounds(circle.getBounds(), { padding: [20, 20] })
  }, [radiusKm])
  return null
}

export function MapClickPickerAdmin({
  value,
  onChange,
  radiusKm,
  zoom = 14,
  className = "h-72 w-full rounded-xl overflow-hidden",
}: MapClickPickerProps) {
  return (
    <div className={className}>
      <MapContainer
        center={[value.lat, value.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <ClickCatcher onPick={onChange} />
        <Recenter center={value} />
        <FitRadius center={value} radiusKm={radiusKm} />

        <Marker position={[value.lat, value.lng]} icon={markerIcon} />

        {radiusKm != null && (
          <Circle
            center={[value.lat, value.lng]}
            radius={radiusKm * 1000} // Leaflet pakai satuan METER, bukan pixel
            pathOptions={{ color: "#38bdf8", fillColor: "#38bdf8", fillOpacity: 0.12, weight: 2 }}
          />
        )}
      </MapContainer>
    </div>
  )
}