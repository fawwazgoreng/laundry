// src/components/MapClickPicker.tsx
import { useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "./../lib/leafletIconFix.ts"

interface Coordinates {
  lat: number
  lng: number
}

function ClickHandler({ onPick }: { onPick: (coords: Coordinates) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export function MapClickPicker({
  defaultCenter = { lat: -6.2088, lng: 106.8456 },
  onChange,
}: {
  defaultCenter?: Coordinates
  onChange?: (coords: Coordinates) => void
}) {
  const [marker, setMarker] = useState<Coordinates>(defaultCenter)

  function handlePick(coords: Coordinates) {
    setMarker(coords)
    onChange?.(coords)
  }

  return (
    <div className="space-y-2">
      <div className="h-80 w-full overflow-hidden rounded-2xl border border-gray-200">
        <MapContainer
          center={[defaultCenter.lat, defaultCenter.lng]}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[marker.lat, marker.lng]} />
          <ClickHandler onPick={handlePick} />
        </MapContainer>
      </div>
    </div>
  )
}