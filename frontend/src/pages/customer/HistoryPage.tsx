import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CreditCard, Eye, MapPin, Receipt, Search } from "lucide-react"
import { adminStatusLabel, adminStatusStyle } from "../../lib/orderStatus"
import { formatIDR } from "../../lib/format"
import type { OrderListItem, OrderStatus, Payment } from "../../lib/types"
import { orderApi, paymentApi } from "../../services/api"
import { useToast } from "../../components/Toast"
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
]

interface AdminOrderRow {
  id: string
  customer: string
  phone: string
  content: string
  quantity: string
  status: OrderStatus
  total: number
}

export function UserOrderHistory() {
  const navigate = useNavigate()
  const { error: toastError } = useToast()
  const [activeTab, setActiveTab] = useState("semua")
  const [search, setSearch] = useState("")
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [checkingPayment, setCheckingPayment] = useState<string | null>(null)

  const load = () =>
    orderApi
      .list({ perPage: 100 })
      .then((page) =>
        setOrders(
          page.data.map((o: OrderListItem) => ({
            id: o.order_id,
            customer: o.customer_name,
            phone: o.customer_phone,
            content: o.items_summary,
            quantity: o.items_unit,
            status: o.status,
            total: o.total_amount,
          })),
        ),
      )
      .catch(() => undefined)

  useEffect(() => {
    load()
  }, [])

  // Buka halaman pembayaran hanya bila pesanan masih punya pembayaran yang belum kedaluwarsa
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

  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: orders.length }
    for (const tab of tabs.slice(1)) c[tab.key] = 0
    for (const o of orders) {
      if (o.status === "DITERIMA") c.diterima++
      if (o.status === "DIPROSES") c.diproses++
      if (o.status === "SIAP_ANTAR") c.siap_antar++
      if (o.status === "SELESAI") c.selesai++
    }
    return c
  }, [orders])

  const filtered = useMemo(() => {
    let list = orders
    if (activeTab === "diterima") list = list.filter((o) => o.status === "DITERIMA")
    if (activeTab === "diproses") list = list.filter((o) => o.status === "DIPROSES")
    if (activeTab === "siap_antar") list = list.filter((o) => o.status === "SIAP_ANTAR")
    if (activeTab === "selesai") list = list.filter((o) => o.status === "SELESAI")
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((o) => o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q))
    }
    return list
  }, [orders, activeTab, search])

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
            className="w-full rounded-xl border bg-white border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
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
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${adminStatusStyle[order.status]}`}
                    >
                      {adminStatusLabel[order.status]}
                    </span>
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
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
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
      </div>

    </div>
  )
}