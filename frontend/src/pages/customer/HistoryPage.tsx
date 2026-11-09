import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CreditCard, Eye, Info, MapPin, Receipt, Search, Trash2 } from "lucide-react"
import { adminStatusLabel, adminStatusStyle, paymentStatusLabel, paymentStatusStyle } from "../../lib/orderStatus"
import { formatIDR } from "../../lib/format"
import type { Money, OrderKind, OrderListItem, OrderStatus, Payment, RefundStatus } from "../../lib/types"
import { orderApi, paymentApi } from "../../services/api"
import { useToast } from "../../components/Toast"
import { ConfirmDialog } from "../../components/ConfirmDialog"
import { ErrorState, LoadingState } from "../../components/ui"
import { Link, useNavigate } from "react-router-dom"

const PAYMENT_WINDOW_HOURS = 24

function hasActivePayment(payment: Payment): boolean {
  const expiresAt = new Date(payment.created_at).getTime() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000
  return payment.status === "PENDING" && expiresAt > Date.now()
}

const tabs = [
  { key: "semua", label: "Semua" },
  { key: "diterima", label: "Diterima" },
  { key: "diproses", label: "Diproses" },
  { key: "siap_antar", label: "Siap Antar" },
  { key: "selesai", label: "Selesai" },
  { key: "dibatalkan", label: "Dibatalkan" },
]

const refundTabs = [
  { key: "semua", label: "Semua" },
  { key: "request", label: "Refund Diajukan" },
  { key: "approve", label: "Refund Disetujui" },
  { key: "reject", label: "Refund Ditolak" },
  { key: "refunded", label: "Refund Selesai" },
]

interface AdminOrderRow {
  id: string
  customer: string
  phone: string
  content: string
  quantity: string
  status: OrderStatus
  orderType: OrderKind
  refundEligible: boolean
  refundStatus: RefundStatus | null
  paymentStatus: Payment["status"] | null
  total: Money
}

const refundStatusLabel: Record<RefundStatus, string> = {
  REQUESTED: "Refund diajukan",
  APPROVED: "Refund disetujui",
  REJECTED: "Refund ditolak",
  REFUNDED: "Refund selesai",
}

const refundStatusStyle: Record<RefundStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  REFUNDED: "bg-emerald-100 text-emerald-700",
}

