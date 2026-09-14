// src/components/BasicMap.tsx
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "./../lib/leafletIconFix.ts"

interface BasicMapProps {
  latitude: number
  longitude: number
  zoom?: number
  label?: string
}

export function BasicMap({ latitude, longitude, zoom = 15, label }: BasicMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]}>
        {label && <Popup>{label}</Popup>}
      </Marker>
    </MapContainer>
  )
}