import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Shirt, Trash2 } from "lucide-react"
import { serviceApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah } from "../../lib/utils"
import type { Service } from "../../lib/types"
import { Button, Card, EmptyState, Input, Modal, Select, Spinner, Textarea } from "../../components/ui"

const UNITS = ["kg", "pcs", "set", "pasang", "lembar", "pack"]

export default function AdminServices() {
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [editing, setEditing] = useState<Service | null>(null)
    const [showModal, setShowModal] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            setServices(await serviceApi.list())
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memuat layanan")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void Promise.resolve().then(load)
    }, [load])

    const handleDelete = async (id: number) => {
        await serviceApi.remove(id)
        load()
    }

    return (
        <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="text-2xl font-bold text-ink-strong">Manajemen Layanan</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Kelola jenis layanan laundry yang ditawarkan beserta harga per satuan.
                    </p>
                </div>
                <Button onClick={() => { setEditing(null); setShowModal(true) }}>
                    <Plus className="h-4 w-4" /> Tambah Layanan Baru
                </Button>
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            {loading ? (
                <div className="flex justify-center py-16">
                    <Spinner />
                </div>
            ) : services.length === 0 ? (
                <Card className="mt-6">
                    <EmptyState message="Belum ada layanan. Tambahkan layanan pertama Anda." />
                </Card>
            ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((s) => (
                        <Card key={s.id} className="p-5">
                            <div className="flex items-start justify-between">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                                    <Shirt className="h-5 w-5" />
                                </span>
                                <div className="flex gap-1">
                                    <button onClick={() => { setEditing(s); setShowModal(true) }} className="rounded-lg p-2 text-gray-400 hover:bg-surface hover:text-primary">
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDelete(s.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="mt-3 font-bold text-ink-strong">{s.name}</h3>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{s.description}</p>
                            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                                <p className="text-lg font-extrabold text-primary">
                                    {formatRupiah(s.price_per_unit)} <span className="text-xs font-medium text-gray-400">/ {s.unit}</span>
                                </p>
                                <p className="text-[11px] text-gray-400">{s.estimated_duration_hours} jam</p>
                            </div>
                            <div className="mt-3">
                                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                    {s.is_active ? "Aktif" : "Nonaktif"}
                                </span>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {showModal && (
                <ServiceModal
                    service={editing}
                    onClose={() => setShowModal(false)}
                    onSaved={() => {
                        setShowModal(false)
                        load()
                    }}
                />
            )}
        </div>
    )
}

function ServiceModal({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(service?.name ?? "")
    const [unit, setUnit] = useState(service?.unit ?? "kg")
    const [price, setPrice] = useState(service ? String(service.price_per_unit) : "")
    const [duration, setDuration] = useState(service ? String(service.estimated_duration_hours) : "6")
    const [description, setDescription] = useState(service?.description ?? "")
    const [isActive, setIsActive] = useState(service?.is_active ?? true)
    const [error, setError] = useState("")
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setError("")
        setSaving(true)
        const payload = {
            name,
            unit,
            price_per_unit: Number(price),
            estimated_duration_hours: Number(duration),
            description,
            is_active: isActive,
        }
        try {
            if (service) await serviceApi.update(service.id, payload)
            else await serviceApi.create(payload)
            onSaved()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal menyimpan layanan")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={service ? "Edit Layanan" : "Tambah Layanan Baru"} onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Nama Layanan</label>
                    <Input placeholder="mis. Cuci Kering Setrika" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Satuan</label>
                        <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                            {UNITS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Estimasi (jam)</label>
                        <Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Harga per {unit}</label>
                    <Input type="number" min="0" placeholder="mis. 10000" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Deskripsi</label>
                    <Textarea rows={3} placeholder="Deskripsi singkat layanan" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-ink-strong">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Layanan aktif ditampilkan di aplikasi
                </label>
                {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose}>Batal</Button>
                    <Button loading={saving} onClick={handleSave}>Simpan</Button>
                </div>
            </div>
        </Modal>
    )
}