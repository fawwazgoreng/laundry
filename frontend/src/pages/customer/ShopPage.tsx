import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { Money, Product, ServiceAddonGroup, ServiceAddonOption } from "../../lib/types"
import { moneyToNumber } from "../../lib/utils"
import { isPerOrderAddon, perOrderAddonKey } from "../../lib/serviceAddons"
import { productApi } from "../../services/api"
import { useOrderDraft } from "../../context/OrderDraftContext"
import { PRODUCT_CATEGORIES } from "../../lib/utils"
import { ErrorState, LoadingState } from "../../components/ui"
import { useNavigate } from "react-router-dom"
import { useToast } from "../../components/Toast"

interface CardProduct {
  id: number
  name: string
  category: string
  price: Money
  size: string
  imageUrl: string
  stock: number
  addonGroups: ServiceAddonGroup[]
}

export function ShopPage({ onAddToOrder }: { onAddToOrder?: (productId: number) => void }) {
  const navigate = useNavigate()
  const { addProduct, services: draftServices, products: draftProducts } = useOrderDraft()
  const { success: toastSuccess, error: toastError } = useToast()
  const [products, setProducts] = useState<CardProduct[]>([])
  const [category, setCategory] = useState("Semua")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"terbaru" | "termurah" | "termahal">("terbaru")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addonProduct, setAddonProduct] = useState<Product | null>(null)
  const [selections, setSelections] = useState<Record<string, number[]>>({})

  useEffect(() => {
    productApi
      .list({ perPage: 100, inStockOnly: true })
      .then((page) => {
        setProducts(
          page.data.map((p: Product) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            size: p.size,
            imageUrl: p.image,
            stock: p.stock,
            addonGroups: p.addon_groups ?? [],
          })),
        )
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat produk")
      })
      .finally(() => setLoading(false))
  }, [])

  // Add-on per_order yang sudah terikat ke item lain di pesanan. Pilihan
  // duplikat di pop-up produk tidak akan ditagih ulang.
  const takenPerOrder = useMemo(() => {
    const keys = new Set<string>()
    const groupCodes = new Set<string>()
    for (const addon of [...draftServices.flatMap((s) => s.addons), ...draftProducts.flatMap((p) => p.addons)]) {
      if (!isPerOrderAddon(addon)) continue
      keys.add(perOrderAddonKey(addon))
      groupCodes.add(addon.group.code)
    }
    return { keys, groupCodes }
  }, [draftServices, draftProducts])

  const productCategories = useMemo(() => {
    const fromData = [...new Set(products.map((p) => p.category))].filter(Boolean)
    return Array.from(new Set([...PRODUCT_CATEGORIES, ...fromData]))
  }, [products])

  const filtered = useMemo(() => {
    let list = products.filter((p) => category === "Semua" || p.category === category)
    if (search.trim()) {
      list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    }
    if (sort === "termurah") list = [...list].sort((a, b) => moneyToNumber(a.price) - moneyToNumber(b.price))
    if (sort === "termahal") list = [...list].sort((a, b) => moneyToNumber(b.price) - moneyToNumber(a.price))
    return list
  }, [category, search, sort, products])

  function handleAdd(product: CardProduct) {
    const record: Product = {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      size: product.size,
      stock: product.stock,
      is_active: true,
      image: product.imageUrl,
      addon_groups: product.addonGroups,
    }
    if (product.addonGroups.length === 0) {
      addProduct(record)
      onAddToOrder?.(product.id)
      navigate("/checkout")
      return
    }
    const defaults: Record<string, number[]> = {}
    for (const group of product.addonGroups) {
      defaults[group.code] = group.options.filter((option) => option.is_default).map((option) => option.id)
    }
    setSelections(defaults)
    setAddonProduct(record)
  }

  function toggleAddon(group: ServiceAddonGroup, option: ServiceAddonOption) {
    if (!option.is_active) return
    setSelections((prev) => {
      const picked = prev[group.code] ?? []
      if (group.selection_type === "single") {
        return { ...prev, [group.code]: picked[0] === option.id ? [] : [option.id] }
      }
      return {
        ...prev,
        [group.code]: picked.includes(option.id)
          ? picked.filter((id) => id !== option.id)
          : [...picked, option.id],
      }
    })
  }

  function confirmAddWithAddons() {
    if (!addonProduct) return
    const requiredMissing = addonProduct.addon_groups.some(
      (group) =>
        group.is_active &&
        group.is_required &&
        (selections[group.code]?.length ?? 0) === 0 &&
        !takenPerOrder.groupCodes.has(group.code),
    )
    if (requiredMissing) {
      toastError("Lengkapi add-on wajib sebelum menambahkan produk")
      return
    }
    const chosen = addonProduct.addon_groups.flatMap((group) =>
      (selections[group.code] ?? []).flatMap((optionId) => {
        const option = group.options.find((candidate) => candidate.id === optionId)
        return option ? [{ group, option }] : []
      }),
    )
    // Add-on per_order yang sudah dipakai item lain dilewati (diikat ke item
    // pertama) supaya tidak tertagih dua kali.
    const addons = chosen.filter(
      (addon) => !isPerOrderAddon(addon) || !takenPerOrder.keys.has(perOrderAddonKey(addon)),
    )
    const skipped = chosen.length - addons.length
    addProduct(addonProduct, 1, addons)
    onAddToOrder?.(addonProduct.id)
    const baseMessage =
      addons.length > 0
        ? `${addonProduct.name} + ${addons.length} add-on ditambahkan ke pesanan`
        : `${addonProduct.name} ditambahkan ke pesanan`
    toastSuccess(
      skipped > 0
        ? `${baseMessage} (${skipped} add-on per order sudah terpasang di item lain)`
        : baseMessage,
    )
    setAddonProduct(null)
    navigate("/checkout")
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr] 2xl:max-w-[1600px]">
      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 px-2 text-sm font-semibold text-ink-strong">Kategori Produk</h2>
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => setCategory("Semua")}
            className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer ${category === "Semua"
                ? "bg-primary-light text-primary"
                : "text-ink hover:bg-gray-50"
              }`}
          >
            Semua
          </button>
          {productCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer ${category === c
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {loading ? (
            <div className="col-span-full">
              <LoadingState message="Memuat produk..." />
            </div>
          ) : loadError ? (
            <div className="col-span-full">
              <ErrorState message={loadError} />
            </div>
          ) : (
            <>
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
                    <p className="mt-1 text-md font-semibold text-ink-strong">{product.name}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">Stok Tersisa: {product.stock}</p>
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
            </>
          )}
        </div>
      </div>
      {addonProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setAddonProduct(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-ink-strong">Pilih Add-on {addonProduct.name}</h3>
                <p className="text-xs text-gray-500">Add-on mengikuti item produk ini dan dihitung otomatis.</p>
              </div>
              <button onClick={() => setAddonProduct(null)} className="text-gray-400 hover:text-ink-strong">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {addonProduct.addon_groups.filter((group) => group.is_active).map((group) => (
                <div key={group.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-strong">{group.name}</p>
                    {group.is_required && (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Wajib
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.options.filter((option) => option.is_active).map((option) => {
                      const checked = (selections[group.code] ?? []).includes(option.id)
                      const takenElsewhere =
                        isPerOrderAddon({ group, option }) &&
                        takenPerOrder.keys.has(perOrderAddonKey({ group, option }))
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={takenElsewhere}
                          onClick={() => toggleAddon(group, option)}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${takenElsewhere
                              ? "cursor-not-allowed border-gray-100 opacity-50"
                              : checked
                                ? "border-primary bg-primary-light/40"
                                : "border-gray-200"
                            }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`h-4 w-4 rounded-full border-2 ${checked ? "border-primary bg-primary" : "border-gray-300"}`} />
                            {option.name}
                            {takenElsewhere && (
                              <span className="text-[10px] font-semibold text-gray-400">Sudah dipakai item lain</span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            +{formatIDR(option.price)}{option.price_mode === "per_unit" ? "/unit" : "/order"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setAddonProduct(null)}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-ink-strong"
              >
                Batal
              </button>
              <button
                onClick={confirmAddWithAddons}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Tambah ke Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}