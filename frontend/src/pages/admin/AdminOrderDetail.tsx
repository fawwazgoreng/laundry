import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { orderApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah, ORDER_STATUSES, PAYMENT_METHOD_LABELS } from "../../lib/utils"
import type { OrderDetail, OrderStatus } from "../../lib/types"
import { Button, Card, Modal, Spinner, StatusBadge } from "../../components/ui"

export default function AdminOrderDetail() {
    const { orderId } = useParams<{ orderId: string }>()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [showStatus, setShowStatus] = useState(false)
    const [showDelete, setShowDelete] = useState(false)
    const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null)
    const [statusError, setStatusError] = useState("")
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            setOrder(await orderApi.get(orderId!))
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memuat pesanan")
        } finally {
            setLoading(false)
        }
    }, [orderId])

    useEffect(() => {
        void Promise.resolve().then(load)
    }, [load])

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Spinner size="lg" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <Card className="p-8 text-center">
                <p className="text-sm text-gray-500">{error ?? "Pesanan tidak ditemukan"}</p>
                <Link to="/admin/pesanan">
                    <Button className="mt-4">Kembali</Button>
                </Link>
            </Card>
        )
    }

    const isTerminal = order.status === "SELESAI" || order.status === "DIBATALKAN"

    const handleStatusSave = async () => {
        if (!savingStatus) return
        setStatusError("")
        setSaving(true)
        try {
            await orderApi.updateStatus(order.order_id, savingStatus)
            setShowStatus(false)
            setSavingStatus(null)
            await load()
        } catch (err) {
            setStatusError(err instanceof ApiError ? err.message : "Gagal mengubah status")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <Link to="/admin/pesanan" className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary">
                <ArrowLeft className="h-4 w-4" /> Kembali ke Pesanan
            </Link>

            <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-ink-strong">{order.order_id}</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {order.customer.username} &middot; {order.customer.phone}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={order.status} size="lg" />
                    <Button variant="outline" disabled={isTerminal} onClick={() => setShowStatus(true)}>
                        Ubah Status
                    </Button>
                    <Button variant="ghost" className="text-red-600" onClick={() => setShowDelete(true)}>
                        Hapus
                    </Button>
                </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-2">
                    <h2 className="font-bold text-ink-strong">Rincian Item</h2>
                    <div className="mt-4 space-y-3">
                        {order.services.map((s) => (
                            <div key={s.id} className="flex items-center justify-between border-b border-gray-100 pb-3 text-sm">
                                <div>
                                    <p className="font-semibold text-ink-strong">{s.service_name}</p>
                                    <p className="text-xs text-gray-400">
                                        {s.qty} {s.unit} &middot; {formatRupiah(s.price_per_unit)}/{s.unit}
                                        {s.notes ? ` &middot; catatan: ${s.notes}` : ""}
                                    </p>
                                </div>
                                <p className="font-bold text-ink-strong">{formatRupiah(s.subtotal)}</p>
                            </div>
                        ))}
                        {order.products.map((p) => (
                            <div key={p.id} className="flex items-center justify-between border-b border-gray-100 pb-3 text-sm">
                                <div>
                                    <p className="font-semibold text-ink-strong">{p.product_name}</p>
                                    <p className="text-xs text-gray-400">
                                        {p.qty} pcs &middot; {formatRupiah(p.price)}
                                    </p>
                                </div>
                                <p className="font-bold text-ink-strong">{formatRupiah(p.subtotal)}</p>
                            </div>
                        ))}
                    </div>

                    <h2 className="mt-6 font-bold text-ink-strong">Detail</h2>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-xl bg-surface/60 p-3">
                            <p className="text-[11px] text-gray-400">Pelanggan</p>
                            <p className="font-medium text-ink-strong">{order.customer.username} ({order.customer.phone})</p>
                        </div>
                        <div className="rounded-xl bg-surface/60 p-3">
                            <p className="text-[11px] text-gray-400">Outlet</p>
                            <p className="font-medium text-ink-strong">{order.outlet?.name ?? "-"}</p>
                        </div>
                        <div className="rounded-xl bg-surface/60 p-3">
                            <p className="text-[11px] text-gray-400">Alamat</p>
                            <p className="font-medium text-ink-strong">{order.address?.address_text ?? "-"}</p>
                        </div>
                        <div className="rounded-xl bg-surface/60 p-3">
                            <p className="text-[11px] text-gray-400">Metode Pembayaran</p>
                            <p className="font-medium text-ink-strong">{PAYMENT_METHOD_LABELS[order.payment_method]}</p>
                        </div>
                        <div className="rounded-xl bg-surface/60 p-3">
                            <p className="text-[11px] text-gray-400">Pengambilan</p>
                            <p className="font-medium text-ink-strong">
                                {order.pickup_schedule ? new Date(order.pickup_schedule).toLocaleString("id-ID") : "-"}
                            </p>
                        </div>
                        <div className="rounded-xl bg-surface/60 p-3">
                            <p className="text-[11px] text-gray-400">Estimasi Pengantaran</p>
                            <p className="font-medium text-ink-strong">
                                {order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleString("id-ID") : "-"}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="h-fit p-6">
                    <h2 className="font-bold text-ink-strong">Ringkasan Biaya</h2>
                    <div className="mt-4 space-y-2.5 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Total Layanan</span>
                            <span>{formatRupiah(order.total_laundry)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Total Produk</span>
                            <span>{formatRupiah(order.total_product)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Biaya Pengiriman</span>
                            <span>{formatRupiah(order.delivery_fee)}</span>
                        </div>
                        {order.discount_member > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Diskon Member</span>
                                <span>-{formatRupiah(order.discount_member)}</span>
                            </div>
                        )}
                        {order.discount_voucher > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Diskon Voucher</span>
                                <span>-{formatRupiah(order.discount_voucher)}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4">
                        <span className="font-semibold text-ink-strong">Total</span>
                        <span className="text-2xl font-extrabold text-primary">{formatRupiah(order.total_amount)}</span>
                    </div>
                    <p className="mt-4 text-xs text-gray-400">
                        Dibuat {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                </Card>
            </div>

            {/* Status modal */}
            {showStatus && (
                <Modal title={`Ubah Status ${order.order_id}`} onClose={() => setShowStatus(false)}>
                    <div className="flex flex-wrap gap-2">
                        {ORDER_STATUSES.filter((s) => s.value !== "DIBATALKAN").map((s) => (
                            <button
                                key={s.value}
                                onClick={() => setSavingStatus(s.value)}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                    savingStatus === s.value ? "bg-primary text-white shadow-sm" : "bg-surface text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                        {!isTerminal && (
                            <button
                                onClick={() => setSavingStatus("DIBATALKAN")}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                    savingStatus === "DIBATALKAN" ? "bg-red-600 text-white shadow-sm" : "bg-red-50 text-red-600 hover:bg-red-100"
                                }`}
                            >
                                Dibatalkan
                            </button>
                        )}
                    </div>
                    {statusError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{statusError}</p>}
                    <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                        <Button variant="secondary" onClick={() => setShowStatus(false)}>Batal</Button>
                        <Button loading={saving} onClick={handleStatusSave}>Simpan</Button>
                    </div>
                </Modal>
            )}

            {/* Delete confirm */}
            {showDelete && (
                <Modal title="Hapus Pesanan?" onClose={() => setShowDelete(false)}>
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                        </span>
                        <p className="text-sm text-gray-600">
                            Anda yakin ingin menghapus pesanan <span className="font-bold text-ink-strong">{order.order_id}</span>?
                        </p>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowDelete(false)}>Batal</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700"
                            onClick={async () => {
                                await orderApi.remove(order.order_id)
                                setShowDelete(false)
                            }}
                        >
                            Ya, Hapus
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    )
}