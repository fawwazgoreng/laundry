// src/lib/useGeolocation.ts
import { useState } from "react"

interface GeoResult {
  lat: number
  lng: number
  accuracy: number
}

export function useGeolocation() {
  const [result, setResult] = useState<GeoResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function locate() {
    if (!navigator.geolocation) {
      setError("Browser tidak mendukung Geolocation API")
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResult({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return { result, error, loading, locate }
}