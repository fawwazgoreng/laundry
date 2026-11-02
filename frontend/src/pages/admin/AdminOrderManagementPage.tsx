import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CreditCard, Eye, MapPin, Receipt, Search, Trash2 } from "lucide-react"
import { adminStatusLabel, adminStatusStyle, paymentStatusLabel, paymentStatusStyle } from "../../lib/orderStatus"
import { formatIDR } from "../../lib/format"
import type { OrderListItem, OrderStatus, Payment } from "../../lib/types"
import { orderApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { useToast } from "../../components/Toast"
import { ConfirmDialog } from "../../components/ConfirmDialog"
import { ErrorState, LoadingState } from "../../components/ui"
import { Link } from "react-router-dom"

const tabs = [
  { key: "semua", label: "Semua" },
  { key: "diterima", label: "Diterima" },
  { key: "diproses", label: "Diproses" },
  { key: "siap_antar", label: "Siap Antar" },
  { key: "selesai", label: "Selesai" },
  { key: "dibatalkan", label: "Dibatalkan" },
]

const statusOrder: OrderStatus[] = ["BARU", "DITERIMA", "DIPROSES", "SIAP_ANTAR", "SELESAI"]

interface AdminOrderRow {
  id: string
  customerId: string
  customer: string
  phone: string
  content: string
  quantity: string
  status: OrderStatus
  paymentStatus: Payment["status"] | null
  total: number
}

export function AdminOrderManagementPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [activeTab, setActiveTab] = useState("semua")
  const [search, setSearch] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [statusTarget, setStatusTarget] = useState<{ order: AdminOrderRow; next: OrderStatus } | null>(null)
  const [updating, setUpdating] = useState(false)
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
            customerId: o.customer_id,
            customer: o.customer_name,
            phone: o.customer_phone,
            content: o.items_summary,
            quantity: o.items_unit,
            status: o.status,
            paymentStatus: o.payment_status,
            total: o.total_amount,
          })),
        )
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat daftar pesanan")
      })
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

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

  const filtered = useMemo(() => {
    let list = orders
    if (activeTab === "diterima") list = list.filter((o) => o.status === "DITERIMA")
    if (activeTab === "diproses") list = list.filter((o) => o.status === "DIPROSES")
    if (activeTab === "siap_antar") list = list.filter((o) => o.status === "SIAP_ANTAR")
    if (activeTab === "selesai") list = list.filter((o) => o.status === "SELESAI")
    if (activeTab === "dibatalkan") list = list.filter((o) => o.status === "DIBATALKAN")
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((o) => o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q))
    }
    if (customerFilter.trim()) {
      const q = customerFilter.trim().toLowerCase()
      list = list.filter(
        (o) => o.customer.toLowerCase().includes(q) || o.customerId.toLowerCase().includes(q),
      )
    }
    return list
  }, [orders, activeTab, search, customerFilter])

  // Buka pop-up konfirmasi sebelum status pesanan diubah ke tahap berikutnya
  function handleAdvance(order: AdminOrderRow) {
    const current = statusOrder.indexOf(order.status)
    const next = statusOrder[current + 1]
    if (!next) return
    setStatusTarget({ order, next })
  }

  // Jalankan perubahan status pesanan setelah dikonfirmasi admin
  async function confirmStatusChange() {
    if (!statusTarget) return
    setUpdating(true)
    try {
      await orderApi.updateStatus(statusTarget.order.id, statusTarget.next)
      toastSuccess(
        `Status ${statusTarget.order.id} diubah menjadi "${adminStatusLabel[statusTarget.next]}"`,
      )
      setStatusTarget(null)
      await load()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal mengubah status pesanan")
    } finally {
      setUpdating(false)
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
      toastError(err instanceof ApiError ? err.message : "Gagal menghapus pesanan")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Manajemen Pesanan</h1>
        <p className="text-sm text-gray-500">Kelola antrean laundry, update status proses pencucian, dan kasir manual.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${isActive
                ? "border-primary bg-primary text-white"
                : "border-gray-200 bg-white text-ink hover:bg-gray-50"
                }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
              >
                {counts[tab.key] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor order atau nama pelanggan..."
            className="w-full rounded-xl bg-white border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            placeholder="Filter pelanggan: username / ID..."
            className="w-full rounded-xl bg-white border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2">
        {loading ? (
          <LoadingState message="Memuat daftar pesanan..." />
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
                <th className="px-2 py-3 font-medium">Satuan</th>
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
                  <td className="px-2 py-4 text-gray-600">{order.quantity}</td>
                  <td className="px-2 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${adminStatusStyle[order.status]}`}
                      >
                        {adminStatusLabel[order.status]}
                      </span>
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
                      <Link to={"/admin/riwayat/" + order.id} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary">
                        <Eye size={14} />
                      </Link>
                      <Link to={"/admin/tracking/" + order.id} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary">
                        <MapPin size={14} />
                      </Link>
                      <Link to={"/payment/" + order.id} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary">
                        <CreditCard size={14} />
                      </Link>
                      <Link to={"/nota/" + order.id} target="blank" className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-primary">
                        <Receipt size={14} />
                      </Link>
                      {order.status === "DIBATALKAN" || order.status === "SELESAI" ? (
                        <button
                          onClick={() => setDeleteTarget(order)}
                          aria-label={`Hapus pesanan ${order.id}`}
                          className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={13} /> Hapus
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAdvance(order)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-ink hover:bg-gray-50"
                        >
                          Ubah Status
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
                    {customerFilter.trim()
                      ? `Tidak ada pelanggan dengan username / ID "${customerFilter.trim()}".`
                      : "Tidak ada pesanan pada kategori ini."}
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


      {/* Konfirmasi khusus sebelum status pesanan diubah */}
      <ConfirmDialog
        open={statusTarget !== null}
        title="Konfirmasi Ubah Status"
        message={
          statusTarget
            ? `Status pesanan ${statusTarget.order.id} akan diubah dari "${adminStatusLabel[statusTarget.order.status]}" menjadi "${adminStatusLabel[statusTarget.next]}". Lanjutkan?`
            : ""
        }
        confirmLabel="Ubah Status"
        cancelLabel="Batal"
        loading={updating}
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />

      {/* Konfirmasi sebelum pesanan yang sudah dibatalkan dihapus permanen */}
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