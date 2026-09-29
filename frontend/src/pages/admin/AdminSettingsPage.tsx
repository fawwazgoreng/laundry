import { useEffect, useState } from "react"
import type { Outlet } from "../../lib/types"
import { outletApi } from "../../services/api"
import { useToast } from "../../components/Toast"
import { useGeolocation } from "../../lib/useGeoLocation"
import { LocateFixed } from "lucide-react"
import { reverseGeocode } from "../../lib/geoCode"
import { MapClickPickerAdmin } from "../../components/mapClickPickerAdmin"

interface DayHours {
  day: string
  active: boolean
  range: string
}

type Coords = { lat: number; lng: number }

const FALLBACK_CENTER: Coords = { lat: -6.7559, lng: 111.0378 }

const defaultDays: DayHours[] = [
  { day: "Senin", active: true, range: "08:00 - 20:00" },
  { day: "Selasa", active: true, range: "08:00 - 20:00" },
  { day: "Rabu", active: true, range: "08:00 - 20:00" },
  { day: "Kamis", active: true, range: "08:00 - 20:00" },
  { day: "Jumat", active: true, range: "08:00 - 20:00" },
  { day: "Sabtu", active: true, range: "08:00 - 18:00" },
  { day: "Minggu", active: false, range: "Tutup" },
]

function parseWeeklyHours(raw: string | null): DayHours[] {
  if (!raw) return defaultDays
  const map = Object.fromEntries(
    raw.split(",").map((part) => {
      const [day, ...rest] = part.trim().split(":")
      return [day.trim(), rest.join(":").trim()]
    }),
  )
  return defaultDays.map((d) => ({
    day: d.day,
    active: !!map[d.day],
    range: map[d.day] || "Tutup",
  }))
}

function serializeWeeklyHours(hours: DayHours[]): string {
  return hours
    .filter((h) => h.active)
    .map((h) => `${h.day}: ${h.range}`)
    .join(", ")
}

export function AdminSettingsPage() {
  const { success: toastSuccess, error: toastError } = useToast()

  // FIX: hook dipanggil DI DALAM komponen, bukan di module scope
  const { loading: loadingGps, locate , result } = useGeolocation()

  const [outletId, setOutletId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [hours, setHours] = useState<DayHours[]>(defaultDays)
  const [radius, setRadius] = useState(5)

  const [coords, setCoords] = useState<Coords | null>(null)

  const [loadingOutlet, setLoadingOutlet] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    outletApi
      .getDefault()
      .then((o: Outlet) => {
        if (cancelled) return
        setOutletId(o.id)
        setName(o.name)
        setPhone(o.phone ?? "")
        setAddress(o.address_text ?? "")
        setHours(parseWeeklyHours(o.weekly_hours))
        setRadius(o.max_coverage_km)
        setCoords(
          o.latitude != null && o.longitude != null
            ? { lat: o.latitude, lng: o.longitude }
            : FALLBACK_CENTER,
        )
        console.log(o)
      })
      .catch(() => {
        if (cancelled) return
        setCoords(FALLBACK_CENTER)
        toastError("Gagal memuat data outlet")
      })
      .finally(() => {
        if (!cancelled) setLoadingOutlet(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  function toggleDay(idx: number) {
    setHours((prev) =>
      prev.map((h, i) =>
        i === idx ? { ...h, active: !h.active, range: h.active ? "Tutup" : h.range } : h,
      ),
    )
  }

  async function applyCoords(next: Coords, fillAddress = false) {
    setCoords(next)
    setMapError(null)

    if (!fillAddress) return
    try {
      const result = await reverseGeocode(next.lat, next.lng)
      if (result) setAddress(result.displayName)
    } catch {
      // Reverse geocode gagal bukan masalah fatal — koordinat tetap tersimpan.
    }
  }

  async function handleUseMyLocation() {
    try {
      locate()
      if (result == null) {
        setMapError("Izin lokasi ditolak. Pilih manual di peta.")
        return 
      }
      console.log(result)
      await applyCoords({ lat: result?.lat, lng: result?.lng }, true)
    } catch {
      setMapError("Izin lokasi ditolak. Pilih manual di peta.")
    }
  }

  async function handleSave() {
    if (!outletId || !coords) return
    setSaving(true)
    setSaved(false)
    try {
      await outletApi.update(outletId, {
        name,
        phone: phone || undefined,
        address_text: address || undefined,
        max_coverage_km: radius,
        weekly_hours: serializeWeeklyHours(hours),
        latitude: coords.lat,
        longitude: coords.lng,
      }).then(res => console.log(res))
      setSaved(true)
      toastSuccess("Pengaturan outlet berhasil disimpan")
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan outlet")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      {/* --- Profil Outlet --- */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-ink-strong">Profil Outlet Cleanora</h2>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nama Outlet</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">No. Telepon Outlet</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Alamat Operasional</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </section>

      {/* --- Jam Operasional --- */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-ink-strong">Jam Operasional Outlet</h2>
        <div className="divide-y divide-gray-100">
          {hours.map((h, idx) => (
            <div key={h.day} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleDay(idx)}
                  className={`h-4 w-4 rounded-sm ${h.active ? "bg-primary" : "border border-gray-300 bg-white"}`}
                  aria-label={`Aktifkan ${h.day}`}
                />
                <span className="text-sm font-medium text-ink-strong">{h.day}</span>
              </div>
              {h.active ? (
                <input
                  value={h.range}
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, range: e.target.value } : row)),
                    )
                  }
                  className="w-36 rounded-lg border border-gray-200 px-3 py-1.5 text-right text-sm outline-none focus:border-primary"
                />
              ) : (
                <span className="w-36 rounded-lg border border-gray-200 px-3 py-1.5 text-right text-sm text-gray-400">
                  Tutup
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* --- Radius & Titik Outlet --- */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-ink-strong">Radius &amp; Area Jangkauan Kurir</h2>

        <div className="mb-5 flex items-center gap-4">
          <span className="w-24 shrink-0 text-sm font-medium text-ink-strong">Radius Antar</span>
          <input
            type="range"
            min={1}
            max={15}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary"
          />
          <span className="w-16 shrink-0 text-right text-sm font-bold text-primary">
            {radius.toFixed(1)} Km
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-gray-500">Klik di peta untuk memindahkan titik outlet.</p>
          <button
            onClick={handleUseMyLocation}
            disabled={loadingGps}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gray-50 disabled:opacity-50"
          >
            <LocateFixed size={14} />
            {loadingGps ? "Mencari..." : "Gunakan Lokasi Saya"}
          </button>
        </div>

        {loadingOutlet || !coords ? (
          <div className="flex h-64 items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400">
            Memuat peta...
          </div>
        ) : (
          <MapClickPickerAdmin
            value={coords}
            onChange={(next) => applyCoords(next)}
            radiusKm={radius}
            className="h-80 w-full overflow-hidden rounded-xl"
          />
        )}

        {mapError && <p className="mt-2 text-xs font-medium text-red-500">{mapError}</p>}

        <p className="mt-2 text-xs text-gray-400">
          Titik: {coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "-"}
        </p>
      </section>

      <div className="flex items-center justify-end gap-4">
        {saved && <span className="text-sm font-semibold text-emerald-600">Tersimpan!</span>}
        <button
          onClick={handleSave}
          disabled={saving || !outletId || !coords}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </div>
  )
}