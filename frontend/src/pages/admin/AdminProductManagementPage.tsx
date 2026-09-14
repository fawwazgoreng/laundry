import { useEffect, useMemo, useState } from "react"
import { Box, Search, UploadCloud } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { Product } from "../../lib/types"
import { productApi } from "../../services/api"

const categoryOptions = ["Semua", "Deterjen", "Pewangi", "Softener", "Parfum", "Lainnya"]

interface ProductCard {
  id: number
  name: string
  category: string
  price: number
  stock: number
  imageUrl: string | undefined
}

export function AdminProductManagementPage() {
  const [products, setProducts] = useState<ProductCard[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Semua")
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("")
  const [description, setDescription] = useState("")

  const load = () =>
    productApi
      .list({ perPage: 100 })
      .then((page) =>
        setProducts(
          page.data.map((p: Product) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock,
            imageUrl: p.image || undefined,
          })),
        ),
      )
      .catch(() => undefined)

  useEffect(() => {
    load()
  }, [])

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category))
    return ["Semua", ...set]
  }, [products])

  const filtered = useMemo(() => {
    let list = products
    if (category !== "Semua") list = list.filter((p) => p.category === category)
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    return list
  }, [products, category, search])

  function handleRemove(id: number) {
    productApi
      .remove(id)
      .then(load)
      .catch(() => undefined)
  }

  function handleReset() {
    setName("")
    setFormCategory("")
    setPrice("")
    setStock("")
    setDescription("")
  }

  async function handleSubmit() {
    if (!name.trim() || !formCategory || !price) return
    setLoading(true)
    try {
      await productApi.create({
        name: name.trim(),
        category: formCategory,
        price: Number(price),
        stock: stock ? Number(stock) : 0,
        size: "1 Pack",
        is_active: true,
      })
      handleReset()
      await load()
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full rounded-full border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary bg-primary-light text-primary">
              <Box size={16} />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((product) => (
            <div key={product.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="aspect-square w-full overflow-hidden bg-gray-100">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">Gambar</div>
                )}
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase text-primary">{product.category}</p>
                <p className="mt-1 text-sm font-semibold text-ink-strong">{product.name}</p>
                <p className="text-xs text-gray-400">Stok: {product.stock} Pcs</p>
                <p className="mt-1 text-base font-bold text-ink-strong">{formatIDR(product.price)}</p>
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-semibold text-ink hover:bg-gray-50">
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(product.id)}
                    className="flex-1 rounded-lg border border-primary py-2 text-xs font-semibold text-primary hover:bg-primary-light"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-gray-400">
              Tidak ada produk pada kategori ini.
            </p>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-ink-strong">Tambah Produk Baru</h2>

        <label className="mb-1 block text-xs font-medium text-gray-500">Nama Produk</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masukkan nama produk..."
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <label className="mb-1 block text-xs font-medium text-gray-500">Kategori</label>
        <select
          value={formCategory}
          onChange={(e) => setFormCategory(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">Pilih Kategori</option>
          {categoryOptions.filter((c) => c !== "Semua").map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Harga (Rp)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              type="number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Jumlah Stok</label>
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              type="number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-gray-500">Deskripsi Produk</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Jelaskan manfaat & info produk..."
          rows={3}
          className="mb-4 w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <label className="mb-1 block text-xs font-medium text-gray-500">Upload Foto Produk</label>
        <div className="mb-6 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-light/40 py-8 text-center">
          <UploadCloud size={22} className="text-primary" />
          <p className="text-sm font-semibold text-primary">Klik untuk Upload</p>
          <p className="text-xs text-gray-400">Format JPG, PNG up to 2MB</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !formCategory || !price}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Simpan Produk"}
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            Batal
          </button>
        </div>
      </aside>
    </div>
  )
}