import { useEffect, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import type { Service } from "../../lib/types"
import { serviceApi } from "../../services/api"

interface ServiceRow {
  id: number
  name: string
  unit: string
  pricePerUnit: number
  description: string
  etaHours: number
  is_active: boolean
}

export function AdminServiceManagementPage() {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("Kg")
  const [price, setPrice] = useState("")
  const [eta, setEta] = useState("")
  const [loading, setLoading] = useState(false)

  const load = () =>
    serviceApi
      .list()
      .then((list) =>
        setServices(
          list.map((s: Service) => ({
            id: s.id,
            name: s.name,
            unit: s.unit,
            pricePerUnit: s.price_per_unit,
            description: s.description,
            etaHours: s.estimated_duration_hours,
            is_active: s.is_active,
          })),
        ),
      )
      .catch(() => undefined)

  useEffect(() => {
    load()
  }, [])

  function handleRemove(id: number) {
    serviceApi
      .remove(id)
      .then(load)
      .catch(() => undefined)
  }

  function handleReset() {
    setName("")
    setUnit("Kg")
    setPrice("")
    setEta("")
  }

  async function handleSubmit() {
    if (!name.trim() || !price) return
    setLoading(true)
    try {
      await serviceApi.create({
        name: name.trim(),
        unit: unit || "Kg",
        price_per_unit: Number(price),
        description: `${name.trim()} — unit ${unit || "Kg"}`,
        estimated_duration_hours: eta ? Number(eta) : 24,
        is_active: true,
      })
      handleReset()
      await load()
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Manajemen Layanan</h1>
        <p className="mb-5 text-sm text-gray-500">Kelola Layanan</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <div key={service.id} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <p className="text-base font-semibold text-ink-strong">{service.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemove(service.id)}
                    className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:text-primary"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:text-primary">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">{service.description}</p>
              <p className="mt-2 text-sm text-gray-500">
                {service.pricePerUnit.toLocaleString("id-ID")} per 1 unit ( {service.unit} )
              </p>
              <p className="text-sm text-gray-500">estimasi selesai {service.etaHours} jam</p>
            </div>
          ))}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-ink-strong">Tambah Layanan Baru</h2>

        <label className="mb-1 block text-xs font-medium text-gray-500">Nama Layanan</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masukkan nama Layanan..."
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Unit</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Kg"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Harga Per unit (RP)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              type="number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-gray-500">Estimasi selesai (Jam)</label>
        <input
          value={eta}
          onChange={(e) => setEta(e.target.value)}
          placeholder="12"
          type="number"
          className="mb-6 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !price}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Simpan Layanan"}
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            Batal
          </button>
        </div>
      </aside>
    </div>
  )
}