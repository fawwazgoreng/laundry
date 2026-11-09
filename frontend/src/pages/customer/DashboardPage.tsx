import { useEffect, useState } from "react"
import { Scissors, Wind, Zap } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { OrderListItem, OrderStatus, User } from "../../lib/types"
import { authApi, orderApi } from "../../services/api"
import { formatDateLong } from "../../lib/utils"
import { ErrorState, LoadingState } from "../../components/ui"
import { DashboardTabs } from "./dashboard/DashboardTabs"
import { StatsCards } from "./dashboard/StatsCards"
import { SpendingTrend } from "./dashboard/SpendingTrend"
import { RecentActivity } from "./dashboard/RecentActivity"
import { ProfileSection } from "./dashboard/ProfileSection"
import { AddressSection } from "./dashboard/AddressSection"
import { Decimal } from "decimal.js"
import type { Activity, DashboardStat, HistoryRow } from "./dashboard/types"

// Ambil angka pertama dari teks satuan, misal "2 Kg" -> "2"
const parseUnits = (unitText: string): string => {
  const match = unitText.match(/(\d+(?:[.,]\d+)?)/)
  return match ? match[1].replace(",", ".") : "-"
}

// Bangun data tren pengeluaran 6 bulan terakhir dari daftar order
const buildSpendingTrend = (orders: OrderListItem[]): Array<{ month: string; value: number }> => {
  const now = new Date()
  const buckets = new Map<string, Decimal>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    buckets.set(key, new Decimal(0))
  }
  const labels = new Map<string, string>()
  for (const [key] of buckets) {
    const [y, m] = key.split("-")
    labels.set(key, `${new Date(Number(y), Number(m) - 1, 1).toLocaleString("id-ID", { month: "short" })}`)
  }
  for (const order of orders) {
    if (order.status === "DIBATALKAN") continue
    const d = new Date(order.created_at)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? new Decimal(0)).plus(order.total_amount))
  }
  return [...buckets.entries()].map(([key, value]) => ({ month: labels.get(key) ?? key, value: value.toNumber() }))
}

// Halaman pengaturan akun & aktivitas pelanggan (komposisi dari beberapa section)
export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState("ringkasan")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [orderHistory, setOrderHistory] = useState<HistoryRow[]>([])
  const [spendingTrend, setSpendingTrend] = useState<Array<{ month: string; value: number }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Muat profil pengguna & riwayat order dari backend saat halaman dibuka
  useEffect(() => {
    let mounted = true
    Promise.all([authApi.me(), orderApi.mine({ perPage: 50 })])
      .then(([me, orderPage]) => {
        if (!mounted) return
        setCurrentUser(me)
        setOrderHistory(
          orderPage.data.map((o: OrderListItem) => ({
            id: o.order_id,
            serviceName: o.items_summary,
            weightKg: parseUnits(o.items_unit),
            createdAt: formatDateLong(o.created_at),
            status: o.status as OrderStatus,
            total: o.total_amount,
          })),
        )
        setSpendingTrend(buildSpendingTrend(orderPage.data))
      })
      .catch((err) => {
        if (!mounted) return
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Ringkasan statistik yang dihitung dari riwayat order
  const stats: DashboardStat[] = [
    {
      label: "Total Pengeluaran",
      value: formatIDR(orderHistory.filter((o) => o.status !== "DIBATALKAN").reduce((sum, o) => sum.plus(o.total), new Decimal(0)).toNumber()),
      icon: Wind,
    },
    {
      label: "Total Order",
      value: String(orderHistory.length),
      icon: Zap,
    },
    {
      label: "Pesanan Berjalan",
      value: String(orderHistory.filter((o) => o.status === "DIPROSES").length),
      icon: Scissors,
    },
    {
      label: "Pesanan Selesai",
      value: String(orderHistory.filter((o) => o.status === "SELESAI").length),
      icon: Zap,
    },
  ]

  // Aktivitas terbaru diambil dari 6 order pertama
  const recentActivity: Activity[] = orderHistory.slice(0, 6).map((o) => ({
    id: o.id,
    title: o.serviceName,
    date: o.createdAt,
    price: o.total,
  }))

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Pengaturan akun &amp; aktivitas pelanggan</h1>
        <p className="text-sm text-gray-500">Kelola profil, alamat, dan lihat riwayat pesanan laundry Anda.</p>
      </div>

      <DashboardTabs active={activeTab} onSelect={setActiveTab} />
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          <StatsCards stats={stats} />
          <SpendingTrend data={spendingTrend} />
          <RecentActivity items={recentActivity} />
        </>
      )}

      <div className="mt-20 mb-10">
        <h1 className="text-2xl font-bold text-ink-strong">Profil &amp; Keamanan akun</h1>
        <p className="text-sm text-gray-500">Kelola informasi pribadi dan kata sandi akun Anda.</p>
      </div>

      <ProfileSection user={currentUser} />

      <AddressSection />

    </div>
  )
}