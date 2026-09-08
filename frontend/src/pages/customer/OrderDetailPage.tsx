import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Calendar, FileText, MapPin, Package, Truck, User } from "lucide-react"
import { orderApi, paymentApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah, ORDER_STATUSES, PAYMENT_METHOD_LABELS } from "../../lib/utils"
import type { OrderDetail, Payment } from "../../lib/types"
import { Button, Card, Spinner, StatusBadge } from "../../components/ui"
import { cx } from "../../lib/utils"

export default function OrderDetailPage() {
    const { orderId } = useParams<{ orderId: string }>()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [payment, setPayment] = useState<Payment | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        let mounted = true
        if (!orderId) return
        Promise.all([orderApi.get(orderId), paymentApi.byOrder(orderId)])
            .then(([o, p]) => {
                if (!mounted) return
                setOrder(o)
                setPayment(p)
            })
            .catch((err) => {
                if (mounted) setError(err instanceof ApiError ? err.message : "Gagal memuat detail pesanan")
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [orderId])

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
                <Link to="/riwayat">
                    <Button className="mt-4">Kembali ke Riwayat</Button>
                </Link>
            </Card>
        )
    }

    const statusIndex = ORDER_STATUSES.findIndex((s) => s.value === order.status)
    const isCancelled = order.status === "DIBATALKAN"
    const hasPickup = order.pickup_schedule && order.pickup_schedule !== ""

    const info: Array<{ key: string; value: string; icon: typeof User }> = [
        { key: "No. Pesanan", value: order.order_id, icon: FileText },
        { key: "Nama", value: `${order.customer.username}`, icon: User },
        { key: "Nomor Telepon", value: order.customer.phone, icon: User },
        { key: "Outlet", value: order.outlet?.name ?? "-", icon: MapPin },
    ]

    const jadwal: Array<{ key: string; value: string; icon: typeof Calendar }> = [
        { key: "Tanggal Pesanan", value: new Date(order.created_at).toLocaleString("id-ID"), icon: Calendar },
        { key: "Pengambilan", value: hasPickup ? new Date(order.pickup_schedule!).toLocaleString("id-ID") : "-", icon: Truck },
        { key: "Estimasi Pengantaran", value: order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleString("id-ID") : "-", icon: Truck },
    ]

    const paymentStatus = payment?.status ?? "PENDING"

    return (
        <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-ink-strong">Detail Pesanan</h1>
                    <p className="mt-1 text-sm text-gray-500">{order.order_id}</p>
                </div>
                <StatusBadge status={order.status} size="lg" />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-5">
                {/* Left column */}
                <div className="space-y-6 lg:col-span-3">
                    {/* Timeline */}
                    <Card className="p-6">
                        <h2 className="font-bold text-ink-strong">Progres Pengerjaan</h2>
                        <div className="mt-6 flex items-start justify-between gap-1">
                            {ORDER_STATUSES.map((s, i) => {
                                const done = i < statusIndex
                                const active = i === statusIndex
                                const cancelledHere = isCancelled && i === statusIndex
                                return (
                                    <div key={s.value} className="flex flex-1 flex-col items-center text-center">
                                        <div className="flex w-full items-center">
                                            <div className={cx("h-1 flex-1 rounded", i === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-gray-200")} />
                                            <div
                                                className={cx(
                                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                                                    cancelledHere ? "bg-red-600 text-white" : active ? "bg-primary text-white ring-4 ring-primary/20" : done ? "bg-primary text-white" : "bg-gray-200 text-gray-400",
                                                )}
                                            >
                                                {done ? "✓" : i + 1}
                                            </div>
                                            <div className={cx("h-1 flex-1 rounded", i === ORDER_STATUSES.length - 1 ? "bg-transparent" : active || done ? "bg-gray-200" : "bg-gray-200")} />
                                        </div>
                                        <p className={cx("mt-2 text-[11px] font-semibold leading-tight", active ? "text-primary" : done ? "text-ink-strong" : "text-gray-400")}>
                                            {s.label}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                        {isCancelled && (
                            <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-xs text-red-600">
                                Pesanan ini telah dibatalkan. Dikutip ulang bila diperlukan pembayaran refund dari sisi kami.
                            </p>
                        )}
                    </Card>

                    {/* Service items */}
                    <Card className="p-6">
                        <h2 className="font-bold text-ink-strong">Rincian Item</h2>
                        <div className="mt-4 space-y-3">
                            {order.services.map((s) => (
                                <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-surface/50 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <Package className="h-4 w-4 text-primary" />
                                        <div>
                                            <p className="text-sm font-semibold text-ink-strong">{s.service_name}</p>
                                            <p className="text-xs text-gray-400">
                                                {s.qty} {s.unit} &middot; {formatRupiah(s.price_per_unit)}/{s.unit}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-ink-strong">{formatRupiah(s.subtotal)}</p>
                                </div>
                            ))}
                            {order.products.map((p) => (
                                <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-surface/50 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <Package className="h-4 w-4 text-primary" />
                                        <div>
                                            <p className="text-sm font-semibold text-ink-strong">{p.product_name}</p>
                                            <p className="text-xs text-gray-400">{p.qty} pcs &middot; {formatRupiah(p.price)}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-ink-strong">{formatRupiah(p.subtotal)}</p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Order info */}
                    <Card className="p-6">
                        <h2 className="font-bold text-ink-strong">Info Pesanan</h2>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {info.map((i) => (
                                <div key={i.key} className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
                                        <i.icon className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <p className="text-[11px] text-gray-400">{i.key}</p>
                                        <p className="text-sm font-medium text-ink-strong">{i.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right column */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Payment status */}
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-ink-strong">Pembayaran</h3>
                            <span
                                className={cx(
                                    "rounded-full px-3 py-1 text-[11px] font-bold",
                                    paymentStatus === "PAID" ? "bg-green-100 text-green-700" : paymentStatus === "REFUNDED" ? "bg-amber-100 text-amber-700" : "bg-yellow-100 text-yellow-700",
                                )}
                            >
                                {paymentStatus === "PAID" ? "Lunas" : paymentStatus === "REFUNDED" ? "Dikembalikan" : "Menunggu"}
                            </span>
                        </div>
                        <p className="mt-3 text-sm text-gray-600">
                            Metode: <span className="font-medium text-ink-strong">{PAYMENT_METHOD_LABELS[order.payment_method]}</span>
                        </p>
                        {paymentStatus !== "PAID" && paymentStatus !== "REFUNDED" && paymentStatus !== "CANCELLED" && order.payment_method === "transfer_bank" && (
                            <Link to={`/payment/${order.order_id}`}>
                                <Button className="mt-4 w-full">Lanjutkan Pembayaran</Button>
                            </Link>
                        )}
                        {paymentStatus === "PAID" && payment?.transaction_id && order.payment_method === "transfer_bank" && (
                            <div className="mt-4 rounded-xl bg-surface p-4">
                                <p className="text-xs text-gray-500">Nomor Virtual Account</p>
                                <p className="mt-1 font-extrabold tracking-wider text-ink-strong">{payment.transaction_id}</p>
                            </div>
                        )}
                    </Card>

                    {/* Jadwal */}
                    <Card className="p-6">
                        <h3 className="font-bold text-ink-strong">Jadwal</h3>
                        <div className="mt-4 space-y-3">
                            {jadwal.map((j) => (
                                <div key={j.key} className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
                                        <j.icon className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <p className="text-[11px] text-gray-400">{j.key}</p>
                                        <p className="text-sm font-medium text-ink-strong">{j.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Price summary */}
                    <Card className="p-6">
                        <h3 className="font-bold text-ink-strong">Ringkasan Biaya</h3>
                        <div className="mt-4 space-y-2.5 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Total Harga ({order.services.length} Layanan)</span>
                                <span>{formatRupiah(order.total_laundry)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Produk</span>
                                <span>{formatRupiah(order.total_product)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Biaya Pengiriman</span>
                                <span>{formatRupiah(order.delivery_fee)}</span>
                            </div>
                            {order.discount_member > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Diskon Premium Member</span>
                                    <span>-{formatRupiah(order.discount_member)}</span>
                                </div>
                            )}
                            {order.discount_voucher > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Diskon Voucher Promo</span>
                                    <span>-{formatRupiah(order.discount_voucher)}</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4">
                            <span className="font-semibold text-ink-strong">Total Keseluruhan</span>
                            <span className="text-2xl font-extrabold text-primary">{formatRupiah(order.total_amount)}</span>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}