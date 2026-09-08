import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, CalendarClock, Package, Shirt, ShoppingBag, Truck } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { orderApi, serviceApi } from "../../services/api"
import { formatRupiah, timeAgo } from "../../lib/utils"
import type { OrderListItem, Service } from "../../lib/types"
import { Button, Card, EmptyState, Spinner, StatusBadge } from "../../components/ui"

export default function CustomerDashboard() {
    const { user } = useAuth()
    const [orders, setOrders] = useState<OrderListItem[]>([])
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        Promise.all([orderApi.list({ perPage: 3 }), serviceApi.list()])
            .then(([orderRes, svcRes]) => {
                if (!mounted) return
                setOrders(orderRes.data)
                setServices(svcRes)
            })
            .catch(() => undefined)
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [])

    const activeOrders = orders.filter((o) => !["SELESAI", "DIBATALKAN"].includes(o.status))
    const firstName = user?.username?.split(" ")[0] ?? ""

    return (
        <div>
            {/* Greeting */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-red-700 px-8 py-10 text-white shadow-lg shadow-primary/20">
                <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm text-red-100">Halo,</p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                            {firstName} 👋
                        </h1>
                        <p className="mt-2 max-w-lg text-sm text-red-100">
                            {activeOrders.length > 0
                                ? `Anda memiliki ${activeOrders.length} pesanan yang sedang berjalan. Ikuti statusnya setiap saat.`
                                : "Pakaian kotor menumpuk? Yuk pesan laundry sekarang, tinggal click saja."}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link to="/layanan">
                            <Button className="bg-white! text-primary! hover:bg-red-50!">Pesan Laundry</Button>
                        </Link>
                        <Link to="/toko">
                            <Button variant="outline" className="border-white/60! text-white! hover:bg-white/10!">
                                Belanja Produk
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick stats */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { icon: Package, label: "Pesanan Aktif", value: activeOrders.length, to: "/riwayat" },
                    { icon: CalendarClock, label: "Total Pesanan", value: orders.length, to: "/riwayat" },
                    { icon: Shirt, label: "Layanan Tersedia", value: services.length, to: "/layanan" },
                    { icon: ShoppingBag, label: "Produk Shop", value: "Belanja", to: "/toko" },
                ].map((s) => (
                    <Link key={s.label} to={s.to}>
                        <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                                <s.icon className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-xs text-gray-500">{s.label}</p>
                                <p className="text-lg font-bold text-ink-strong">{s.value}</p>
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {/* Recent orders */}
                <Card className="lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                        <h2 className="font-bold text-ink-strong">Pesanan Terbaru</h2>
                        <Link to="/riwayat" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            Kelola Semua <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Spinner />
                        </div>
                    ) : orders.length === 0 ? (
                        <EmptyState message="Belum ada pesanan. Yuk mulai cuci sekarang!" />
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {orders.map((o) => (
                                <li key={o.id}>
                                    <Link to={`/riwayat/${o.order_id}`} className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface">
                                        <div className="grid gap-0.5">
                                            <p className="font-semibold text-ink-strong">{o.order_id}</p>
                                            <p className="text-sm text-gray-500">
                                                {o.items_summary} &middot; {timeAgo(o.created_at)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-bold text-ink-strong">{formatRupiah(o.total_amount)}</p>
                                                <StatusBadge status={o.status} />
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-gray-300" />
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                {/* Promo / CTA */}
                <Card className="bg-gradient-to-br from-red-50 to-white p-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Keuntungan Member</p>
                    <h3 className="mt-2 text-lg font-extrabold text-ink-strong">Hemat 15% untuk Member Premium</h3>
                    <p className="mt-2 text-sm text-gray-500">
                        Nikmati diskon premium member pada setiap transaksi laundry di Fadarosi.
                    </p>
                    <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                            <Truck className="h-4 w-4" />
                        </span>
                        <p className="text-xs text-gray-600">Jemput-antar gratis untuk area dalam radius 5 km.</p>
                    </div>
                </Card>
            </div>
        </div>
    )
}