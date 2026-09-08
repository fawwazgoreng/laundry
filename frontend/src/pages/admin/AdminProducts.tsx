import { useCallback, useEffect, useMemo, useState } from "react"
import { Package, Pencil, Plus, Search, Trash2, Upload } from "lucide-react"
import { productApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah, PRODUCT_CATEGORIES } from "../../lib/utils"
import type { Product } from "../../lib/types"
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner, Textarea } from "../../components/ui"
import { cx } from "../../lib/utils"

export default function AdminProducts() {
    const [products, setProducts] = useState<Product[]>([])
    const [count, setCount] = useState(0)
    const [category, setCategory] = useState("all")
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [editing, setEditing] = useState<Product | null>(null)
    const [showModal, setShowModal] = useState(false)

    const perPage = 6

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const res = await productApi.list({ category, search, page, perPage })
            setProducts(res.data)
            setCount(res.meta?.count ?? 0)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memuat produk")
        } finally {
            setLoading(false)
        }
    }, [category, search, page])

    useEffect(() => {
        void Promise.resolve().then(load)
    }, [load])

    const totalPages = useMemo(() => Math.max(1, Math.ceil(count / perPage)), [count])

    const handleDelete = async (id: number) => {
        await productApi.remove(id)
        load()
    }

    return (
        <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="text-2xl font-bold text-ink-strong">Manajemen Produk</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Kelola produk pendukung laundry seperti detergen, pelembut, dan pewangi.
                    </p>
                </div>
                <Button onClick={() => { setEditing(null); setShowModal(true) }}>
                    <Plus className="h-4 w-4" /> Tambah Produk Baru
                </Button>
            </div>

            {/* Controls */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        className="pl-10"
                        placeholder="Cari nama produk"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    />
                </div>
                <div className="w-full sm:w-56">
                    <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
                        <option value="all">Semua Kategori</option>
                        {PRODUCT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </Select>
                </div>
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            {loading ? (
                <div className="flex justify-center py-16">
                    <Spinner />
                </div>
            ) : products.length === 0 ? (
                <Card className="mt-6">
                    <EmptyState message="Tidak ada produk ditemukan." />
                </Card>
            ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((p) => (
                        <Card key={p.id} className="overflow-hidden">
                            <div className="relative flex h-32 items-center justify-center bg-surface">
                                {p.image ? (
                                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                    <Package className="h-12 w-12 text-gray-300" />
                                )}
                                <Badge className="absolute left-3 top-3" color="red" children={p.category} />
                            </div>
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-ink-strong">{p.name}</p>
                                        <p className="text-xs text-gray-400">Kemasan {p.size}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditing(p); setShowModal(true) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface hover:text-primary">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <p className="text-lg font-extrabold text-primary">{formatRupiah(p.price)}</p>
                                    <span className={cx("rounded-full px-3 py-1 text-[11px] font-bold", p.stock <= 0 ? "bg-red-100 text-red-600" : p.stock < 10 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700")}>
                                        Stok: {p.stock}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-gray-400">Menampilkan {products.length} dari {count} produk</p>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
                    <span className="flex items-center text-sm text-gray-600">Halaman {page} / {totalPages}</span>
                    <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
                </div>
            </div>

            {showModal && (
                <ProductModal
                    product={editing}
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

function ProductModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(product?.name ?? "")
    const [category, setCategory] = useState(product?.category ?? PRODUCT_CATEGORIES[0])
    const [price, setPrice] = useState(product ? String(product.price) : "")
    const [size, setSize] = useState(product?.size ?? "")
    const [stock, setStock] = useState(product ? String(product.stock) : "")
    const [description, setDescription] = useState("")
    const [isActive, setIsActive] = useState(product?.is_active ?? true)
    const [image, setImage] = useState(product?.image ?? "")
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState("")
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setError("")
        setSaving(true)
        try {
            const payload = {
                name,
                category,
                price: Number(price),
                size,
                stock: Number(stock),
                is_active: isActive,
            }
            if (product) await productApi.update(product.id, payload)
            else await productApi.create(payload)
            onSaved()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal menyimpan produk")
        } finally {
            setSaving(false)
        }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !product) return
        setUploading(true)
        setError("")
        try {
            const updated = await productApi.uploadImage(product.id, file)
            setImage(updated.image)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal mengunggah foto")
        } finally {
            setUploading(false)
            e.target.value = ""
        }
    }

    return (
        <Modal title={product ? "Edit Produk" : "Tambah Produk Baru"} onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Nama Produk</label>
                    <Input placeholder="mis. Detergen Fortune 800gr" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Kategori</label>
                        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                            {PRODUCT_CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Ukuran / Kemasan</label>
                        <Input placeholder="mis. 800gr" value={size} onChange={(e) => setSize(e.target.value)} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Harga (Rp)</label>
                        <Input type="number" min="0" placeholder="mis. 25000" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Stok</label>
                        <Input type="number" min="0" placeholder="mis. 50" value={stock} onChange={(e) => setStock(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Deskripsi Produk</label>
                    <Textarea rows={2} placeholder="Deskripsi singkat produk" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                {/* Image upload */}
                {product ? (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Foto Produk</label>
                        <div className="flex items-center gap-4">
                            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface">
                                {image ? <img src={image} alt={product.name} className="h-full w-full rounded-xl object-cover" /> : <Package className="h-8 w-8 text-gray-300" />}
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-ink-strong hover:bg-surface">
                                <Upload className="h-4 w-4" />
                                {uploading ? "Mengunggah..." : "Klik untuk Upload"}
                                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                            </label>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-400">Format JPG, PNG up to 2MB</p>
                    </div>
                ) : (
                    <p className="rounded-lg bg-surface px-3 py-2 text-[11px] text-gray-500">
                        Foto produk dapat diunggah setelah produk dibuat.
                    </p>
                )}

                <label className="flex items-center gap-2 text-sm font-medium text-ink-strong">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Produk aktif ditampilkan di toko
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