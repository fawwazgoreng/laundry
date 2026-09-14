import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { LayoutGrid, User as UserIcon, MapPin, History, Lock, Wind, Zap, Scissors, House, LocateFixed, Trash, Edit } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { Address, OrderListItem, OrderStatus, User } from "../../lib/types"
import { authApi, addressApi, orderApi } from "../../services/api"
import { formatDateLong } from "../../lib/utils"
import { HashLink } from "react-router-hash-link"
import { FloatingInput } from "../../components/FloatingInput"
import { MapClickPicker } from "../../components/mapClickPicker"
import { useGeolocation } from "../../lib/useGeoLocation"
import { reverseGeocode } from "../../lib/geoCode"

const tabs = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutGrid, src: "#ringkasan" },
  { key: "profil", label: "Profil", icon: UserIcon, src: "#profil" },
  { key: "alamat", label: "Alamat", icon: MapPin, src: "#alamat" },
  { key: "history", label: "History", icon: History, src: "#history" },
]

const statusStyle: Record<OrderStatus, string> = {
  BARU: "bg-blue-100 text-blue-700",
  DITERIMA: "bg-amber-100 text-amber-700",
  DIPROSES: "bg-orange-100 text-orange-700",
  SIAP_ANTAR: "bg-purple-100 text-purple-700",
  SELESAI: "bg-green-100 text-green-700",
  DIBATALKAN: "bg-gray-100 text-gray-500",
}

const statusLabel: Record<OrderStatus, string> = {
  BARU: "Baru",
  DITERIMA: "Diterima",
  DIPROSES: "Diproses",
  SIAP_ANTAR: "Siap Antar",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
}

interface DashboardStat {
  label: string
  value: string
  icon: any
}

interface AddressInput {
  label: string
  value: string | number
}

interface Activity {
  id: string
  title: string
  date: string
  price: number
}

interface CustomerAddress {
  id: number
  label: string
  isPrimary: boolean
  fullAddress: string
  recipientName: string
  phone: string
}

interface HistoryRow {
  id: string
  serviceName: string
  weightKg: string
  createdAt: string
  status: OrderStatus
  total: number
}

function parseUnits(unitText: string): string {
  const match = unitText.match(/(\d+(?:[.,]\d+)?)/)
  return match ? match[1].replace(",", ".") : "-"
}

