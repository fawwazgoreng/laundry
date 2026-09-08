import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FileText, Search } from "lucide-react"
import { orderApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah, ORDER_STATUSES } from "../../lib/utils"
import type { OrderListItem } from "../../lib/types"
import { Button, Card, EmptyState, Input, Pagination, Select, Spinner, StatusBadge } from "../../components/ui"
import { cx } from "../../lib/utils"

const FILTER_OPTIONS = ["Semua", ...ORDER_STATUSES.map((s) => s.label)]

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<OrderListItem[]>([])
    const [count, setCount] = useState(0)
    const [filter, setFilter] = useState("Semua")
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const perPage = 5

    const statusValue = useMemo(() => {
        const match = ORDER_STATUSES.find((s) => s.label === filter)
        return match?.value ?? ""
    }, [filter])

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const res = await orderApi.mine({
                ...(statusValue ? { status: statusValue } : {}),
                ...(search ? { search } : {}),
                page,
                perPage,
            })
            setOrders(res.data)
            setCount(res.meta?.count ?? 0)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memuat riwayat pesanan")
        } finally {
            setLoading(false)
        }
    }, [statusValue, search, page])

    useEffect(() => {
        void Promise.resolve().then(load)
    }, [load])

    const totalPages = useMemo(() => Math.max(1, Math.ceil(count / perPage)), [count])

    return (
        <div>
            <h1 className="text-2xl font-bold text-ink-strong">Riwayat Pesanan</h1>
            <p className="mt-1 text-sm text-gray-500">Pantau status dan progres pengerjaan laundry Anda.</p>

            {/* Filters */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        className="pl-10"
                        placeholder="Cari no. pesanan (CLN-...)"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    />
                </div>
                <div className="w-full sm:w-56">
                    <Select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1) }}>
                        {FILTER_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </Select>
                </div>
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Spinner size="lg" />
                </div>
            ) : orders.length === 0 ? (
                <Card className="mt-6">
                    <EmptyState
                        message="Belum ada pesanan yang cocok."
                        action={
                            <Link to="/layanan">
                                <Button>Mulai Pesanan Laundry</Button>
                            </Link>
                        }
                    />
                </Card>
            ) : (
                <div className="mt-6 space-y-4">
                    {orders.map((o) => {
                        return (
                            <Link key={o.order_id} to={`/riwayat/${o.order_id}`}>
                                <Card className="flex flex-col gap-4 p-5 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                                            <FileText className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <p className="font-bold text-ink-strong">{o.order_id}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {o.items_summary || "Item order"}{o.items_unit ? ` · ${o.items_unit}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={cx("flex items-center justify-between gap-6 sm:justify-end sm:text-right")}>
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Status</p>
                                            <StatusBadge status={o.status} className="mt-1" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Total</p>
                                            <p className="mt-1 font-extrabold text-primary">{formatRupiah(o.total_amount)}</p>
                                        </div>
                                        <Button variant="secondary" size="sm">Detail</Button>
                                    </div>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            )}

            <Pagination page={page} totalPages={totalPages} count={count} onChange={setPage} />
        </div>
    )
}