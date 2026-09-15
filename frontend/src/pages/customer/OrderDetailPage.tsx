import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Check, CreditCard, MessageCircle } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { OrderDetail } from "../../lib/types"
import { orderApi } from "../../services/api"

const steps = ["Diterima", "Dicuci", "Disetrika", "Siap Antar", "Selesai"]

const stepIndexByStatus: Record<string, number> = {
  DITERIMA: 0,
  DIPROSES: 1,
  SIAP_ANTAR: 3,
  SELESAI: 4,
}

const paymentLabel: Record<string, string> = {
  fadarosipay: "FADAROSI Pay",
  transfer_bank: "Transfer Bank (VA)",
  cod: "Bayar di Tempat (COD)",
}

const statusLabel: Record<string, string> = {
  BARU: "Pesanan Baru",
  DITERIMA: "Diterima",
  DIPROSES: "Sedang Diproses",
  SIAP_ANTAR: "Siap Antar",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
}

interface OrderItemRow {
  id: string
  label: string
  note: string
  qty: number
  weightKg: number
  pricePerUnit: number
  subtotal: number
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)

  useEffect(() => {
    if (!orderId) return
    orderApi
      .get(orderId)
      .then(setOrder)
      .catch(() => undefined)
  }, [orderId])

  if (!order) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="py-16 text-center text-sm text-gray-400">Memuat detail pesanan...</p>
      </div>
    )
  }

  const currentStepIndex = stepIndexByStatus[order.status] ?? -1
  const totalWeightKg = Number(
    (order.services.reduce((sum, s) => sum + s.qty, 0) || 0).toFixed(1),
  )
  const items: OrderItemRow[] = [
    ...order.services.map((s) => ({
      id: s.id,
      label: s.service_name,
      note: s.notes || "Layanan laundry",
      qty: s.qty,
      weightKg: s.qty,
      pricePerUnit: s.price_per_unit,
      subtotal: s.subtotal,
    })),
    ...order.products.map((p) => ({
      id: p.id,
      label: p.product_name,
      note: p.category,
      qty: p.qty,
      weightKg: 0,
      pricePerUnit: p.price,
      subtotal: p.subtotal,
    })),
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <nav className="text-xs text-gray-400">
        Layanan / Riwayat Pesanan / <span className="text-ink-strong">Detail Pesanan</span>
      </nav>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-ink-strong">Pesanan #{order.order_id}</h1>
            <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              {statusLabel[order.status] ?? order.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Dibuat pada:{" "}
            {new Date(order.created_at).toLocaleString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">
            <MessageCircle size={15} /> Hubungi CS
          </button>
          {(order.status === "BARU" || order.status === "DITERIMA") && (
            <button
              onClick={() => orderApi.cancel(order.order_id).then(setOrder).catch(() => undefined)}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light"
            >
              Batalkan Pesanan
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-sm font-semibold text-ink-strong">Status Pengerjaan</h2>
        <div className="flex items-center">
          {steps.map((step, idx) => (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${idx < currentStepIndex
                      ? "bg-primary text-white"
                      : idx === currentStepIndex
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                >
                  {idx < currentStepIndex ? <Check size={15} /> : idx + 1}
                </span>
                <span
                  className={`text-xs font-medium ${idx <= currentStepIndex ? "text-primary" : "text-gray-400"
                    }`}
                >
                  {step}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <span
                  className={`mx-2 h-0.5 flex-1 ${idx < currentStepIndex ? "bg-primary" : "bg-gray-200"
                    }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 grid-rows-4 gap-6 ">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 col-span-2 row-span-2 flex gap-20">
          <div className="flex-1">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Informasi Pelanggan</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase text-gray-400">Nama Lengkap</p>
                <p className="font-semibold text-ink-strong">{order.customer.username}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Nomor Telepon</p>
                <p className="font-semibold text-ink-strong">{order.customer.phone}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Alamat Pengantaran</p>
                <p className="font-semibold text-ink-strong max-w-64">{order.address?.address_text ?? "-"}</p>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Jadwal &amp; Penanganan</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase text-gray-400">Tipe Layanan</p>
                <p className="font-semibold text-primary">
                  {order.services.map((s) => s.service_name).join(", ") || "Produk Toko"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Outlet</p>
                <p className="font-semibold text-ink-strong">{order.outlet?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Estimasi Selesai</p>
                <p className="font-semibold text-ink-strong">
                  {order.trackings[order.trackings.length - 1]?.estimated_completion_time
                    ? new Date(
                      order.trackings[order.trackings.length - 1]?.estimated_completion_time ?? "",
                    ).toLocaleString("id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>


        <div className="rounded-2xl border border-gray-200 bg-white p-6 row-span-3 col-span-1">
          <h2 className="mb-4 text-md font-semibold text-ink-strong border-b-[0.5px] border-gray-200 py-2">Ringkasan Biaya</h2>
          <div className="space-y-3 text-sm px-2">
            <div className="flex justify-between ">
              <span className="text-gray-500">Subtotal Laundry ({totalWeightKg} Kg)</span>
              <span className="font-medium text-ink-strong">{formatIDR(order.total_laundry)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal Produk</span>
              <span className="font-medium text-ink-strong">{formatIDR(order.total_product)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Biaya Antar-Jemput</span>
              <span className="font-medium text-ink-strong">{formatIDR(order.delivery_fee)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Total Pembayaran</span>
            <span className="text-lg font-bold text-primary">{formatIDR(order.total_amount)}</span>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-4">
            <CreditCard size={16} className="text-gray-400" />
            <div>
              <p className="text-[10px] uppercase text-gray-400">Metode Pembayaran</p>
              <p className="text-sm font-semibold text-ink-strong">
                {paymentLabel[order.payment_method] ?? order.payment_method}
              </p>
            </div>
          </div>
        </div>


        <div className="rounded-2xl border border-gray-200 bg-white p-6 col-span-2 row-span-2">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Rincian Item Laundry</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="pb-3 font-medium">Rincian Penanganan</th>
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
                      <p className="font-semibold text-ink-strong">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.note}</p>
                    </td>
                    <td className="py-4 text-right text-ink">{item.qty} Pcs</td>
                    <td className="py-4 text-right text-ink">{item.weightKg} Kg</td>
                    <td className="py-4 text-right text-ink">{formatIDR(item.pricePerUnit)} /kg</td>
                    <td className="py-4 text-right font-semibold text-ink-strong">
                      {formatIDR(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}