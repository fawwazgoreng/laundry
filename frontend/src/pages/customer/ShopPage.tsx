import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { Product } from "../../lib/types"
import { productApi } from "../../services/api"
import { useOrderDraft } from "../../context/OrderDraftContext"
import { PRODUCT_CATEGORIES } from "../../lib/utils"

interface CardProduct {
  id: number
  name: string
  category: string
  price: number
  imageUrl: string
}

export function ShopPage({ onAddToOrder }: { onAddToOrder?: (productId: number) => void }) {
  const { addProduct } = useOrderDraft()
  const [products, setProducts] = useState<CardProduct[]>([])
  const [category, setCategory] = useState("Semua")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"terbaru" | "termurah" | "termahal">("terbaru")

  useEffect(() => {
    productApi
      .list({ perPage: 100 })
      .then((page) => {
        setProducts(
          page.data.map((p: Product) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            imageUrl: p.image || "/components/product-placeholder.png",
          })),
        )
      })
      .catch(() => undefined)
  }, [])

  const productCategories = useMemo(() => {
    const fromData = [...new Set(products.map((p) => p.category))].filter(Boolean)
    return Array.from(new Set([...PRODUCT_CATEGORIES, ...fromData]))
  }, [products])

  const filtered = useMemo(() => {
    let list = products.filter((p) => category === "Semua" || p.category === category)
    if (search.trim()) {
      list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    }
    if (sort === "termurah") list = [...list].sort((a, b) => a.price - b.price)
    if (sort === "termahal") list = [...list].sort((a, b) => b.price - a.price)
    return list
  }, [category, search, sort, products])

  function handleAdd(product: CardProduct) {
    const record: Product = {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      size: "",
      stock: 0,
      is_active: true,
      image: product.imageUrl,
    }
    addProduct(record)
    onAddToOrder?.(product.id)
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 px-2 text-sm font-semibold text-ink-strong">Kategori Produk</h2>
        <nav className="flex flex-col gap-1">
          {productCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer ${
                category === c
                  ? "bg-primary-light text-primary"
                  : "text-ink hover:bg-gray-50"
              }`}
            >
              {c}
            </button>
          ))}
        </nav>
      </aside>

      <div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md ">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari detergen, pelembut, pewangi..."
              className="w-full rounded-lg bg-white border border-gray-200 py-2.5 pl-9 pr-4 text-sm"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg bg-white px-4 py-2.5 text-sm text-ink cursor-pointer"
          >
            <option className="px-4 py-2.5 text-sm text-ink" value="terbaru">Sortir: Terbaru</option>
            <option className="px-4 py-2.5 text-sm text-ink" value="termurah">Sortir: Termurah</option>
            <option className="px-4 py-2.5 text-sm text-ink" value="termahal">Sortir: Termahal</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <div key={product.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="aspect-4/3 w-full overflow-hidden bg-gray-100">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase text-primary">{product.category}</p>
                <p className="mt-1 text-sm font-semibold text-ink-strong">{product.name}</p>
                <p className="mt-1 text-base font-bold text-ink-strong">{formatIDR(product.price)}</p>
                <button
                  onClick={() => handleAdd(product)}
                  className="mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  Tambah Ke Order
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-gray-400">
              Tidak ada produk yang cocok dengan pencarian Anda.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}