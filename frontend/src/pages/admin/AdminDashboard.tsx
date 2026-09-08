import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Banknote, Package, Shirt, ShoppingCart } from "lucide-react"
import { adminApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah } from "../../lib/utils"
import type { AdminStats } from "../../lib/types"
import { Card, Spinner, StatusBadge } from "../../components/ui"

export default function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        let mounted = true
        adminApi
            .stats()
            .then((s) => {
                if (mounted) setStats(s)
            })
            .catch((err) => {
                if (mounted) setError(err instanceof ApiError ? err.message : "Gagal memuat ringkasan bisnis")
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Spinner size="lg" />
            </div>
        )
    }

    if (error || !stats) {
        return (
            <Card className="p-8 text-center">
                <p className="text-sm text-gray-500">{error ?? "Data tidak tersedia"}</p>
            </Card>
        )
    }

    const statCards = [
        { label: "Pesanan Hari Ini", value: stats.orders_today, icon: ShoppingCart },
        { label: "Pendapatan Hari Ini", value: formatRupiah(stats.revenue_today), icon: Banknote },
        { label: "Cucian Diproses", value: stats.laundry_in_progress, icon: Shirt },
        { label: "Produk Terjual", value: stats.products_sold, icon: Package },
    ]

    const maxWeek = Math.max(1, ...stats.weekly_revenue.map((w) => w.total))

    return (
        <div>
            <h1 className="text-2xl font-bold text-ink-strong">Ringkasan Bisnis Fadarosi</h1>
            <p className="mt-1 text-sm text-gray-500">
                Pantau performa operasional laundry Anda hari ini.
            </p>

            {/* Stat cards */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((s) => (
                    <Card key={s.label} className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                                <s.icon className="h-5 w-5" />
                            </span>
                        </div>
                        <p className="mt-4 text-2xl font-extrabold text-ink-strong">{s.value}</p>
                        <p className="mt-1 text-xs text-gray-500">{s.label}</p>
                    </Card>
                ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                {/* Recent orders */}
                <Card className="overflow-hidden lg:col-span-2">
                    <div className="flex items-center justify-between px-5 py-4">
                        <h2 className="font-bold text-ink-strong">Pesanan Terbaru</h2>
                        <Link to="/admin/pesanan" className="text-sm font-semibold text-primary hover:underline">
                            Lihat Semua
                        </Link>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-t border-gray-100 bg-surface/60 text-xs uppercase tracking-wide text-gray-400">
                                <th className="px-5 py-2.5 font-semibold">No. Order</th>
                                <th className="px-5 py-2.5 font-semibold">Pelanggan</th>
                                <th className="px-5 py-2.5 font-semibold">Status</th>
                                <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recent_orders.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                                        Belum ada pesanan hari ini.
                                    </td>
                                </tr>
                            ) : (
                                stats.recent_orders.map((o) => (
                                    <tr key={o.order_id} className="border-t border-gray-100">
                                        <td className="px-5 py-3 font-semibold text-ink-strong">{o.order_id}</td>
                                        <td className="px-5 py-3 text-gray-600">{o.customer_name}</td>
                                        <td className="px-5 py-3">
                                            <StatusBadge status={o.status as AdminStats["recent_orders"][number]["status"]} />
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold text-primary">
                                            {formatRupiah(o.total_amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>

                {/* Weekly revenue */}
                <Card className="p-6">
                    <h2 className="font-bold text-ink-strong">Pendapatan Mingguan</h2>
                    <div className="mt-6 flex h-40 items-end gap-2">
                        {stats.weekly_revenue.length === 0 ? (
                            <p className="w-full text-center text-sm text-gray-400">Belum ada data.</p>
                        ) : (
                            stats.weekly_revenue.map((w) => (
                                <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
                                    <p className="text-[9px] font-semibold text-gray-500">
                                        {formatRupiah(w.total).replace("Rp", "")}
                                    </p>
                                    <div
                                        className="w-full rounded-t-md bg-primary"
                                        style={{ height: `${Math.max(6, (w.total / maxWeek) * 100)}px` }}
                                    />
                                    <p className="text-[10px] text-gray-400">
                                        {new Date(w.date).toLocaleDateString("id-ID", { weekday: "short" })}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-400">Pendapatan 7 hari terakhir</p>
                    </div>
                </Card>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {/* Service revenue */}
                <Card className="p-6">
                    <h2 className="font-bold text-ink-strong">Pendapatan per Layanan</h2>
                    {stats.service_revenue.length === 0 ? (
                        <p className="mt-4 text-sm text-gray-400">Belum ada data.</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {stats.service_revenue.map((s) => (
                                <div key={s.service_name} className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-ink-strong">{s.service_name}</p>
                                        <p className="text-xs text-gray-400">{s.count} pesanan</p>
                                    </div>
                                    <p className="text-sm font-bold text-primary">{formatRupiah(s.total)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Low stock */}
                <Card className="p-6">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <h2 className="font-bold text-ink-strong">Stok Produk Menipis</h2>
                    </div>
                    {stats.low_stock_products.length === 0 ? (
                        <p className="mt-4 text-sm text-gray-400">Semua stok produk dalam kondisi aman.</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {stats.low_stock_products.map((p) => (
                                <div key={p.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                                    <p className="text-sm font-semibold text-ink-strong">{p.name}</p>
                                    <p className="text-sm font-bold text-amber-600">Stok: {p.stock}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}