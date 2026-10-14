import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check, Minus, Plus, Trash2, Wallet, Landmark, WashingMachine, X } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { Address, Outlet, User, PaymentGate } from "../../lib/types"
import { addressApi, authApi, orderApi, outletApi } from "../../services/api"
import { useOrderDraft } from "../../context/OrderDraftContext"
import { ApiError } from "../../services/apiClient"

const progressSteps = ["Pilih Layanan", "Detail & Berat", "Jadwal & Alamat", "Konfirmasi & Bayar"]

type BankCode = "bca" | "mandiri" | "bni" | "bri"

const banks: { code: BankCode; name: string; desc: string }[] = [
  { code: "bca", name: "BCA", desc: "BCA Virtual Account" },
  { code: "mandiri", name: "Mandiri", desc: "Mandiri Virtual Account" },
  { code: "bni", name: "BNI", desc: "BNI Virtual Account" },
  { code: "bri", name: "BRI", desc: "BRI Virtual Account" },
]

interface CartLine {
  id: number
  tag: string
  name: string
  desc: string
  qty: number
  unit: string
  pricePerUnit: number
  image?: string
}

interface DeliverAddress {
  id: number
  label: string
  isPrimary: boolean
  fullAddress: string
  recipientName: string
  phone: string
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const { services, products, removeProduct, removeService } = useOrderDraft()

  const [cart, setCart] = useState<CartLine[]>(() => [
    ...services.map((s) => ({
      id: s.service.id,
      tag: "Layanan Laundry",
      name: s.service.name,
      desc: s.service.description,
      qty: s.qty,
      unit: s.service.unit,
      pricePerUnit: s.service.price_per_unit,
    })),
    ...products.map((p) => ({
      id: p.product.id,
      tag: "Toko Detergen",
      name: p.product.name,
      desc: `${p.product.category} • ${p.product.size}`,
      qty: p.qty,
      unit: "Pcs",
      pricePerUnit: p.product.price,
      image: p.product.image,
    })),
  ])
  const [addresses, setAddresses] = useState<DeliverAddress[]>([])
  const [paymentMethod, setPaymentMethod] = useState<"transfer" | "cod">("transfer")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [choiceAddress, setChoiceAddress] = useState(addresses[0]?.id || 0)

  // State pop-up bank
  const [showBankModal, setShowBankModal] = useState(false)
  const [selectedBank, setSelectedBank] = useState<BankCode | null>(null)

  useEffect(() => {
    addressApi
      .list()
      .then((list: Address[]) => {
        const mapped = list.map((a) => ({
          id: a.id,
          label: a.label,
          isPrimary: a.is_primary,
          fullAddress: a.address_text,
          recipientName: a.label,
          phone: "",
        }))
        setAddresses(mapped)
        // Tandai alamat utama (atau alamat pertama) sebagai pilihan bawaan
        const primary = mapped.find((a) => a.isPrimary) ?? mapped[0]
        if (primary) setChoiceAddress(primary.id)
      })
      .catch(() => undefined)
    authApi.me().then((user) => setCurrentUser(user))
  }, [])

  const primaryAddress = addresses.find((a) => a.isPrimary) ?? addresses[0]