export function UserOrderHistory() {
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useToast()
  const [activeTab, setActiveTab] = useState("semua")
  const [refundTab, setRefundTab] = useState("semua")
  const [search, setSearch] = useState("")
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [checkingPayment, setCheckingPayment] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminOrderRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = () =>
    orderApi
      .list({ perPage: 100 })
      .then((page) => {
        setOrders(
          page.data.map((o: OrderListItem) => ({
            id: o.order_id,
            customer: o.customer_name,
            phone: o.customer_phone,
            content: o.items_summary,
            quantity: o.items_unit,
            status: o.status,
            orderType: o.order_type,
            refundEligible: o.refund_eligible,
            refundStatus: o.refund_status,
            paymentStatus: o.payment_status,
            total: o.total_amount,
          })),
        )
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat riwayat pesanan")
      })
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  async function handlePaymentClick(orderId: string) {
    if (checkingPayment) return
    setCheckingPayment(orderId)
    try {
      const payment = await paymentApi.byOrder(orderId)
      if (hasActivePayment(payment)) {
        navigate(`/payment/${orderId}`)
      } else {
        toastError("Pembayaran pesanan ini sudah tidak berlaku.")
      }
    } catch {
      toastError("Pembayaran pesanan ini tidak ditemukan.")
    } finally {
      setCheckingPayment(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await orderApi.remove(deleteTarget.id)
      toastSuccess(`Pesanan ${deleteTarget.id} berhasil dihapus`)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Gagal menghapus pesanan")
    } finally {
      setDeleting(false)
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: orders.length }
    for (const tab of tabs.slice(1)) c[tab.key] = 0
    for (const o of orders) {
      if (o.status === "DITERIMA") c.diterima++
      if (o.status === "DIPROSES") c.diproses++
      if (o.status === "SIAP_ANTAR") c.siap_antar++
      if (o.status === "SELESAI") c.selesai++
      if (o.status === "DIBATALKAN") c.dibatalkan++
    }
    return c
  }, [orders])

  const refundCounts = useMemo(() => {
    const c: Record<string, number> = { semua: orders.length }
    for (const tab of refundTabs.slice(1)) c[tab.key] = 0
    for (const o of orders) {
      if (o.refundStatus === "REQUESTED") c.request++
      if (o.refundStatus === "APPROVED") c.approve++
      if (o.refundStatus === "REJECTED") c.reject++
      if (o.refundStatus === "REFUNDED") c.refunded++
    }
    return c
  }, [orders])

  const filtered = useMemo(() => {
    let list = orders
    if (activeTab === "diterima") list = list.filter((o) => o.status === "DITERIMA")
    if (activeTab === "diproses") list = list.filter((o) => o.status === "DIPROSES")
    if (activeTab === "siap_antar") list = list.filter((o) => o.status === "SIAP_ANTAR")
    if (activeTab === "selesai") list = list.filter((o) => o.status === "SELESAI")
    if (activeTab === "dibatalkan") list = list.filter((o) => o.status === "DIBATALKAN")

    if (refundTab === "request") list = list.filter((o) => o.refundStatus === "REQUESTED")
    if (refundTab === "approve") list = list.filter((o) => o.refundStatus === "APPROVED")
    if (refundTab === "reject") list = list.filter((o) => o.refundStatus === "REJECTED")
    if (refundTab === "refunded") list = list.filter((o) => o.refundStatus === "REFUNDED")

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((o) => o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q))
    }
    return list
  }, [orders, activeTab, refundTab, search])

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Riwayat Pesanan</h1>
        <p className="text-sm text-gray-500">Pantau status pesanan, pembayaran, dan pengajuan refund Anda.</p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <Info size={18} className="mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">Kebijakan refund:</span> Refund hanya dapat dilakukan untuk order bertipe{" "}
          <span className="font-semibold">Product</span> dan pembayaran melalui bank. Order layanan laundry atau campuran layanan + produk otomatis
          tidak memenuhi syarat refund.
        </p>
      </div>

      {/* Section Header: Status Alur Pesanan */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Status Alur Pesanan</h2>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-gray-50 text-ink hover:bg-gray-100"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {counts[tab.key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Section Header: Filter Status Refund */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Filter Status Refund</h2>
        <div className="flex flex-wrap gap-2">
          {refundTabs.map((tab) => {
            const isActive = refundTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setRefundTab(tab.key)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-amber-600 bg-amber-600 text-white"
                    : "border-gray-200 bg-gray-50 text-ink hover:bg-gray-100"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {refundCounts[tab.key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor order atau nama pelanggan..."
            className="w-full rounded-xl border bg-white border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <LoadingState message="Memuat riwayat pesanan..." />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => { setLoading(true); load() }} />
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="px-2 py-3 font-medium">No. Order</th>
                <th className="px-2 py-3 font-medium">Pelanggan</th>
                <th className="px-2 py-3 font-medium">No HP</th>
                <th className="px-2 py-3 font-medium">Isi Pesanan</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 text-right font-medium">Total Harga</th>
                <th className="px-2 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-2 py-4 font-semibold text-ink-strong">{order.id}</td>
                  <td className="px-2 py-4 text-gray-600">{order.customer}</td>
                  <td className="px-2 py-4 text-gray-600">{order.phone}</td>
                  <td className="px-2 py-4 text-gray-600">{order.content}</td>
                  <td className="px-2 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${adminStatusStyle[order.status]}`}
                      >
                        {adminStatusLabel[order.status]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          order.orderType === "PRODUCT" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {order.orderType === "PRODUCT" ? "Product · Refundable" : "Service · Non-refund"}
                      </span>
                      {order.refundStatus && (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${refundStatusStyle[order.refundStatus]}`}>
                          {refundStatusLabel[order.refundStatus]}
                        </span>
                      )}
                      {order.paymentStatus && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatusStyle[order.paymentStatus]}`}
                        >
                          {paymentStatusLabel[order.paymentStatus]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-4 text-right font-semibold text-ink-strong">
                    {formatIDR(order.total)}
                  </td>
                  <td className="px-2 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={"/riwayat/" + order.id} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary">
                        <Eye size={14} />
                      </Link>
                      <Link to={"/tracking/" + order.id} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary">
                        <MapPin size={14} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handlePaymentClick(order.id)}
                        disabled={checkingPayment === order.id}
                        aria-label="Buka halaman pembayaran"
                        className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary disabled:opacity-50"
                      >
                        <CreditCard size={14} />
                      </button>
                      <Link to={"/nota/" + order.id} target="blank" className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary">
                        <Receipt size={14} />
                      </Link>
                      {(order.status === "DIBATALKAN" || order.status === "SELESAI") && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(order)}
                          aria-label={`Hapus pesanan ${order.id}`}
                          className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-gray-400">
                    Tidak ada pesanan pada kategori ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3 mt-2 border-t-2 border-gray-200">
          <p className="text-sm text-gray-400">Menampilkan {filtered.length} dari {orders.length} pesanan</p>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
            <button className="h-8 w-8 rounded-lg bg-primary text-sm font-semibold text-white">1</button>
            <button className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Pesanan?"
        message={
          deleteTarget
            ? `Pesanan ${deleteTarget.id} akan dihapus permanen beserta detailnya. Tindakan ini tidak dapat dibatalkan. Yakin ingin menghapus?`
            : ""
        }
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}