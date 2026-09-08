import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Minus, Package, Plus, Search, ShoppingBag } from "lucide-react"
import { useOrderDraft } from "../../context/OrderDraftContext"
import { productApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah, PRODUCT_CATEGORIES, SORT_OPTIONS } from "../../lib/utils"
import type { Product } from "../../lib/types"
import { Badge, Button, Card, EmptyState, Input, Pagination, Select, Spinner } from "../../components/ui"
import { cx } from "../../lib/utils"

export default function ProductShopPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [count, setCount] = useState(0)
    const [category, setCategory] = useState("all")
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState("terbaru")
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const perPage = 6
    const draft = useOrderDraft()

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const res = await productApi.list({ category, search, sort, page, perPage })
            setProducts(res.data)
            setCount(res.meta?.count ?? 0)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memuat produk")
        } finally {
            setLoading(false)
        }
    }, [category, search, sort, page])

    useEffect(() => {
        void Promise.resolve().then(load)
    }, [load])

    const totalPages = useMemo(() => Math.max(1, Math.ceil(count / perPage)), [count])

    const qtyOf = (id: number) => draft.products.find((p) => p.product.id === id)?.qty ?? 0

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="text-2xl font-bold text-ink-strong">Toko Fadarosi</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Lengkapi kebutuhan laundry Anda dengan detergen, softener, dan pewangi pilihan.
                    </p>
                </div>
                <Link to="/layanan">
                    <Button variant="outline">
                        <ShoppingBag className="h-4 w-4" /> Keranjang ({draft.totalItems})
                    </Button>
                </Link>
            </div>

            {/* Controls */}
            <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        className="pl-10"
                        placeholder="Cari detergen, pelembut, pewangi"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1)
                        }}
                    />
                </div>
                <div className="w-full lg:w-56">
                    <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }}>
                        {SORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>Sortir: {o.label}</option>
                        ))}
                    </Select>
                </div>
            </div>

            {/* Category pills */}
            <div className="mt-5 flex flex-wrap gap-2">
                {["all", ...PRODUCT_CATEGORIES].map((c) => (
                    <button
                        key={c}
                        onClick={() => { setCategory(c); setPage(1) }}
                        className={cx(
                            "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                            category === c ? "bg-primary text-white shadow-sm" : "bg-white text-gray-600 hover:bg-gray-100",
                        )}
                    >
                        {c === "all" ? "Semua" : c}
                    </button>
                ))}
            </div>

            {/* Grid */}
            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Spinner size="lg" />
                </div>
            ) : products.length === 0 ? (
                <Card className="mt-6">
                    <EmptyState message="Tidak ada produk yang cocok dengan pencarian Anda." />
                </Card>
            ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((p) => {
                        const qty = qtyOf(p.id)
                        return (
                            <Card key={p.id} className="overflow-hidden">
                                <div className="relative flex h-40 items-center justify-center bg-surface">
                                    {p.image ? (
                                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <Package className="h-14 w-14 text-gray-300" />
                                    )}
                                    <Badge color="red" children={p.category} />
                                    {p.stock === 0 && (
                                        <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                            Habis
                                        </span>
                                    )}
                                </div>
                                <div className="p-5">
                                    <p className="text-sm font-semibold text-ink-strong">{p.name}</p>
                                    <p className="mt-0.5 text-xs text-gray-400">Kemasan {p.size}</p>
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-lg font-extrabold text-primary">{formatRupiah(p.price)}</p>
                                        <p className="text-xs text-gray-400">
                                            {p.stock > 0 ? `Stok: ${p.stock}` : "Stok habis"}
                                        </p>
                                    </div>
                                    {qty > 0 ? (
                                        <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary-light py-1.5 pl-4 pr-1.5">
                                            <span className="text-sm font-semibold text-primary">{qty} dalam pesanan</span>
                                            <div className="flex items-center gap-1">
                                                <button className="rounded-md bg-white p-1.5 shadow-sm" onClick={() => draft.updateProductQty(p.id, Math.max(0, qty - 1))}>
                                                    <Minus className="h-4 w-4 text-gray-600" />
                                                </button>
                                                <button className="rounded-md bg-primary p-1.5 text-white shadow-sm" onClick={() => draft.addProduct(p)}>
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button className="mt-4 w-full" disabled={p.stock === 0} onClick={() => draft.addProduct(p)}>
                                            Tambah Ke Order
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Pagination page={page} totalPages={totalPages} count={count} onChange={setPage} />
        </div>
    )
}