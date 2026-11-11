import { useEffect, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import type { Money, Service } from "../../lib/types"
import { formatIDR } from "../../lib/format"
import { toMoneyInput } from "../../lib/utils"
import { serviceApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { useToast } from "../../components/Toast"
import { ErrorState, LoadingState } from "../../components/ui"
import DeletePopup from "../../components/deletePopUp"

interface ServiceRow {
  id: number
  name: string
  unit: string
  pricePerUnit: Money
  description: string
  etaHours: number
  is_active: boolean
  addonGroups: Service["addon_groups"]
}

export function AdminServiceManagementPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [services, setServices] = useState<ServiceRow[]>([])

  // State form layanan (dipakai untuk Tambah maupun Edit)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("Kg")
  const [price, setPrice] = useState("")
  const [eta, setEta] = useState("")
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // State pop-up konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Muat ulang daftar layanan dari backend
  const load = () =>
    serviceApi
      .list()
      .then((list) => {
        setServices(
          list.map((s: Service) => ({
            id: s.id,
            name: s.name,
            unit: s.unit,
            pricePerUnit: s.price_per_unit,
            description: s.description,
            etaHours: s.estimated_duration_hours,
            is_active: s.is_active,
            addonGroups: s.addon_groups,
          })),
        )
        setListError(null)
      })
      .catch((err) => {
        setListError(err instanceof Error ? err.message : "Gagal memuat daftar layanan")
      })
      .finally(() => setListLoading(false))

  useEffect(() => {
    load()
  }, [])

  // Kosongkan seluruh form kembali ke kondisi awal
  function handleReset() {
    setEditingId(null)
    setName("")
    setUnit("Kg")
    setPrice("")
    setEta("")
  }

  // Isi form dengan data layanan yang akan diedit
  function handleEdit(service: ServiceRow) {
    setEditingId(service.id)
    setName(service.name)
    setUnit(service.unit)
    setPrice(service.pricePerUnit)
    setEta(String(service.etaHours))
  }

  // Simpan layanan (buat baru atau perbarui) lalu muat ulang daftar
  async function handleSubmit() {
    if (!name.trim() || !price) return
    setLoading(true)
    const description =
      services.find((s) => s.id === editingId)?.description ?? `${name.trim()} — unit ${unit || "Kg"}`
    try {
      const payload = {
        name: name.trim(),
        unit: unit || "Kg",
        price_per_unit: toMoneyInput(price),
        description,
        estimated_duration_hours: eta ? Number(eta) : 24,
        is_active: true,
      }
      if (editingId === null) {
        await serviceApi.create(payload)
        toastSuccess("[Layanan] berhasil ditambahkan.")
      } else {
        await serviceApi.update(editingId, payload)
        toastSuccess("[Layanan] berhasil diperbarui.")
      }
      handleReset()
      await load()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menyimpan layanan")
    } finally {
      setLoading(false)
    }
  }

  // Jalankan penghapusan layanan setelah dikonfirmasi lewat pop-up
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await serviceApi.remove(deleteTarget.id)
      toastSuccess("[Layanan] berhasil dihapus.")
      setDeleteTarget(null)
      if (editingId === deleteTarget.id) handleReset()
      await load()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menghapus layanan")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_360px] 2xl:max-w-[1600px] 2xl:grid-cols-[1fr_420px]">
      {/* Daftar layanan */}
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Manajemen Layanan</h1>
        <p className="mb-5 text-sm text-gray-500">Kelola Layanan</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {listLoading ? (
            <div className="col-span-full">
              <LoadingState message="Memuat layanan..." />
            </div>
          ) : listError ? (
            <div className="col-span-full">
              <ErrorState message={listError} onRetry={() => { setListLoading(true); load() }} />
            </div>
          ) : (
            services.map((service) => (
              <div key={service.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between">
                  <p className="text-base font-semibold text-ink-strong">{service.name}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteTarget(service)}
                      className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:text-primary"
                      aria-label={`Hapus ${service.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(service)}
                      className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:text-primary"
                      aria-label={`Edit ${service.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">{service.description}</p>
                <p className="mt-2 text-sm text-gray-500">
                  {formatIDR(service.pricePerUnit)} per 1 unit ( {service.unit} )
                </p>
                <p className="text-sm text-gray-500">estimasi selesai {service.etaHours} jam</p>
                {service.addonGroups.length > 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    Add-on: {service.addonGroups.map((group) => `${group.name} (${group.options.length})`).join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form Tambah / Edit layanan (kolom kanan yang tetap saat digulir di layar lebar) */}
      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6 lg:sticky lg:top-20">
        <h2 className="mb-4 text-base font-bold text-ink-strong">
          {editingId === null ? "Tambah Layanan Baru" : "Edit Layanan"}
        </h2>

        <label htmlFor="service-name" className="mb-1 block text-xs font-medium text-gray-500">Nama Layanan</label>
        <input
          id="service-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masukkan nama Layanan..."
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="service-unit" className="mb-1 block text-xs font-medium text-gray-500">Unit</label>
            <input
              id="service-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Kg"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="service-price" className="mb-1 block text-xs font-medium text-gray-500">Harga Per unit (RP)</label>
            <input
              id="service-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              type="number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <label htmlFor="service-eta" className="mb-1 block text-xs font-medium text-gray-500">Estimasi selesai (Jam)</label>
        <input
          id="service-eta"
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
            {loading ? "Menyimpan..." : editingId === null ? "Simpan Layanan" : "Simpan Perubahan"}
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            Batal
          </button>
        </div>
      </aside>

      {/* Pop-up konfirmasi penghapusan layanan */}
      <DeletePopup
        open={deleteTarget !== null}
        dataName={deleteTarget?.name}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}