  function updateQty(id: number, delta: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, qty: Math.max(line.unit === "Kg" ? 0.1 : 1, line.qty + delta) } : line,
      ),
    )
  }

  function removeLine(id: number) {
    setCart((prev) => prev.filter((line) => line.id !== id))
    removeProduct(id)
    removeService(id)
  }

  const itemsTotal = cart.reduce((sum, l) => sum + l.qty * l.pricePerUnit, 0)
  const deliveryFee = useMemo(() => {
    if (!primaryAddress) return 10000
    const distanceKm = 2.5
    return Math.round(Math.max(0, distanceKm) * 2000)
  }, [primaryAddress])
  const memberDiscount = 0
  const voucherDiscount = 0
  const total = itemsTotal + deliveryFee - memberDiscount - voucherDiscount

  const pickupSchedule = useMemo(() => new Date(), [])
  const estimatedDelivery = useMemo(() => new Date(pickupSchedule.getTime() + 48 * 60 * 60 * 1000), [pickupSchedule])

  function formatDateTime(date: Date) {
    const day = date.toLocaleDateString("id-ID", { weekday: "long" })
    const dateStr = date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB"
    return `${day}, ${dateStr} · ${timeStr}`
  }

  const pickupText = formatDateTime(pickupSchedule)
  const deliveryText = formatDateTime(estimatedDelivery)

  async function handleCreateOrder(bank?: BankCode) {
    if (!primaryAddress) return
    setSubmitting(true)
    setError("")
    try {
      const outlets = await outletApi.list()
      const outlet: Outlet | undefined =
        (outlets as Outlet[]).find((o) => o.max_coverage_km > 0) ?? (outlets as Outlet[])[0]
      if (!outlet) throw new ApiError("Tidak ada outlet yang tersedia", 404)
      const distance_km = 2.5
      const paidDelivery = orderApi
      const order: PaymentGate = await paidDelivery.create({
        services: services.map((s) => ({
          laundry_service_id: s.service.id,
          qty: s.qty,
          notes: s.notes || undefined,
        })),
        products: products.map((p) => ({ product_id: p.product.id, qty: p.qty })),
        user_address_id: choiceAddress,
        outlet_id: outlet.id,
        distance_km,
        payment_method: paymentMethod === "cod" ? "cod" : "transfer_bank",
        bank,
        pickup_schedule: pickupSchedule.toISOString(),
        estimated_delivery: estimatedDelivery.toISOString(),
        notes: "",
      })
      if (paymentMethod === "transfer") {
        const vaNumber = order.va_number
        if (vaNumber) {
          localStorage.setItem(`va_${order.order_id}`, vaNumber)
        }
        if (bank) {
          localStorage.setItem(`bank_${order.order_id}`, bank)
        }
        navigate(`/payment/${order.order_id}`)
        return
      }
      if (paymentMethod === "cod") {
        navigate(`/riwayat/${order.order_id}`)
        return
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan saat membuat pesanan")
    } finally {
      setSubmitting(false)
      setShowBankModal(false)
    }
  }

  // Transfer -> tampilkan pop-up bank, COD -> langsung buat pesanan
  function handleSubmitClick() {
    if (paymentMethod === "transfer") {
      setShowBankModal(true)
    } else {
      handleCreateOrder()
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Buat Pesanan &amp; Checkout</h1>
        <p className="text-sm text-gray-500">
          Selesaikan detail pengiriman, jadwal, dan pembayaran untuk memproses pesanan Fadarosi Anda.
        </p>
      </div>

      {/* Progres pemesanan */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-strong">Progres Pemesanan</h2>
        <div className="flex flex-wrap items-center gap-3">
          {progressSteps.map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {idx < 3 ? <Check size={14} /> : idx + 1}
              </span>
              <span className={`text-sm font-semibold ${idx === 3 ? "text-primary" : "text-ink-strong"}`}>
                {step}
              </span>
              {idx < progressSteps.length - 1 && <span className="mx-1 text-gray-300">{">"}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Layanan & produk terpilih */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Layanan &amp; Produk Terpilih</h2>
              <div className="flex gap-4 text-xs font-semibold text-primary">
                <Link to={"/layanan"}>+ Tambah Layanan</Link>
                <Link to={"/produk"}>+ Tambah Barang</Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {cart.map((line) => (
                <div key={line.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="bg-primary-light w-16 h-16 shrink-0 overflow-hidden flex items-center justify-center text-4xl rounded-xl">
                      {line.tag === "Layanan Laundry" ? (
                        <WashingMachine className="w-8 h-8 text-primary" />
                      ) : (
                        <img src={line.image} className="w-full h-full block object-cover" alt="" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className="inline-block rounded bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {line.tag}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-ink-strong truncate">{line.name}</p>
                      <p className="text-xs text-gray-400 truncate">{line.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                    {/* Tombol Qty */}
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 bg-white">
                      <button onClick={() => updateQty(line.id, line.unit === "Kg" ? -0.1 : -1)} className="cursor-pointer">
                        <Minus size={14} className="text-gray-400 hover:text-ink-strong" />
                      </button>
                      <span className="w-14 text-center text-sm font-medium select-none">
                        {line.qty.toFixed(line.unit === "Kg" ? 1 : 0)} {line.unit}
                      </span>
                      <button onClick={() => updateQty(line.id, line.unit === "Kg" ? 0.1 : 1)} className="cursor-pointer">
                        <Plus size={14} className="text-gray-400 hover:text-ink-strong" />
                      </button>
                    </div>

                    {/* Harga */}
                    <div className="text-right min-w-20">
                      <p className="text-xs text-gray-400">
                        {formatIDR(line.pricePerUnit)} / {line.unit === "Kg" ? "Kg" : "unit"}
                      </p>
                      <p className="text-sm font-bold text-ink-strong">
                        {formatIDR(line.qty * line.pricePerUnit)}
                      </p>
                    </div>

                    <button
                      onClick={() => removeLine(line.id)}
                      className="text-gray-300 hover:text-primary cursor-pointer transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  Belum ada layanan atau produk yang dipilih.
                </p>
              )}
            </div>
          </div>

          {/* Alamat */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Alamat Pengiriman &amp; Penjemputan</h2>
              <Link to={"/produk"} className="text-xs font-semibold text-primary">
                + Tambah Alamat
              </Link>
            </div>
            {addresses.map((addr) => (
              <div
                key={addr.id}
                onClick={() => setChoiceAddress(addr.id)}
                className={`mb-3 flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-4 sm:flex-row sm:items-center sm:gap-6 ${
                  addr.id == choiceAddress ? "border-primary" : "border-gray-200"
                }`}
              >
                <span
                  className={`h-6 w-6 shrink-0 rounded-full border-2 ${
                    choiceAddress === addr.id ? "border-primary bg-primary" : "border-gray-300"
                  }`}
                />
                <span>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-strong">{addr.label}</p>
                    {addr.isPrimary && (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Utama
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {addr.recipientName} • {currentUser?.phone || "-"}
                  </p>
                  <p className="text-sm text-gray-500">{addr.fullAddress}</p>
                </span>
              </div>
            ))}
          </div>

          {/* Jadwal */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Jadwal Pengambilan &amp; Pengantaran</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-1 text-xs font-semibold text-primary">Jadwal Penjemputan</p>
                <p className="text-sm font-medium text-ink-strong">{pickupText}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-1 text-xs font-semibold text-emerald-600">Estimasi Pengantaran</p>
                <p className="text-sm font-medium text-ink-strong">{deliveryText}</p>
              </div>
            </div>
          </div>

          {/* Metode pembayaran */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Metode Pembayaran</h2>
            <div className="space-y-3">
              <button
                onClick={() => setPaymentMethod("transfer")}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${
                  paymentMethod === "transfer" ? "border-primary" : "border-gray-200"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full border-2 ${
                    paymentMethod === "transfer" ? "border-primary bg-primary" : "border-gray-300"
                  }`}
                />
                <Landmark size={18} className="text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-ink-strong">Transfer Bank (Verifikasi Otomatis)</p>
                  <p className="text-xs text-gray-400">Transfer via Virtual Account BCA, Mandiri, BNI, BRI</p>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod("cod")}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${
                  paymentMethod === "cod" ? "border-primary" : "border-gray-200"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full border-2 ${
                    paymentMethod === "cod" ? "border-primary bg-primary" : "border-gray-300"
                  }`}
                />
                <Wallet size={18} className="text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-ink-strong">Bayar di Tempat (COD)</p>
                  <p className="text-xs text-gray-400">Bayar tunai kepada kurir Fadarosi saat pakaian dijemput</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Ringkasan belanja */}
        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Ringkasan Belanja</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Harga ({cart.length} Barang)</span>
              <span className="font-medium text-ink-strong">{formatIDR(itemsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Biaya Pengiriman</span>
              <span className="font-medium text-ink-strong">{formatIDR(deliveryFee)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Total Pembayaran</span>
            <span className="text-lg font-bold text-primary">{formatIDR(total)}</span>
          </div>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button
            onClick={handleSubmitClick}
            disabled={submitting || !choiceAddress || (services.length === 0 && products.length === 0)}
            className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? "Membuat Pesanan..." : "Buat Pesanan Sekarang"}
          </button>
        </aside>
      </div>

      {/* Pop-up pilih bank */}
      {showBankModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !submitting && setShowBankModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-ink-strong">Pilih Bank Virtual Account</h3>
                <p className="text-xs text-gray-500">Nomor VA akan dibuat sesuai bank yang Anda pilih.</p>
              </div>
              <button
                onClick={() => setShowBankModal(false)}
                disabled={submitting}
                className="cursor-pointer text-gray-400 hover:text-ink-strong"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 space-y-3">
              {banks.map((b) => (
                <button
                  key={b.code}
                  onClick={() => setSelectedBank(b.code)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                    selectedBank === b.code ? "border-primary bg-primary-light/40" : "border-gray-200"
                  }`}
                >
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                      selectedBank === b.code ? "border-primary bg-primary" : "border-gray-300"
                    }`}
                  />
                  <Landmark size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-ink-strong">{b.name}</p>
                    <p className="text-xs text-gray-400">{b.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
              <span className="text-gray-500">Total Pembayaran</span>
              <span className="font-bold text-primary">{formatIDR(total)}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBankModal(false)}
                disabled={submitting}
                className="w-full cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-ink-strong disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => selectedBank && handleCreateOrder(selectedBank)}
                disabled={!selectedBank || submitting}
                className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? "Memproses..." : "Konfirmasi & Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}