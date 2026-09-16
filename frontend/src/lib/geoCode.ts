// src/lib/geocode.ts
export interface GeocodeAddress {
  displayName: string
  road?: string
  city?: string
  postcode?: string
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeAddress> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
  const res = await fetch(url, {
    headers: { "Accept-Language": "id" }, // hasil dalam Bahasa Indonesia
  })
  if (!res.ok) throw new Error("Gagal mengambil alamat")
  const data = await res.json()
  return {
    displayName: data.display_name,
    road: data.address?.road,
    city: data.address?.city ?? data.address?.town ?? data.address?.village,
    postcode: data.address?.postcode,
  }
}

// Forward geocoding: alamat -> koordinat
interface GeocodeItem {
  lat: string
  lon: string
  display_name: string
}

export async function forwardGeocode(query: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Gagal mencari lokasi")
  const data = (await res.json()) as GeocodeItem[]
  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
  }))
}