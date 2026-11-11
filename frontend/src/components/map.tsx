// src/components/BasicMap.tsx
import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
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

interface RoutePoint {
  latitude: number
  longitude: number
  label: string
}

function FitRoute({
  fromLat,
  fromLng,
  toLat,
  toLng,
}: {
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
}) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(
      [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      { padding: [32, 32] },
    )
  }, [map, fromLat, fromLng, toLat, toLng])
  return null
}

export function RouteMap({ from, to, color = "#2563eb" }: { from: RoutePoint; to: RoutePoint; color?: string }) {
  return (
    <MapContainer
      center={[to.latitude, to.longitude]}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={[
          [from.latitude, from.longitude],
          [to.latitude, to.longitude],
        ]}
        pathOptions={{ color, dashArray: "8 6" }}
      />
      <Marker position={[from.latitude, from.longitude]}>
        <Popup>{from.label}</Popup>
      </Marker>
      <Marker position={[to.latitude, to.longitude]}>
        <Popup>{to.label}</Popup>
      </Marker>
      <FitRoute fromLat={from.latitude} fromLng={from.longitude} toLat={to.latitude} toLng={to.longitude} />
    </MapContainer>
  )
}
