import { useCallback, useEffect, useState } from "react"
import { Edit, House, LocateFixed, Trash } from "lucide-react"
import { FloatingInput } from "../../../components/FloatingInput"
import { MapClickPicker } from "../../../components/mapClickPicker"
import { reverseGeocode } from "../../../lib/geoCode"
import { useGeolocation } from "../../../lib/useGeoLocation"
import { addressApi } from "../../../services/api"
import type { Address } from "../../../lib/types"
import type { CustomerAddress } from "./types"

// Posisi awal peta ketika form alamat masih kosong
const DEFAULT_CENTER = { lat: -6.496861119036644, lng: 110.90468997753888 }

interface AddressForm {
  label: string
  detail: string
  lat: number
  lng: number
}

// Buat nilai form alamat kosong (dipakai saat batal/tambah baru)
const emptyForm = (): AddressForm => ({
  label: "",
  detail: "",
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng,
})

// Konversi alamat dari backend menjadi bentuk kartu alamat pada UI
const toCustomerAddress = (addr: Address): CustomerAddress => ({
  id: addr.id,
  label: addr.label,
  isPrimary: addr.is_primary,
  fullAddress: addr.address_text,
  latitude: addr.latitude,
  longitude: addr.longitude,
})

// Validasi sederhana sebelum alamat dikirim ke backend
const validateForm = (form: AddressForm): string | null => {
  if (!form.label.trim()) return "Label lokasi wajib diisi"
  if (form.detail.trim().length < 5) return "Detail lokasi minimal 5 karakter"
  return null
}

