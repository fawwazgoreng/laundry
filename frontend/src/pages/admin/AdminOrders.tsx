import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Search } from "lucide-react"
import { orderApi, serviceApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah, ORDER_STATUSES } from "../../lib/utils"
import type { OrderDetail, OrderListItem, OrderStatus, Service } from "../../lib/types"
import { Button, Card, EmptyState, Input, Modal, Pagination, Select, Spinner, StatusBadge } from "../../components/ui"

export default function AdminOrders() {
    const [orders, setOrders] = useState<OrderListItem[]>([])
    const [services, setServices] = useState<Service[]>([])
    const [count, setCount] = useState(0)
    const [search, setSearch] = useState("")
    const [status, setStatus] = useState("all")
    const [service, setService] = useState("")
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const [detail, setDetail] = useState<OrderDetail | null>(null)
    const [showStatusModal, setShowStatusModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    const perPage = 5

    useEffect(() => {
        serviceApi.list().then(setServices).catch(() => undefined)
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const res = await orderApi.list({
                ...(search ? { search } : {}),
                ...(status !== "all" ? { status } : {}),
                ...(service ? { service } : {}),
                page,
                perPage,
            })
            setOrders(res.data)
            setCount(res.meta?.count ?? 0)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memuat daftar pesanan")
        } finally {
            setLoading(false)
        }
    }, [search, status, service, page])

    useEffect(() => {
        void Promise.resolve().then(load)
    }, [load])

    const totalPages = useMemo(() => Math.max(1, Math.ceil(count / perPage)), [count])

    const openStatus = async (orderId: string) => {
        try {
            const o = await orderApi.get(orderId)
            setDetail(o)
            setShowStatusModal(true)
        } catch {
            // ignore
        }
    }

    const afterStatusChange = () => {
        setShowStatusModal(false)
        load()
    }

    const handleDelete = async () => {
        if (!detail) return
        await orderApi.remove(detail.order_id)
        setShowDeleteModal(false)
        setDetail(null)
        load()
    }

    const isTerminal = (o: OrderListItem) => o.status === "SELESAI" || o.status === "DIBATALKAN"

    return (
        <div>
            <h1 className="text-2xl font-bold text-ink-strong">Manajemen Pesanan</h1>
            <p className="mt-1 text-sm text-gray-500">
                Kelola seluruh pesanan masuk, ubah status, atau hapus pesanan yang tidak valid.
            </p>

            {/* Filters */}
            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_200px_220px]">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        className="pl-10"
                        placeholder="Cari no. pesanan / nama pelanggan"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    />
                </div>
                <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                    <option value="all">Semua Status</option>
                    {ORDER_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </Select>
                <Select value={service} onChange={(e) => { setService(e.target.value); setPage(1) }}>
                    <option value="">Semua Layanan</option>
                    {services.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                </Select>
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            {/* Table */}
            <Card className="mt-6 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Spinner />
                    </div>
                ) : orders.length === 0 ? (
                    <EmptyState message="Tidak ada pesanan yang cocok dengan filter." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-surface/60 text-xs uppercase tracking-wide text-gray-400">
                                    <th className="px-5 py-3 font-semibold">No. Order</th>
                                    <th className="px-5 py-3 font-semibold">Pelanggan</th>
                                    <th className="px-5 py-3 font-semibold">No HP</th>
                                    <th className="px-5 py-3 font-semibold">Isi Pesanan</th>
                                    <th className="px-5 py-3 font-semibold">Satuan</th>
                                    <th className="px-5 py-3 font-semibold">Status</th>
                                    <th className="px-5 py-3 text-right font-semibold">Total Harga</th>
                                    <th className="px-5 py-3 text-right font-semibold">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o) => (
                                    <tr key={o.order_id} className="border-t border-gray-100 transition-colors hover:bg-surface/50">
                                        <td className="px-5 py-3 font-bold text-ink-strong">{o.order_id}</td>
                                        <td className="px-5 py-3 text-gray-600">{o.customer_name}</td>
                                        <td className="px-5 py-3 text-gray-600">{o.customer_phone}</td>
                                        <td className="max-w-52 truncate px-5 py-3 text-gray-600">{o.items_summary}</td>
                                        <td className="px-5 py-3 text-gray-500">{o.items_unit}</td>
                                        <td className="px-5 py-3">
                                            <StatusBadge status={o.status} />
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold text-primary">{formatRupiah(o.total_amount)}</td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" disabled={isTerminal(o)} onClick={() => openStatus(o.order_id)}>
                                                    Ubah Status
                                                </Button>
                                                <Link to={`/admin/pesanan/${o.order_id}`}>
                                                    <Button size="sm" variant="ghost">Detail</Button>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Pagination page={page} totalPages={totalPages} count={count} onChange={setPage} />

            {/* Status modal */}
            {showStatusModal && detail && (
                <StatusModal order={detail} onClose={() => setShowStatusModal(false)} onSaved={afterStatusChange} onDelete={() => { setShowStatusModal(false); setShowDeleteModal(true) }} />
            )}

            {/* Delete confirm */}
            {showDeleteModal && detail && (
                <Modal title="Hapus Pesanan?" onClose={() => setShowDeleteModal(false)}>
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-sm text-gray-600">
                                Anda yakin ingin menghapus pesanan{" "}
                                <span className="font-bold text-ink-strong">{detail.order_id}</span>?
                                Aksi ini tidak dapat dibatalkan dan mencatat arus kas keluar bila sudah dibayar.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Batal</Button>
                        <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Ya, Hapus</Button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

function StatusModal({
    order,
    onClose,
    onSaved,
    onDelete,
}: {
    order: OrderDetail
    onClose: () => void
    onSaved: () => void
    onDelete: () => void
}) {
    const [status, setStatus] = useState<OrderStatus>(order.status)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const currentIndex = ORDER_STATUSES.findIndex((s) => s.value === order.status)
    const orderFlow = ORDER_STATUSES.filter((s) => s.value !== "DIBATALKAN")

    const handleSave = async () => {
        setError("")
        setSaving(true)
        try {
            await orderApi.updateStatus(order.order_id, status)
            onSaved()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal mengubah status")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={`Pesanan ${order.order_id}`} onClose={onClose}>
            <p className="text-sm font-semibold text-ink-strong">Ubah Status Pesanan</p>
            <p className="mt-1 text-xs text-gray-400">
                Status saat ini: <span className="font-semibold text-primary">{ORDER_STATUSES[currentIndex]?.label}</span> &middot; total{" "}
                <span className="font-semibold text-ink-strong">{formatRupiah(order.total_amount)}</span>
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
                {orderFlow.map((s) => (
                    <button
                        key={s.value}
                        onClick={() => setStatus(s.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                            status === s.value ? "bg-primary text-white shadow-sm" : "bg-surface text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
                <button
                    onClick={() => setStatus("DIBATALKAN")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        status === "DIBATALKAN" ? "bg-red-600 text-white shadow-sm" : "bg-red-50 text-red-600 hover:bg-red-100"
                    }`}
                >
                    Dibatalkan
                </button>
            </div>

            {status !== order.status && (
                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-gray-500">
                    Perubahan status dicatat sebagai riwayat pengerjaan dan membatalkan stok saat dibatalkan.
                </p>
            )}

            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                <button className="text-sm font-semibold text-red-600 hover:underline" onClick={onDelete}>
                    Hapus Pesanan
                </button>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={onClose}>Batal</Button>
                    <Button loading={saving} onClick={handleSave}>Simpan Status</Button>
                </div>
            </div>
        </Modal>
    )
}