import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { Box, Search, UploadCloud } from "lucide-react"
import { formatIDR } from "../../lib/format"
import { toMoneyInput } from "../../lib/utils"
import { PRODUCT_CATEGORIES } from "../../lib/utils"
import type { Money, Product } from "../../lib/types"
import { productApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { useToast } from "../../components/Toast"
import { ErrorState, LoadingState } from "../../components/ui"
import DeletePopup from "../../components/deletePopUp"

// Batas ukuran & format foto sesuai aturan backend (maksimal 2MB, JPG/PNG/WEBP)
const MAX_IMAGE_SIZE = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

// Helper: resolusi URL gambar produk (path relatif /uploads ditangani proxy & serveStatic backend)
function resolveAssetUrl(image: string | undefined): string {
  return image && !image.startsWith("http") ? image : (image ?? "")
}

interface ProductCard {
  id: number
  name: string
  category: string
  price: Money
  stock: number
  image: string | undefined
}

export function AdminProductManagementPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<ProductCard[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Semua")
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // State form produk (dipakai untuk Tambah maupun Edit)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("")
  const [description, setDescription] = useState("")
  const [pendingImage, setPendingImage] = useState<File | null>(null)

  // State pop-up konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<ProductCard | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Muat ulang daftar produk dari backend
  const load = () =>
    productApi
      .list({ perPage: 100 })
      .then((page) => {
        setProducts(
          page.data.map((p: Product) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock,
            image: p.image || undefined,
          })),
        )
        setListError(null)
      })
      .catch((err) => {
        setListError(err instanceof Error ? err.message : "Gagal memuat daftar produk")
      })
      .finally(() => setListLoading(false))

  useEffect(() => {
    load()
  }, [])

    const categories = useMemo(() => {
      const fromData = [...new Set(products.map((p) => p.category))].filter(Boolean)
      return Array.from(new Set(["Semua",...PRODUCT_CATEGORIES, ...fromData]))
    }, [products])


  // Penyaringan daftar produk berdasarkan kategori & kata kunci pencarian
  const filtered = useMemo(() => {
    let list = products
    if (category !== "Semua") list = list.filter((p) => p.category === category)
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    return list
  }, [products, category, search])

  // Produk yang sedang diedit (untuk melengkapi form / pratinjau gambar)
  const editingProduct = products.find((p) => p.id === editingId) ?? null

  // Sumber gambar pratinjau: file baru yang dipilih, atau foto produk yang sudah ada
  const previewSrc = useMemo(
    () =>
      pendingImage
        ? URL.createObjectURL(pendingImage)
        : editingProduct?.image
          ? resolveAssetUrl(editingProduct.image)
          : "",
    [pendingImage, editingProduct],
  )

  // Kosongkan seluruh form kembali ke kondisi awal
  function handleReset() {
    setEditingId(null)
    setName("")
    setFormCategory("")
    setPrice("")
    setStock("")
    setDescription("")
    setPendingImage(null)
  }

  // Isi form dengan data produk yang akan diedit
  function handleEdit(product: ProductCard) {
    setEditingId(product.id)
    setName(product.name)
    setFormCategory(product.category)
    setPrice(product.price)
    setStock(String(product.stock))
    setDescription("")
    setPendingImage(null)
  }

  // Validasi & simpan foto yang dipilih pengguna (cek format dan ukuran)
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE) {
      toastError("Ukuran foto maksimal 2MB")
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toastError("Format foto harus JPG, PNG, atau WEBP")
      return
    }
    setPendingImage(file)
  }

  // Simpan produk (buat baru atau perbarui) lalu unggah foto bila ada file baru
  async function handleSubmit() {
    if (!name.trim() || !formCategory || !price) return
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        category: formCategory,
        price: toMoneyInput(price),
        stock: stock ? Number(stock) : 0,
        size: "1 Pack",
        is_active: true,
      }
      if (editingId === null) {
        const created = await productApi.create(payload)
        toastSuccess("[Produk] berhasil ditambahkan.")
        if (pendingImage && created.id) {
          await productApi.uploadImage(created.id, pendingImage)
          toastSuccess("Foto produk berhasil diunggah")
        }
      } else {
        await productApi.update(editingId, payload)
        toastSuccess("[Produk] berhasil diperbarui.")
        if (pendingImage) {
          await productApi.uploadImage(editingId, pendingImage)
          toastSuccess("Foto produk berhasil diunggah")
        }
      }
      handleReset()
      await load()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menyimpan produk")
    } finally {
      setLoading(false)
    }
  }

  // Jalankan penghapusan produk setelah dikonfirmasi lewat pop-up
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await productApi.remove(deleteTarget.id)
      toastSuccess("[Produk] berhasil dihapus.")
      setDeleteTarget(null)
      if (editingId === deleteTarget.id) handleReset()
      await load()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menghapus produk")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto grid w-full grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
      {/* Daftar produk */}
      <div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-ink outline-none"
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-2 text-primary">
              <Box size={20} className="bg-primary-light" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {listLoading ? (
            <div className="col-span-full">
              <LoadingState message="Memuat produk..." />
            </div>
          ) : listError ? (
            <div className="col-span-full">
              <ErrorState message={listError} onRetry={() => { setListLoading(true); load() }} />
            </div>
          ) : (
            <>
              {filtered.map((product) => (
                <div key={product.id} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <div className="aspect-square w-full overflow-hidden bg-gray-100">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-400">Gambar</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[11px] font-semibold uppercase text-primary">{product.category}</p>
                    <p className="mt-1 text-sm font-semibold text-ink-strong">{product.name}</p>
                    <p className="text-xs text-gray-400">Stok: {product.stock} Pcs</p>
                    <p className="mt-1 text-base font-bold text-ink-strong">{formatIDR(product.price)}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-semibold text-ink hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(product)}
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
            </>
          )}
        </div>
      </div>

      {/* Form Tambah / Edit produk (menjadi kolom kanan yang tetap saat digulir di layar lebar) */}
      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6 lg:sticky lg:top-20">
        <h2 className="mb-4 text-base font-bold text-ink-strong">
          {editingId === null ? "Tambah Produk Baru" : "Edit Produk"}
        </h2>

        <label htmlFor="product-name" className="mb-1 block text-xs font-medium text-gray-500">Nama Produk</label>
        <input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masukkan nama produk..."
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <label htmlFor="product-category" className="mb-1 block text-xs font-medium text-gray-500">Kategori</label>
        <select
          id="product-category"
          value={formCategory}
          onChange={(e) => setFormCategory(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">Pilih Kategori</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="product-price" className="mb-1 block text-xs font-medium text-gray-500">Harga (Rp)</label>
            <input
              id="product-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              type="number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="product-stock" className="mb-1 block text-xs font-medium text-gray-500">Jumlah Stok</label>
            <input
              id="product-stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              type="number"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <label htmlFor="product-description" className="mb-1 block text-xs font-medium text-gray-500">Deskripsi Produk</label>
        <textarea
          id="product-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Jelaskan manfaat & info produk..."
          rows={3}
          className="mb-4 w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        {/* Area unggah foto: klik untuk memilih file, lengkap dengan pratinjau */}
        <p className="mb-1 block text-xs font-medium text-gray-500">Upload Foto Produk</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-4 flex h-40 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-primary-light/40 text-center transition-colors hover:border-primary"
        >
          {previewSrc ? (
            <img src={previewSrc} alt="Pratinjau produk" className="h-full w-full object-cover" />
          ) : (
            <>
              <UploadCloud size={22} className="text-primary" />
              <p className="text-sm font-semibold text-primary">Klik untuk Upload</p>
              <p className="text-xs text-gray-400">Format JPG, PNG up to 2MB</p>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          hidden
        />

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !formCategory || !price}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : editingId === null ? "Simpan Produk" : "Simpan Perubahan"}
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            Batal
          </button>
        </div>
      </aside>

      {/* Pop-up konfirmasi penghapusan produk */}
      <DeletePopup
        open={deleteTarget !== null}
        dataName={deleteTarget?.name}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}