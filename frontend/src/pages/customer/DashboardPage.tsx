import { useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { LayoutGrid, User as UserIcon, MapPin, History, Lock, MapPinned } from "lucide-react"
import {
  currentUser,
  dashboardStats,
  spendingTrend,
  recentActivity,
  addresses,
  orderHistory,
} from "../lib/mockData"
import { formatIDR } from "../lib/format"
import type { OrderStatus } from "../lib/types"

const tabs = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutGrid },
  { key: "profil", label: "Profil", icon: UserIcon },
  { key: "alamat", label: "Alamat", icon: MapPin },
  { key: "history", label: "History", icon: History },
]

const statusStyle: Record<OrderStatus, string> = {
  menunggu_pembayaran: "bg-amber-100 text-amber-700",
  diterima: "bg-amber-100 text-amber-700",
  dicuci: "bg-blue-100 text-blue-700",
  disetrika: "bg-blue-100 text-blue-700",
  siap_antar: "bg-purple-100 text-purple-700",
  selesai: "bg-green-100 text-green-700",
  dibatalkan: "bg-gray-100 text-gray-500",
}

const statusLabel: Record<OrderStatus, string> = {
  menunggu_pembayaran: "Menunggu Bayar",
  diterima: "Diterima",
  dicuci: "Dicuci",
  disetrika: "Disetrika",
  siap_antar: "Siap Antar",
  selesai: "Selesai",
  dibatalkan: "Batal",
}

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState("ringkasan")

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Pengaturan akun &amp; aktivitas pelanggan</h1>
        <p className="text-sm text-gray-500">Kelola profil, alamat, dan lihat riwayat pesanan laundry Anda.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-ink-strong"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className="mt-2 text-lg font-bold text-ink-strong">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-ink-strong">Tren Pengeluaran</h2>
        <p className="text-xs text-gray-400">6 bulan terakhir</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spendingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`Rp ${v}00.000`, "Pengeluaran"]} />
              <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-ink-strong">Aktivitas Terkini</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {recentActivity.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-ink-strong">{item.title}</p>
                <p className="text-xs text-gray-400">{item.date}</p>
              </div>
              <p className="text-sm font-bold text-ink-strong">{formatIDR(item.price)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink-strong">Profil &amp; Keamanan akun</h2>
          <p className="text-xs text-gray-400">Kelola informasi pribadi dan kata sandi akun Anda.</p>
          <div className="mt-5 flex items-center gap-4">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.username}
              className="h-16 w-16 rounded-full object-cover"
            />
            <div>
              <p className="font-semibold text-ink-strong">{currentUser.username}</p>
              <p className="text-xs text-gray-400">{currentUser.email}</p>
              <p className="mt-1 text-xs text-gray-400">
                Bergabung sejak {currentUser.memberSince} • {currentUser.totalOrders} Transaksi
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-400">Nomor telepon</p>
              <p className="text-sm font-medium text-ink-strong">{currentUser.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-sm font-medium text-ink-strong">{currentUser.email}</p>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark">
              Simpan
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-ink hover:bg-gray-50">
              <Lock size={13} /> Ubah Sandi
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink-strong">Alamat &amp; Titik penjemputan</h2>
          <p className="text-xs text-gray-400">Atur lokasi rumah dan kantor untuk penjemputan laundry.</p>
          <div className="mt-4 space-y-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`rounded-xl border p-4 ${
                  addr.isPrimary ? "border-primary" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPinned size={16} className="text-primary" />
                    <p className="text-sm font-semibold text-ink-strong">{addr.label}</p>
                  </div>
                  <button className="text-xs font-medium text-primary hover:underline">Edit</button>
                </div>
                <p className="mt-2 text-xs text-gray-500">{addr.fullAddress}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {addr.recipientName} • {addr.phone}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-ink-strong">Riwayat Pesanan</h2>
        <p className="text-xs text-gray-400">Lihat seluruh pesanan yang pernah dibuat.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="py-2 font-medium">No. Order</th>
                <th className="py-2 font-medium">Layanan/Produk</th>
                <th className="py-2 font-medium">Quantity</th>
                <th className="py-2 font-medium">Tanggal</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderHistory.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 font-medium text-ink-strong">{order.id}</td>
                  <td className="py-3 text-gray-600">{order.serviceName}</td>
                  <td className="py-3 text-gray-600">{order.weightKg} kg</td>
                  <td className="py-3 text-gray-600">{order.createdAt}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[order.status]}`}
                    >
                      {statusLabel[order.status]}
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
    </div>
  )
}
