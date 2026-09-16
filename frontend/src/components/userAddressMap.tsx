// src/components/LocationPicker.tsx
import { useCallback, useEffect, useState } from "react"
import { LocateFixed } from "lucide-react"
import { MapClickPicker } from "./mapClickPicker"
import { useGeolocation } from "../lib/useGeoLocation"
import { reverseGeocode } from "../lib/geoCode"

export function LocationPicker() {
  const [coords, setCoords] = useState({ lat: -6.496861119036644, lng: 110.90468997753888 })
  const [address, setAddress] = useState<string>("")
  const [loadingAddress, setLoadingAddress] = useState(false)
  const { result: gpsResult, loading: loadingGps, locate } = useGeolocation()

  // Terjemahkan koordinat hasil klik peta menjadi teks alamat
  const lookupAddress = useCallback(async (lat: number, lng: number) => {
    setLoadingAddress(true)
    try {
      const result = await reverseGeocode(lat, lng)
      setAddress(result.displayName)
    } catch {
      setAddress("Alamat tidak ditemukan")
    } finally {
      setLoadingAddress(false)
    }
  }, [])

  // Simpan titik hasil klik peta lalu cari alamatnya
  const handleMapPick = useCallback(
    (next: { lat: number; lng: number }) => {
      setCoords(next)
      lookupAddress(next.lat, next.lng)
    },
    [lookupAddress],
  )

  // Saat koordinat GPS tersedia, tandai peta & cari alamatnya
  useEffect(() => {
    if (!gpsResult) return
    // penundaan di microtask agar update state tidak sinkron saat render effect
    queueMicrotask(() => handleMapPick({ lat: gpsResult.lat, lng: gpsResult.lng }))
  }, [gpsResult, handleMapPick])

  // Minta koordinat dari GPS perangkat pengguna
  function handleUseMyLocation() {
    locate()
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

      {/* Hasil reverse-geocoding dari titik yang dipilih */}
      <p className="text-xs text-gray-500">
        {loadingAddress ? "Mencari alamat..." : address || "Klik peta untuk memilih titik lokasi"}
      </p>
    </div>
  )
}