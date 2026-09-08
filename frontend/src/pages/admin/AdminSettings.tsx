import { useEffect, useState } from "react"
import { Store } from "lucide-react"
import { outletApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import type { Outlet } from "../../lib/types"
import { Button, Card, Input, Spinner, Textarea } from "../../components/ui"

export default function AdminSettings() {
    const [outlet, setOutlet] = useState<Outlet | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [address, setAddress] = useState("")
    const [latitude, setLatitude] = useState("")
    const [longitude, setLongitude] = useState("")
    const [coverage, setCoverage] = useState("")
    const [minOrder, setMinOrder] = useState("")
    const [weeklyHours, setWeeklyHours] = useState("")

    useEffect(() => {
        let mounted = true
        outletApi
            .getDefault()
            .then((o) => {
                if (!mounted) return
                setOutlet(o)
                setName(o.name)
                setPhone(o.phone ?? "")
                setAddress(o.address_text ?? "")
                setLatitude(String(o.latitude))
                setLongitude(String(o.longitude))
                setCoverage(String(o.max_coverage_km))
                setMinOrder(String(o.min_order_amount))
                setWeeklyHours(o.weekly_hours ?? "")
            })
            .catch((err) => {
                if (mounted) setError(err instanceof ApiError ? err.message : "Gagal memuat pengaturan outlet")
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [])

    const handleSave = async () => {
        if (!outlet) return
        setError("")
        setSuccess("")
        setSaving(true)
        try {
            await outletApi.update(outlet.id, {
                name,
                phone,
                address_text: address,
                max_coverage_km: coverage ? Number(coverage) : undefined,
                min_order_amount: minOrder ? Number(minOrder) : undefined,
                weekly_hours: weeklyHours,
            })
            setSuccess("Pengaturan outlet berhasil disimpan")
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal menyimpan pengaturan")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-ink-strong">Pengaturan Outlet</h1>
            <p className="mt-1 text-sm text-gray-500">
                Atur informasi outlet utama Fadarosi yang tampil kepada pelanggan.
            </p>

            <Card className="mt-6 p-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                        <Store className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="font-bold text-ink-strong">{outlet?.name ?? "Outlet Fadarosi"}</h2>
                        <p className="text-xs text-gray-400">ID Outlet: #{outlet?.id}</p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Nama Outlet</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Nomor Telepon</label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="mis. 0812-3456-7890" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Alamat</label>
                        <Textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-ink-strong">Latitude</label>
                            <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-ink-strong">Longitude</label>
                            <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-ink-strong">Jangkauan (km)</label>
                            <Input type="number" min="0" value={coverage} onChange={(e) => setCoverage(e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-ink-strong">Min. Order (Rp)</label>
                            <Input type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Jam Operasional</label>
                        <Input placeholder="mis. Senin-Minggu 08.00-21.00" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} />
                    </div>
                </div>

                {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
                {success && <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p>}

                <div className="mt-6 flex justify-end">
                    <Button loading={saving} onClick={handleSave}>Simpan Pengaturan</Button>
                </div>
            </Card>
        </div>
    )
}