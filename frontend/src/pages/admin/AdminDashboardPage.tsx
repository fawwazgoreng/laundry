import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts"
import { Award, Box, ShoppingBag, Zap } from "lucide-react"
import { adminStatusLabel, adminStatusStyle } from "../../lib/orderStatus"
import { formatIDR } from "../../lib/format"
import type { Money, OrderListItem, OrderStatus } from "../../lib/types"
import { moneyToNumber } from "../../lib/utils"
import { adminApi, orderApi } from "../../services/api"
import { ErrorState, LoadingState } from "../../components/ui"


const statIcons = [ShoppingBag, Award, Box, Zap]

interface StatCard {
  label: string
  value: string
  bg: string
  text: string
  colorClass: string
}

interface AdminOrderRow {
  id: string
  customer: string
  content: string
  status: OrderStatus
  total: Money
}

interface LowStockItem {
  name: string
  critical: boolean
  info: string
}

const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

export function AdminDashboardPage() {
  const [adminDashboardStats, setAdminDashboardStats] = useState<StatCard[]>([])
  const [adminOrders, setAdminOrders] = useState<AdminOrderRow[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockItem[]>([])
  const [weeklyRevenue, setWeeklyRevenue] = useState<Array<{ day: string; value: number }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([adminApi.stats(), orderApi.list({ perPage: 5 })])
      .then(([stats, page]) => {
        setAdminDashboardStats([
          { label: "Pesanan Hari Ini", value: String(stats.orders_today), bg: "#FEE2E2", text: "#DC2626", colorClass: "bg-red-100 text-red-600" },
          { label: "Pendapatan Hari Ini", value: formatIDR(stats.revenue_today), bg: "#D1FAE5", text: "#10B981", colorClass: "bg-emerald-100 text-emerald-600" },
          { label: "Laundry Diproses", value: String(stats.laundry_in_progress), bg: "#DBEAFE", text: "#3B82F6", colorClass: "bg-blue-100 text-blue-600" },
          { label: "Produk Terjual", value: String(stats.products_sold), bg: "#F9FAFB", text: "#374151", colorClass: "bg-gray-100 text-gray-600" },
        ])
        setAdminOrders(
          page.data.map((o: OrderListItem) => ({
            id: o.order_id,
            customer: o.customer_name,
            content: o.items_summary,
            status: o.status as OrderStatus,
            total: o.total_amount,
          })),
        )
        setLowStockAlerts(
          stats.low_stock_products
            .slice(0, 5)
            .map((p) => ({
              name: p.name,
              critical: p.stock === 0,
              info: p.stock === 0 ? "Stok habis" : `Sisa ${p.stock} Pcs`,
            })),
        )
        setWeeklyRevenue(
          stats.weekly_revenue.map((r, idx) => ({
            day: dayLabels[idx] ?? r.date,
            value: moneyToNumber(r.total),
          })),
        )
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data dashboard")
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 2xl:max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Ringkasan Bisnis Fadarosi</h1>
        <p className="text-sm text-gray-500">
          Pantau performa outlet laundry, pendapatan harian, dan pengelolaan operasional Anda.
        </p>
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} />
      ) : (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminDashboardStats.map((stat, idx) => {
          const Icon = statIcons[idx]
          return (
            <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.colorClass}`}>
                <Icon size={20} />
              </span>
              <div>
                <p className="text-xs text-gray-400">{stat.label}</p>
                <p className="text-lg font-bold text-ink-strong">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:grid-rows-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2 row-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-strong">Pesanan Terbaru</h2>
            <Link to="/admin/pesanan" className="text-xs font-semibold text-primary hover:underline">
              Kelola Semua
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="pb-2 font-medium">No. Order</th>
                  <th className="pb-2 font-medium">Pelanggan</th>
                  <th className="pb-2 font-medium">Layanan</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {adminOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 font-medium text-ink-strong">{order.id}</td>
                    <td className="py-3 text-gray-600">{order.customer}</td>
                    <td className="py-3 text-gray-600">{order.content}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${adminStatusStyle[order.status]}`}
                      >
                        {adminStatusLabel[order.status]}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold text-ink-strong">
                      {formatIDR(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1 row-span-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Ringkasan Pendapatan (Mingguan)</h2>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyRevenue}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Stok Menipis Alert</h2>
              <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
                {lowStockAlerts.length} Produk
              </span>
            </div>
            <div className="space-y-4">
              {lowStockAlerts.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <Zap size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-strong">{item.name}</p>
                    <p className={`text-xs font-medium ${item.critical ? "text-primary" : "text-gray-400"}`}>
                      {item.info}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}