import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Check, CreditCard, Info, MessageCircle, RotateCcw, Trash2 } from "lucide-react"
import { formatIDR } from "../../lib/format"
import { paymentStatusLabel, paymentStatusStyle } from "../../lib/orderStatus"
import type { Money, OrderDetail, ServiceOrderAddon } from "../../lib/types"
import { moneyToNumber } from "../../lib/utils"
import { orderApi, refundApi } from "../../services/api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../components/Toast"
import { ConfirmDialog } from "../../components/ConfirmDialog"
import { ErrorState } from "../../components/ui"

const steps = ["Diterima", "Diproses", "Siap Antar", "Selesai", "Dibatalkan"]

const stepIndexByStatus: Record<string, number> = {
  DITERIMA: 0,
  DIPROSES: 1,
  SIAP_ANTAR: 2,
  SELESAI: 3,
  DIBATALKAN: 4,
}

const paymentLabel: Record<string, string> = {
  fadarosipay: "FADAROSI Pay",
  transfer_bank: "Transfer Bank (VA)",
  cod: "Bayar di Tempat (COD)",
}

const refundStatusLabel: Record<string, string> = {
  REQUESTED: "Refund Diajukan",
  APPROVED: "Refund Disetujui",
  REJECTED: "Refund Ditolak",
  REFUNDED: "Refund Selesai",
}

const refundStatusStyle: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  REFUNDED: "bg-emerald-100 text-emerald-700",
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
  unit: string
  weightKg: number
  pricePerUnit: Money
  addons: ServiceOrderAddon[]
  subtotal: Money
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reason, setReason] = useState("")
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  useEffect(() => {
    if (!orderId) return
    orderApi
      .get(orderId)
      .then((data) => {
        setOrder(data)
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat detail pesanan")
      })
  }, [orderId, reloadKey])

  async function handleCancel() {
    if (!order) return
    setCancelling(true)
    try {
      const updated = await orderApi.cancel(order.order_id)
      setOrder(updated)
      toast.success("Pesanan berhasil dibatalkan")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membatalkan pesanan")
    } finally {
      setCancelling(false)
    }
  }

  async function handleRefundRequest() {
    if (!order) return
    setRefundSubmitting(true)
    try {
      await refundApi.create({ order_id: order.order_id, reason })
      toast.success("Pengajuan refund berhasil dikirim")
      setReason("")
      setReloadKey((key) => key + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengajukan refund")
    } finally {
      setRefundSubmitting(false)
    }
  }

  async function handleRefundDecision(status: "APPROVED" | "REJECTED") {
    if (!order?.refund) return
    setRefundSubmitting(true)
    try {
      await refundApi.decide(order.refund.id, { status })
      toast.success(status === "APPROVED" ? "Refund disetujui dan diproses" : "Refund ditolak")
      setReloadKey((key) => key + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses refund")
    } finally {
      setRefundSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!order) return
    setDeleting(true)
    try {
      await orderApi.remove(order.order_id)
      setConfirmDelete(false)
      toast.success("Pesanan berhasil dihapus")
      navigate(isAdmin ? "/admin/pesanan" : "/history")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pesanan")
    } finally {
      setDeleting(false)
    }
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 2xl:max-w-7xl">
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <p role="status" className="py-16 text-center text-sm text-gray-400">
            Memuat detail pesanan...
          </p>
        )}
      </div>
    )
  }

  function refundMessage(order: OrderDetail): string {
    const error: string[] = []

    if (order.order_type === "SERVICE") error.push("order bertipe product")
    if (order.status !== "SELESAI") error.push("order belum selesai")
    if (order.payment_method === "cod") error.push("order menggunakan metode cod")
    if (error.length > 0) return `Refund tidak dapat diajukan karena ${error.join(", ")}.`
    return "Refund dapat diajukan"
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
      unit: s.unit,
      weightKg: s.qty,
      pricePerUnit: s.price_per_unit,
      addons: s.addons,
      subtotal: s.subtotal,
    })),
    ...order.products.map((p) => ({
      id: p.id,
      label: p.product_name,
      note: p.category,
      qty: p.qty,
      unit: "Pcs",
      weightKg: 0,
      pricePerUnit: p.price,
      addons: p.addons,
      subtotal: p.subtotal,
    })),
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8 2xl:max-w-7xl">
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
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.order_type === "PRODUCT" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {order.order_type === "PRODUCT" ? "Product · Refundable" : "Service · Non-refund"}
            </span>
            {order.payment && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusStyle[order.payment.status]}`}
              >
                {paymentStatusLabel[order.payment.status]}
              </span>
            )}
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
          {!isAdmin && (
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">
            <MessageCircle size={15} /> Hubungi CS
          </button>
          )}
          {(order.status === "BARU" || order.status === "DITERIMA") && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light disabled:opacity-60"
            >
              {cancelling ? "Membatalkan..." : "Batalkan Pesanan"}
            </button>
          )}
          {(order.status === "DIBATALKAN" || order.status === "SELESAI") && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 size={15} /> Hapus Pesanan
            </button>
          )}
        </div>
      </div>

      <div className={`rounded-2xl border p-4 text-sm ${order.order_type === "PRODUCT" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        <div className="flex gap-3">
          <Info size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>
              <span className="font-semibold">Kebijakan refund:</span>{" "}
              {refundMessage(order)}
            </p>
            {order.refund && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/70 p-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${refundStatusStyle[order.refund.status]}`}>
                  {refundStatusLabel[order.refund.status]}
                </span>
                <span className="text-xs">Alasan: {order.refund.reason}</span>
              </div>
            )}
            {!isAdmin && order.refund_eligible && (!order.refund || order.refund.status === "REJECTED") && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Tulis alasan refund (minimal 10 karakter)..."
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-ink-strong outline-none focus:border-primary"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={handleRefundRequest}
                  disabled={refundSubmitting || reason.trim().length < 10}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <RotateCcw size={15} /> {refundSubmitting ? "Mengirim..." : "Ajukan Refund"}
                </button>
              </div>
            )}
            {isAdmin && order.refund?.status === "REQUESTED" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRefundDecision("APPROVED")}
                  disabled={refundSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Setujui Refund
                </button>
                <button
                  type="button"
                  onClick={() => handleRefundDecision("REJECTED")}
                  disabled={refundSubmitting}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                >
                  Tolak Refund
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-sm font-semibold text-ink-strong">Status Pengerjaan</h2>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[520px] items-center">
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 grid-rows-4">
        <div className="flex flex-col gap-8 row-span-2 rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2 lg:flex-row lg:gap-20">
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

        <div className="rounded-2xl border row-span-2 border-gray-200 bg-white p-6 lg:col-span-1 lg:row-span-3">
          <h2 className="mb-4 text-md font-semibold text-ink-strong border-b-[0.5px] border-gray-200 py-2">Ringkasan Biaya</h2>
          <div className="space-y-3 text-sm px-2">
            <div className="flex justify-between ">
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

        <div className="rounded-2xl border row-span-3 border-gray-200 bg-white p-6 lg:col-span-2">
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
                    <td className="py-4 text-right text-ink">{item.qty} {item.unit}</td>
                    <td className="py-4 text-right text-ink">{item.weightKg > 0 ? `${item.weightKg} Kg` : "-"}</td>
                    <td className="py-4 text-right text-ink">{formatIDR(item.pricePerUnit)} /{item.unit}</td>
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

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus Pesanan?"
        message={`Pesanan ${order.order_id} akan dihapus permanen beserta detailnya. Tindakan ini tidak dapat dibatalkan. Yakin ingin menghapus?`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}