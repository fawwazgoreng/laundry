import { useState } from "react"
import { Check, Minus, Plus, Trash2, Wallet, Landmark } from "lucide-react"
import { addresses } from "../lib/mockData"
import { formatIDR } from "../lib/format"

const progressSteps = ["Pilih Layanan", "Detail & Berat", "Jadwal & Alamat", "Konfirmasi & Bayar"]

interface CartLine {
  id: number
  tag: string
  name: string
  desc: string
  qty: number
  unit: string
  pricePerUnit: number
}

const initialCart: CartLine[] = [
  {
    id: 1,
    tag: "Layanan Laundry",
    name: "Cuci Setrika Premium",
    desc: "Layanan lengkap: cuci wangi lavender, pengeringan, &...",
    qty: 3.2,
    unit: "Kg",
    pricePerUnit: 8000,
  },
  {
    id: 2,
    tag: "Toko Detergen",
    name: "Detergen Cair Liquid Pro",
    desc: "Kemasan 1 Liter • Ramah Lingkungan & Bersih Maksimal",
    qty: 1,
    unit: "Pcs",
    pricePerUnit: 32500,
  },
  {
    id: 3,
    tag: "Toko Softener",
    name: "Softener Lavender Blossom",
    desc: "Kemasan 800ml • Keharuman Segar Tahan Lama 48 Jam",
    qty: 2,
    unit: "Pcs",
    pricePerUnit: 28000,
  },
]

export function CheckoutPage() {
  const [cart, setCart] = useState(initialCart)
  const [paymentMethod, setPaymentMethod] = useState<"transfer" | "cod">("transfer")
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
  }

  const itemsTotal = cart.reduce((sum, l) => sum + l.qty * l.pricePerUnit, 0)
  const deliveryFee = 10000
  const memberDiscount = 15000
  const voucherDiscount = 10000
  const total = itemsTotal + deliveryFee - memberDiscount - voucherDiscount

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Buat Pesanan &amp; Checkout</h1>
        <p className="text-sm text-gray-500">
          Selesaikan detail pengiriman, jadwal, dan pembayaran untuk memproses pesanan Fadarosi Anda.
        </p>
      </div>

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
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Layanan &amp; Produk Terpilih</h2>
              <div className="flex gap-4 text-xs font-semibold text-primary">
                <button>+ Tambah Layanan</button>
                <button>+ Tambah Barang</button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {cart.map((line) => (
                <div key={line.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="rounded bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {line.tag}
                    </span>
                    <p className="mt-1 text-sm font-semibold text-ink-strong">{line.name}</p>
                    <p className="text-xs text-gray-400">{line.desc}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
                      <button onClick={() => updateQty(line.id, line.unit === "Kg" ? -0.1 : -1)}>
                        <Minus size={14} className="text-gray-400" />
                      </button>
                      <span className="w-14 text-center text-sm font-medium">
                        {line.qty.toFixed(line.unit === "Kg" ? 1 : 0)} {line.unit}
                      </span>
                      <button onClick={() => updateQty(line.id, line.unit === "Kg" ? 0.1 : 1)}>
                        <Plus size={14} className="text-gray-400" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {formatIDR(line.pricePerUnit)} / {line.unit === "Kg" ? "Kg" : "unit"}
                      </p>
                      <p className="text-sm font-bold text-ink-strong">
                        {formatIDR(line.qty * line.pricePerUnit)}
                      </p>
                    </div>
                    <button onClick={() => removeLine(line.id)} className="text-gray-300 hover:text-primary">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Alamat Pengiriman &amp; Penjemputan</h2>
              <button className="text-xs font-semibold text-primary">Ubah Alamat</button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink-strong">Rumah Utama</p>
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                Utama
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {primaryAddress.recipientName} • {primaryAddress.phone}
            </p>
            <p className="text-sm text-gray-500">{primaryAddress.fullAddress}</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Jadwal Pengambilan &amp; Pengantaran</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-1 text-xs font-semibold text-primary">Jadwal Penjemputan</p>
                <p className="text-sm font-medium text-ink-strong">Kamis, 15 Agustus 2024 · 09:00 WIB</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-1 text-xs font-semibold text-emerald-600">Estimasi Pengantaran</p>
                <p className="text-sm font-medium text-ink-strong">Jumat, 16 Agustus 2024 · 17:00 WIB</p>
              </div>
            </div>
          </div>

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
            <div className="flex justify-between">
              <span className="text-gray-500">Diskon Premium Member</span>
              <span className="font-medium text-primary">-{formatIDR(memberDiscount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Diskon Voucher Promo</span>
              <span className="font-medium text-primary">-{formatIDR(voucherDiscount)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Total Pembayaran</span>
            <span className="text-lg font-bold text-primary">{formatIDR(total)}</span>
          </div>
          <button className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark">
            Buat Pesanan Sekarang
          </button>
        </aside>
      </div>
    </div>
  )
}
