import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { products, productCategories } from "../lib/mockData"
import { formatIDR } from "../lib/format"

export function ShopPage({ onAddToOrder }: { onAddToOrder?: (productId: number) => void }) {
  const [category, setCategory] = useState("Semua")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"terbaru" | "termurah" | "termahal">("terbaru")

  const filtered = useMemo(() => {
    let list = products.filter((p) => category === "Semua" || p.category === category)
    if (search.trim()) {
      list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    }
    if (sort === "termurah") list = [...list].sort((a, b) => a.price - b.price)
    if (sort === "termahal") list = [...list].sort((a, b) => b.price - a.price)
    return list
  }, [category, search, sort])

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 px-2 text-sm font-semibold text-ink-strong">Kategori Produk</h2>
        <nav className="flex flex-col gap-1">
          {productCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
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
          <div className="relative flex-1 sm:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari detergen, pelembut, pewangi..."
              className="w-full rounded-full border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-full border border-gray-200 px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="terbaru">Sortir: Terbaru</option>
            <option value="termurah">Sortir: Termurah</option>
            <option value="termahal">Sortir: Termahal</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <div key={product.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
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
                  onClick={() => onAddToOrder?.(product.id)}
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