function buildSpendingTrend(orders: OrderListItem[]): Array<{ month: string; value: number }> {
  const now = new Date()
  const buckets = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    buckets.set(key, 0)
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
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + order.total_amount)
  }
  return [...buckets.entries()].map(([key, value]) => ({ month: labels.get(key) ?? key, value }))
}

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState("ringkasan")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [orderHistory, setOrderHistory] = useState<HistoryRow[]>([])
  const [addressInput, setAddressInput] = useState<AddressInput[]>([]);
  const [spendingTrend, setSpendingTrend] = useState<Array<{ month: string; value: number }>>([])
  const userSetting = [
    { label: "Username", value: currentUser?.username },
    { label: "Email", value: currentUser?.email },
    { label: "Nomor Hp", value: currentUser?.phone },
    { label: "Bergabung Pada", value: currentUser?.created_at },
  ]

  const [coords, setCoords] = useState({ lat: -6.496861119036644, lng: 110.90468997753888 })
  setAddressInput([
    { label: "Label Lokasi", value: "" },
    { label: "koordinat", value: `${coords.lat} ${coords.lng}` },
    { label: "latitude", value: coords.lat },
    { label: "longitude", value: coords.lng },
    { label: "Detail Lokasi", value: "" },
  ])
  const [address, setAddress] = useState<string>("")
  const [loadingAddress, setLoadingAddress] = useState(false)
  const { locate, loading: loadingGps } = useGeolocation()

  async function lookupAddress(lat: number, lng: number) {
    setLoadingAddress(true)
    try {
      const result = await reverseGeocode(lat, lng)
      setAddress(result.displayName)
    } catch {
      setAddress("Alamat tidak ditemukan")
    } finally {
      setLoadingAddress(false)
    }
  }

  async function deleteAddress(id: string) {
    setAddresses(addresses.filter((add) => add.id != id));
  } 

  async function editAddress (value: any) {

  }

  function handleMapPick(next: { lat: number; lng: number }) {
    setCoords(next)
    lookupAddress(next.lat, next.lng)
  }

  function handleUseMyLocation() {
    locate()
  }

  useEffect(() => {
    let mounted = true
    Promise.all([authApi.me(), addressApi.list(), orderApi.mine({ perPage: 50 })])
      .then(([me, addrList, orderPage]) => {
        if (!mounted) return
        setCurrentUser(me)
        setAddresses(
          addrList.map((a: Address) => ({
            id: a.id,
            label: a.label,
            isPrimary: a.is_primary,
            fullAddress: a.address_text,
            recipientName: me.username,
            phone: me.phone,
          })),
        )
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
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [])

  const stats: DashboardStat[] = [
    {
      label: "Total Pengeluaran",
      value: formatIDR(orderHistory.reduce((sum, o) => sum + o.total, 0)),
      icon: Wind
    },
    {
      label: "Total Order",
      value: String(orderHistory.length),
      icon: Zap
    },
    {
      label: "Pesanan Berjalan",
      value: String(orderHistory.filter((o) => o.status === "DIPROSES").length),
      icon: Scissors
    },
    {
      label: "Pesanan Selesai",
      value: String(orderHistory.filter((o) => o.status === "SELESAI").length),
      icon: Zap
    },
  ]

  const recentActivity: Activity[] = orderHistory.slice(0, 6).map((o) => ({
    id: o.id,
    title: o.serviceName,
    date: o.createdAt,
    price: o.total,
  }))

  const avatarUrl =
    currentUser?.username
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username)}&background=dc2626&color=fff&size=128`
      : undefined

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Pengaturan akun &amp; aktivitas pelanggan</h1>
        <p className="text-sm text-gray-500">Kelola profil, alamat, dan lihat riwayat pesanan laundry Anda.</p>
      </div>

      <div className="flex gap-2 border-gray-200" id="ringkasan">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <HashLink to={tab.src}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${isActive
                ? "bg-primary text-white "
                : "border-transparent text-ink bg-white hover:text-ink-strong"
                }`}
            >
              <Icon size={20} />
              {tab.label}
            </HashLink>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5">
            <span className="flex w-9 h-9 p-2 text-lg mb-2 bg-gray-200 text-ink rounded-lg items-center justify-center">
              <stat.icon></stat.icon>
            </span>
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
              <Tooltip formatter={(value) => [formatIDR(Number(value)), "Pengeluaran"]} />
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
                <p className="text-xs text-gray-400">{item.id} - {item.date}</p>
              </div>
              <p className="text-sm font-bold text-ink-strong">{formatIDR(item.price)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20 mb-10">
        <h1 className="text-2xl font-bold text-ink-strong">Profil &amp; Keamanan akun</h1>
        <p className="text-sm text-gray-500">Kelola informasi pribadi dan kata sandi akun Anda.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" id="profil">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {currentUser && (
            <>
              <div className="mt-5 flex flex-col items-center gap-4">
                <img
                  src={avatarUrl}
                  alt={currentUser.username}
                  className="h-30 w-30 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-[18px] text-center text-ink-strong">{currentUser.username}</p>
                  <p className="text-[14px] text-center text-gray-400">{currentUser.email}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 font-semibold">
                <div className="self-center col-span-1 mx-auto">
                  <p className="text-xs text-gray-400">Bergabung sejak</p>
                  <p className="text-sm font-medium text-ink-strong">{currentUser.created_at ? formatDateLong(currentUser.created_at) : "-"}</p>
                </div>
                <div className="self-center col-span-1 mx-auto">
                  <p className="text-xs text-gray-400">Nomor Hp</p>
                  <p className="text-sm font-medium text-ink-strong">{currentUser.phone}</p>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {currentUser && (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {userSetting.map((setting, idx) => (
                  <FloatingInput key={idx}
                    label={setting.label}
                    value={setting.value}
                    // onChange={(e) => setPhone(e.target.value)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="mt-5 flex gap-3 items-end justify-end">
            <button className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark">
              Simpan
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-ink hover:bg-gray-50">
              <Lock size={13} /> Ubah Sandi
            </button>
          </div>
        </div>
      </div>

      <div className="mt-20 mb-10">
        <p className="text-lg text-primary font-semibold">Lokais</p>
        <h1 className="text-2xl font-bold text-ink-strong">Alamat &amp; Titik penjemputan</h1>
        <p className="text-sm text-gray-500">Atur lokasi rumah dan kantor untuk penjemputan laundry.</p>
      </div>

      <div className="rounded-2xl" id="alamat">
        <div className="mt-4 space-y-3">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`rounded-xl bg-white border-t-4 border-r-4 p-4 border-r-primary border-t-primary
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-gray-200 rounded-xl w-9 h-9 flex items-center justify-center ">
                    <House size={20} className="text-primary" />
                  </span>
                  <p className="text-sm font-semibold text-ink-strong">{addr.label}</p>
                </div>
                <span className="flex gap-4">
                  <span className="w-9 h-9 bg-gray-200 text-ink rounded-lg p-2" onClick={() => deleteAddress(addr.id)}>
                    <Trash></Trash>
                  </span>
                  <span className="w-9 h-9 bg-gray-200 text-ink rounded-lg p-2" onClick={() => editAddress()}>
                    <Edit></Edit>
                  </span>
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{addr.fullAddress}</p>
              <span className="w-full h-2 bg-gray-200"></span>
              {/* <p className="mt-1 text-xs text-gray-400">
                {addr.recipientName} • {addr.phone}
              </p> */}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white" id="alamat">
        <div className="mt-4 space-y-3">
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Atur Lokasi</h2>
              <button
                onClick={handleUseMyLocation}
                disabled={loadingGps}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gray-50"
              >
                <LocateFixed size={14} />
                {loadingGps ? "Mencari..." : "Gunakan Lokasi Saya"}
              </button>
            </div>

            <div>
              <MapClickPicker defaultCenter={coords} onChange={handleMapPick} />
              <div>
                {addressInput.map((add, idx) => (
                  <FloatingInput key={idx}
                    label={add.label}
                    value={add.value}
                    // onChange={(e) => setPhone(e.target.value)}
                  />))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6" id="history">
        <h2 className="text-sm font-semibold text-ink-strong">Riwayat Pesanan</h2>
        <p className="text-xs text-gray-400">Lihat seluruh pesanan yang pernah dibuat.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
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