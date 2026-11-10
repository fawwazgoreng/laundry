import { moneyToNumber } from "../../lib/utils"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Loader2, Printer, XCircle } from "lucide-react"
import { adminStatusLabel, adminStatusStyle } from "../../lib/orderStatus"
import { formatIDR } from "../../lib/format"
import type { OrderDetail, PaymentMethod } from "../../lib/types"
import { orderApi } from "../../services/api"

// Label metode pembayaran dalam Bahasa Indonesia untuk tampilan Nota
const paymentLabel: Record<PaymentMethod, string> = {
  transfer_bank: "Transfer Bank (Virtual Account)",
  cod: "Bayar di Tempat (COD)",
}

// Label status pembayaran agar Nota mudah dibaca
const paymentStatusLabel: Record<string, string> = {
  PENDING: "Menunggu Pembayaran",
  PAID: "Lunas",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  REFUNDED: "Dikembalikan",
  CANCELLED: "Dibatalkan",
}

// Helper: format tanggal + jam ke format Indonesia (contoh: 17 Agustus 2024, 14:30)
function formatDateTime(value: string | null): string {
  if (!value) return "-"
  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Helper: format tanggal lengkap ke format Indonesia (contoh: Senin, 17 Agustus 2024)
function formatDateLong(value: string | Date | null): string {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Halaman Nota Transaksi: dokumentasi resmi pesanan lengkap dengan tombol cetak/export PDF
export function ReceiptPage() {
  const { notaId } = useParams<{ notaId: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!notaId) return
    orderApi
      .get(notaId)
      .then(setOrder)
      .catch(() => setError("Nota tidak ditemukan atau terjadi kesalahan jaringan."))
  }, [notaId])

  useEffect(() => {
    if (order) document.title = `Nota ${order.order_id} - Fadarosi`
  }, [order])

  const items = [
    ...(order?.services ?? []).map((s) => ({
      id: s.id,
      name: s.service_name,
      detail: s.notes || "Layanan laundry Fadarosi",
      qty: `${s.qty} Pcs`,
      weight: `${Number((s.qty || 0).toFixed(1))} Kg`,
      price: formatIDR(s.price_per_unit),
      addons: s.addons,
      subtotal: s.subtotal,
    })),
    ...(order?.products ?? []).map((p) => ({
      id: p.id,
      name: p.product_name,
      detail: p.category,
      qty: `${p.qty} Pcs`,
      weight: "-",
      price: formatIDR(p.price),
      addons: [],
      subtotal: p.subtotal,
    })),
  ]

  const totalWeightKg = (order?.services ?? []).reduce((sum, s) => sum + s.qty, 0)

  const handlePrint = () => window.print()

  if (!order && !error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Memuat Nota...</span>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <XCircle className="mb-4 h-12 w-12 text-red-500" />
        <h1 className="text-lg font-bold text-ink-strong">Nota Tidak Ditemukan</h1>
        <p className="mt-2 text-sm text-gray-500">{error ?? "Data pesanan tidak tersedia."}</p>
        <a
          href="/"
          className="mt-6 cursor-pointer rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
        >
          Kembali ke Beranda
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8 sm:px-6">
      <div className="print-hidden mx-auto mb-6 flex max-w-3xl items-center justify-between gap-4">
        <a
          href="/"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
        >
          <ArrowLeft size={15} />
          Kembali
        </a>
        <button
          onClick={handlePrint}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
        >
          <Printer size={15} />
          Cetak / Export PDF
        </button>
      </div>

      <section className="print-area mx-auto max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-black text-white">
              F
            </span>
            <div>
              <p className="text-lg font-black tracking-tight text-ink-strong">FADAROSI</p>
              <p className="text-xs text-gray-400">Laundry, Toko &amp; Antar-Jemput</p>
            </div>
          </div>
          {/* Nomor Nota + status pesanan */}
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Nota Transaksi</p>
            <p className="text-xl font-black text-primary">{order.order_id}</p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${adminStatusStyle[order.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {adminStatusLabel[order.status] ?? order.status}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 border-b border-gray-100 p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Keterangan Transaksi</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Tanggal</dt>
                <dd className="text-right font-semibold text-ink-strong">{formatDateTime(order.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Outlet</dt>
                <dd className="text-right font-semibold text-ink-strong">{order.outlet?.name ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Estimasi Selesai</dt>
                <dd className="text-right font-semibold text-ink-strong">
                  {formatDateTime(order.estimated_delivery)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Metode Bayar</dt>
                <dd className="text-right font-semibold text-ink-strong">
                  {paymentLabel[order.payment_method] ?? order.payment_method}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Status Bayar</dt>
                <dd className="flex items-center justify-end gap-1.5 text-right font-semibold text-ink-strong">
                  {order.payment?.status === "PAID" ? (
                    <CheckCircle2 size={15} className="text-green-600" />
                  ) : (
                    <XCircle size={15} className="text-amber-500" />
                  )}
                  {order.payment ? (paymentStatusLabel[order.payment.status] ?? order.payment.status) : "Belum Dibayar"}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Penerima / Pelanggan</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Nama</dt>
                <dd className="text-right font-semibold text-ink-strong">{order.customer.username}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Telepon</dt>
                <dd className="text-right font-semibold text-ink-strong">{order.customer.phone}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Alamat</dt>
                <dd className="max-w-56 text-right font-semibold text-ink-strong">
                  {order.address?.address_text ?? "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Catatan</dt>
                <dd className="max-w-56 text-right font-semibold text-ink-strong">{order.notes ?? "-"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Rincian Item</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <th className="pb-3 font-medium">Rincian</th>
                  <th className="pb-3 text-right font-medium">Jumlah</th>
                  <th className="pb-3 text-right font-medium">Berat (Est)</th>
                  <th className="pb-3 text-right font-medium">Harga/Unit</th>
                  <th className="pb-3 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-4">
                      <p className="font-semibold text-ink-strong">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.detail}</p>
                      {item.addons.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {item.addons.map((addon) => (
                            <li key={addon.id} className="text-[11px] text-primary">
                              {addon.group_name}: {addon.option_name} ({formatIDR(addon.subtotal)})
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-4 text-right text-ink">{item.qty}</td>
                    <td className="py-4 text-right text-ink">{item.weight}</td>
                    <td className="py-4 text-right text-ink">{item.price}</td>
                    <td className="py-4 text-right font-semibold text-ink-strong">{formatIDR(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:justify-end">
            <div className="w-full max-w-xs space-y-3 text-sm sm:ml-auto">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal Laundry ({totalWeightKg} Kg)</span>
                <span className="font-medium text-ink-strong">{formatIDR(order.total_laundry)}</span>
              </div>
              {moneyToNumber(order.total_addon) > 0 && (
                <div className="flex justify-between pl-3">
                  <span className="text-xs text-gray-400">Termasuk Add-on Layanan</span>
                  <span className="text-xs font-medium text-gray-500">{formatIDR(order.total_addon)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal Produk</span>
                <span className="font-medium text-ink-strong">{formatIDR(order.total_product)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Biaya Antar-Jemput</span>
                <span className="font-medium text-ink-strong">{formatIDR(order.delivery_fee)}</span>
              </div>
              {order.discount_member > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Diskon Member</span>
                  <span className="font-medium text-primary">{formatIDR(-order.discount_member)}</span>
                </div>
              )}
              {order.discount_voucher > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Diskon Voucher</span>
                  <span className="font-medium text-primary">{formatIDR(-order.discount_voucher)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink-strong">Total Pembayaran</span>
                <span className="text-xl font-black text-primary">{formatIDR(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-gray-100 bg-gray-50 p-6 text-center sm:p-8">
          <p className="text-sm font-semibold text-ink-strong">Terima kasih telah berbelanja di Fadarosi</p>
          <p className="mt-1 text-xs text-gray-400">
            Nota dicetak pada {formatDateLong(new Date())} &middot; Dokumen ini sah dan berlaku untuk
            layanan yang tercantum di atas.
          </p>
        </footer>
      </section>
    </div>
  )
}