// Bagian pengelolaan alamat: daftar alamat + form tambah/edit dengan peta
export const AddressSection = () => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [form, setForm] = useState<AddressForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingAddress, setLoadingAddress] = useState(false)
  const { result: gpsResult, loading: loadingGps, locate } = useGeolocation()

  // Muat daftar alamat milik pengguna dari backend
  const loadAddresses = useCallback(async () => {
    try {
      const list = await addressApi.list()
      setAddresses(list.map(toCustomerAddress))
    } catch {
      setAddresses([])
    }
  }, [])

  // Terjemahkan koordinat menjadi teks alamat via reverse geocode
  const lookupAddress = useCallback(async (lat: number, lng: number) => {
    setLoadingAddress(true)
    try {
      const result = await reverseGeocode(lat, lng)
      setForm((prev) => ({ ...prev, detail: result.displayName }))
    } catch {
      setForm((prev) => ({ ...prev, detail: "Alamat tidak ditemukan" }))
    } finally {
      setLoadingAddress(false)
    }
  }, [])

  // Muat daftar alamat milik pengguna dari backend saat halaman dibuka
  useEffect(() => {
    let mounted = true
    addressApi
      .list()
      .then((list) => {
        if (mounted) setAddresses(list.map(toCustomerAddress))
      })
      .catch(() => {
        if (mounted) setAddresses([])
      })
    return () => {
      mounted = false
    }
  }, [])

  // Perbarui titik peta & alamat ketika koordinat GPS sudah diterima
  useEffect(() => {
    if (!gpsResult) return
    const { lat, lng } = gpsResult
    // penundaan di microtask agar update state tidak sinkron saat render effect
    queueMicrotask(() => {
      setForm((prev) => ({ ...prev, lat, lng }))
      lookupAddress(lat, lng)
    })
  }, [gpsResult, lookupAddress])

  // Gestur ketika pengguna mengklik peta: simpan koordinat lalu cari alamat
  const handleMapPick = useCallback(
    (coords: { lat: number; lng: number }) => {
      setForm((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }))
      lookupAddress(coords.lat, coords.lng)
    },
    [lookupAddress],
  )

  // Minta koordinat dari GPS perangkat pengguna
  const handleUseMyLocation = () => {
    locate()
  }

  // Isi form dengan data alamat yang akan diedit
  const handleEdit = (addr: CustomerAddress) => {
    setEditingId(addr.id)
    setError(null)
    setForm({
      label: addr.label,
      detail: addr.fullAddress,
      lat: addr.latitude,
      lng: addr.longitude,
    })
  }

  // Batalkan mode edit dan kosongkan form
  const handleCancelEdit = () => {
    setEditingId(null)
    setError(null)
    setForm(emptyForm())
  }

  // Simpan alamat baru (create) atau perbarui alamat yang sedang diedit
  const handleSave = async () => {
    const invalid = validateForm(form)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    const payload = {
      label: form.label.trim(),
      address_text: form.detail.trim(),
      latitude: form.lat,
      longitude: form.lng,
    }
    try {
      if (editingId === null) {
        await addressApi.create(payload)
      } else {
        await addressApi.update(editingId, payload)
      }
      setForm(emptyForm())
      setEditingId(null)
      await loadAddresses()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan alamat")
    }
  }

  // Hapus alamat setelah dikonfirmasi pengguna
  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Hapus alamat ini?")
    if (!confirmed) return
    try {
      await addressApi.remove(id)
      setAddresses((prev) => prev.filter((addr) => addr.id !== id))
      if (editingId === id) {
        setEditingId(null)
        setForm(emptyForm())
      }
    } catch {
      setError("Gagal menghapus alamat")
    }
  }

  return (
    <>
      <div className="mt-20 mb-10">
        <p className="text-lg text-primary font-semibold">Lokais</p>
        <h1 className="text-2xl font-bold text-ink-strong">Alamat &amp; Titik penjemputan</h1>
        <p className="text-sm text-gray-500">Atur lokasi rumah dan kantor untuk penjemputan laundry.</p>
      </div>

      <div className="rounded-2xl" id="alamat">
        <div className="mt-4 space-y-3 grid grid-cols-2 gap-5">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="rounded-xl bg-white border-t-4 border-r-4 p-4 border-r-primary border-t-primary col-span-1"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-gray-200 rounded-xl w-9 h-9 flex items-center justify-center ">
                    <House size={20} className="text-primary" />
                  </span>
                  <p className="text-sm font-semibold text-ink-strong">{addr.label}</p>
                </div>
                <span className="flex gap-4">
                  <span className="w-9 h-9 bg-gray-200 text-ink rounded-lg p-2 cursor-pointer" onClick={() => handleDelete(addr.id)}>
                    <Trash></Trash>
                  </span>
                  <span className="w-9 h-9 bg-gray-200 text-ink rounded-lg p-2 cursor-pointer" onClick={() => handleEdit(addr)}>
                    <Edit></Edit>
                  </span>
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{addr.fullAddress}</p>
              <span className="w-full h-2 bg-gray-200"></span>

            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white" id="alamat">
        <div className="mt-4 space-y-3">
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">
                {editingId === null ? "Atur Lokasi" : `Edit Alamat: ${addresses.find((a) => a.id === editingId)?.label ?? ""}`}
              </h2>
              <button
                onClick={handleUseMyLocation}
                disabled={loadingGps}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gray-50"
              >
                <LocateFixed size={14} />
                {loadingGps ? "Mencari..." : "Gunakan Lokasi Saya"}
              </button>
            </div>

            <div>
              <MapClickPicker key={`${form.lat}-${form.lng}`} defaultCenter={{ lat: form.lat, lng: form.lng }} onChange={handleMapPick} />
              <div className="grid grid-cols-2 gap-5 mt-10">
                <FloatingInput
                className="col-span-1"
                  label="Label Lokasi"
                  value={form.label}
                  onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                />
                <FloatingInput className="col-span-1" label="koordinat" value={`${form.lat.toFixed(6)} ${form.lng.toFixed(6)}`} readOnly />
                <FloatingInput className="col-span-1" label="latitude" value={form.lat.toFixed(6)} readOnly />
                <FloatingInput className="col-span-1" label="longitude" value={form.lng.toFixed(6)} readOnly />
                <div className="relative col-span-2">
                  <textarea
                    id="Detail"
                    placeholder=" "
                    className={`peer w-full col-span-2 rounded-lg border border-gray-200 bg-white px-3 pb-2 pt-4 text-sm font-medium text-ink-strong outline-none transition-colors focus:border-primary`}
                    onChange={(e) => setForm((prev) => ({ ...prev, detail: e.target.value }))} >
                    {form.detail}
                  </textarea>
                  <label
                    htmlFor={"Detail"}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 bg-white px-1 text-sm text-gray-400 transition-all duration-150 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-medium peer-focus:text-primary peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:-translate-y-1/2 peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:text-gray-500"
                  >
                    Detail Lokasi
                  </label>
                </div>
              </div>
              {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
              <div className="mt-3 flex items-end justify-end gap-3">
                {editingId !== null && (
                  <button
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-ink hover:bg-gray-50"
                  >
                    Batal
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={loadingAddress}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {editingId === null ? "Simpan Alamat" : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}