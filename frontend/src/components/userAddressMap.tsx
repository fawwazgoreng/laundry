// src/components/LocationPicker.tsx
import { useState } from "react"
import { LocateFixed, MapPin } from "lucide-react"
import { MapClickPicker } from "./mapClickPicker"
import { useGeolocation } from "../lib/useGeoLocation"
import { reverseGeocode } from "../lib/geoCode"

export function LocationPicker() {
  const [coords, setCoords] = useState({ lat: -6.496861119036644, lng: 110.90468997753888 })
  const [address, setAddress] = useState<string>("")
  const [loadingAddress, setLoadingAddress] = useState(false)
  const { locate, loading: loadingGps } = useGeolocation()

  async function lookupAddress(lat: number, lng: number) {
    setLoadingAddress(true)
    try {
      const result = await reverseGeocode(lat, lng)
      setAddress(result.displayName)
    } catch {
      setAddress("Alamat tidak ditemukan")
    } finally {
      setLoadingAddress(false)
    }
  }

  function handleMapPick(next: { lat: number; lng: number }) {
    setCoords(next)
    lookupAddress(next.lat, next.lng)
  }

  function handleUseMyLocation() {
    locate()
    // hasil geolocation diambil lewat callback useGeolocation,
    // di real project sebaiknya effect-kan `result` dari hook lalu panggil handleMapPick
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-strong">Atur Lokasi</h2>
        <button
          onClick={handleUseMyLocation}
          disabled={loadingGps}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gray-50"
        >
          <LocateFixed size={14} />
          {loadingGps ? "Mencari..." : "Gunakan Lokasi Saya"}
        </button>
      </div>

      <MapClickPicker defaultCenter={coords} onChange={handleMapPick} />

    </div>
  )
}