import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PackageOpen, Printer, ShoppingBag, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { adminStatusLabel, adminStatusStyle } from "../../lib/orderStatus"
import { buildMonthlySeries, filterByRange, formatShortDate, resolveReportRange, summarizeCashflow, toDateInputValue } from "../../lib/report"
import type { LowStockItem, MonthlyPoint, ReportRangeMode } from "../../lib/report"
import { formatIDR } from "../../lib/format"
import type { CashflowItem, OrderListItem, OrderStatus } from "../../lib/types"
import { adminApi, orderApi } from "../../services/api"

const RANGE_PRESETS = [
  { months: 1, label: "1 Bulan" },
  { months: 2, label: "2 Bulan" },
  { months: 3, label: "3 Bulan" },
  { months: 6, label: "6 Bulan" },
  { months: 12, label: "1 Tahun" },
]

interface StatCardData {
  label: string
  value: string
  icon: typeof TrendingUp
  colorClass: string
}

interface CashflowRow {
  id: number
  date: string
  category: string
  description: string
  type: "income" | "expense"
  amount: number
}

export function AdminReportPage() {
  const navigate = useNavigate()
  const [months, setMonths] = useState<number>(1)
  const [rangeMode, setRangeMode] = useState<ReportRangeMode>("preset")
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return toDateInputValue(d)
  })
  const [customEnd, setCustomEnd] = useState<string>(() => toDateInputValue(new Date()))

  const [cashflowItems, setCashflowItems] = useState<CashflowItem[]>([])
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([adminApi.cashflow(), orderApi.list({ perPage: 200 }), adminApi.stats()])
      .then(([cash, orderPage, adminStats]) => {
        setCashflowItems(cash.items)
        setOrders(orderPage.data)
        setLowStock(adminStats.low_stock_products.slice(0, 5))
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data laporan")
      })
      .finally(() => setLoading(false))
  }, [months])

  // Rentang waktu aktif: preset bulan terakhir, atau pilihan custom dari/sampai
  const windowRange = useMemo(
    () => resolveReportRange(rangeMode, months, customStart, customEnd),
    [rangeMode, months, customStart, customEnd],
  )

  const periodCashflow = useMemo(() => filterByRange(cashflowItems, windowRange), [cashflowItems, windowRange])
  const { income: totalIncome, expense: totalExpense, balance: netBalance } = useMemo(
    () => summarizeCashflow(periodCashflow),
    [periodCashflow],
  )
  const periodOrders = useMemo(() => filterByRange(orders, windowRange), [orders, windowRange])
  const monthlyData: MonthlyPoint[] = useMemo(
    () => buildMonthlySeries(periodCashflow, windowRange),
    [periodCashflow, windowRange],
  )

  const statCards: StatCardData[] = [
    { label: "Pendapatan", value: `+ ${formatIDR(totalIncome)}`, icon: TrendingUp, colorClass: "bg-red-100 text-red-600" },
    { label: "Pengeluaran", value: `- ${formatIDR(totalExpense)}`, icon: TrendingDown, colorClass: "bg-emerald-100 text-emerald-600" },
    { label: "Saldo Bersih", value: formatIDR(netBalance), icon: Wallet, colorClass: "bg-blue-100 text-blue-600" },
    { label: "Jumlah Pesanan", value: `${periodOrders.length} Pesanan`, icon: ShoppingBag, colorClass: "bg-gray-100 text-gray-600" },
  ]

  // Rincian arus kas periode (urutan terbaru ke terlama, maks. 12 baris)
  const cashflowRows: CashflowRow[] = periodCashflow
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12)
    .map((it) => ({
      id: it.id,
      date: formatShortDate(it.created_at),
      category: it.category,
      description: it.description,
      type: it.type,
      amount: it.amount,
    }))

  // Cetak diarahkan ke halaman Nota Laporan (/laporan/nota) yang membawa data hasil filter ini,
  // supaya yang tercetak adalah dokumen lengkap, bukan sekadar potongan tabel di layar.
  const handlePrint = () => {
    navigate("/laporan/nota", {
      state: {
        periodStart: windowRange.start.getTime(),
        periodEnd: windowRange.end.getTime(),
        cashflow: periodCashflow,
        lowStock,
        autoPrint: true,
      },
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-2 py-8 sm:px-6">
      {/* Header cetak (khusus tampilan print) */}
      <div className="hidden print:block space-y-1 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-ink-strong">Laporan Fadarosi</h1>
        <p className="mt-1 text-sm text-gray-600">
          Periode: {formatShortDate(windowRange.start)} s/d {formatShortDate(windowRange.end)}
        </p>
        <p className="text-xs text-gray-400">Dicetak pada {formatShortDate(new Date())}</p>
      </div>

      {loadError && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {loadError}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-ink-strong">Laporan Fadarosi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ringkasan pendapatan, pengeluaran, dan transaksi pada rentang waktu terpilih.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.months}
              onClick={() => {
                setMonths(preset.months)
                setRangeMode("preset")
              }}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${rangeMode === "preset" && months === preset.months
                  ? "bg-primary text-white shadow-sm"
                  : "border border-gray-200 bg-white text-ink hover:bg-gray-50"
                }`}
            >
              {preset.label}
            </button>
          ))}
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink">
              <span className="font-medium text-gray-500">Dari</span>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => {
                  setCustomStart(e.target.value)
                  setRangeMode("custom")
                }}
                className="cursor-pointer text-sm text-ink focus:outline-none"
              />
            </label>
            <span className="text-sm text-gray-400">s/d</span>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink">
              <span className="font-medium text-gray-500">Sampai</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => {
                  setCustomEnd(e.target.value)
                  setRangeMode("custom")
                }}
                className="cursor-pointer text-sm text-ink focus:outline-none"
              />
            </label>
          </div>
          <button
            onClick={handlePrint}
            disabled={loading}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors enabled:cursor-pointer enabled:hover:bg-ink-strong disabled:cursor-not-allowed disabled:opacity-50"
            title={loading ? "Memuat data laporan..." : "Cetak / simpan laporan sebagai PDF"}
          >
            <span className="inline-flex items-center gap-1.5">
              <Printer size={15} />
              Cetak Laporan
            </span>
          </button>
        </div>
      </div>

      <p className="-mt-2 text-xs font-medium text-gray-400 print:hidden">
        Periode: {formatShortDate(windowRange.start)} s/d {formatShortDate(windowRange.end)}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Pendapatan vs Pengeluaran (per Bulan)</h2>
          <div className="h-64 print:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(value) => formatIDR(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Pendapatan" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="expense" name="Pengeluaran" fill="#9ca3af" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Widget peringatan stok menipis */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-strong">Stok Menipis Alert</h2>
            <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
              {lowStock.length} Produk
            </span>
          </div>
          <div className="space-y-4">
            {lowStock.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <PackageOpen size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-strong">{item.name}</p>
                  <p className={`text-xs font-medium ${item.stock === 0 ? "text-primary" : "text-gray-400"}`}>
                    {item.stock === 0 ? "Stok habis" : `Sisa ${item.stock} Pcs`}
                  </p>
                </div>
              </div>
            ))}
            {lowStock.length === 0 && <p className="text-sm text-gray-400">Tidak ada peringatan stok.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tabel rincian arus kas periode */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-strong">Rincian Arus Kas</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
              {periodCashflow.length} Transaksi
            </span>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[480px] text-left text-sm print:min-w-0">
              <thead>
                {/* Baris header kolom tabel arus kas */}
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="pb-2 font-medium">Tanggal</th>
                  <th className="pb-2 font-medium">Kategori</th>
                  <th className="pb-2 font-medium">Keterangan</th>
                  <th className="pb-2 font-medium">Tipe</th>
                  <th className="pb-2 text-right font-medium">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {/* Render setiap transaksi arus kas pada periode */}
                {cashflowRows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-gray-600">{row.date}</td>
                    <td className="py-3 font-medium text-ink-strong">{row.category}</td>
                    <td className="py-3 text-gray-600">{row.description}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                          }`}
                      >
                        {row.type === "income" ? "Masuk" : "Keluar"}
                      </span>
                    </td>
                    <td className={`py-3 text-right font-semibold ${row.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                      {row.type === "income" ? "+" : "-"} {formatIDR(row.amount)}
                    </td>
                  </tr>
                ))}
                {cashflowRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-strong">Pesanan dalam Periode</h2>
            <Link to="/admin/pesanan" className="cursor-pointer text-xs font-semibold text-primary hover:underline print:hidden">
              Kelola Semua
            </Link>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[480px] text-left text-sm print:min-w-0">
              <thead>
                {/* Baris header kolom tabel pesanan */}
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="pb-2 font-medium">No. Order</th>
                  <th className="pb-2 font-medium">Pelanggan</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {periodOrders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 font-medium text-ink-strong">{order.order_id}</td>
                    <td className="py-3 text-gray-600">{order.customer_name}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${adminStatusStyle[order.status as OrderStatus]}`}
                      >
                        {adminStatusLabel[order.status as OrderStatus]}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold text-ink-strong">{formatIDR(order.total_amount)}</td>
                  </tr>
                ))}
                {periodOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                      Tidak ada pesanan pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}