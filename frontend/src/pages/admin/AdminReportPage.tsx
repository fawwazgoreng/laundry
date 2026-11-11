import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PackageOpen, Printer, ShoppingBag, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { adminStatusLabel, adminStatusStyle } from "../../lib/orderStatus"
import {
  buildMonthlySeries,
  cashflowCategoryLabel,
  filterByRange,
  formatShortDate,
  resolveReportRange,
  splitCashflow,
  toDateInputValue,
} from "../../lib/report"
import type { LowStockItem, MonthlyPoint, ReportPrintScope, ReportRangeMode } from "../../lib/report"
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

interface CashflowTableProps {
  title: string
  subtitle: string
  tone: "income" | "expense"
  items: CashflowItem[]
  total: number
  limit?: number
}

const CASHFLOW_TONE = {
  income: {
    header: "bg-emerald-600",
    border: "border-emerald-600",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    sign: "+",
    empty: "Belum ada pendapatan pada periode ini.",
  },
  expense: {
    header: "bg-red-700",
    border: "border-red-700",
    soft: "bg-red-50",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
    sign: "-",
    empty: "Belum ada pengeluaran pada periode ini.",
  },
} as const

function CashflowTable({ title, subtitle, tone, items, total, limit = 8 }: CashflowTableProps) {
  const style = CASHFLOW_TONE[tone]
  const visibleItems = items.slice(0, limit)

  return (
    <section className={`report-section overflow-hidden rounded-2xl border-2 bg-white ${style.border}`}>
      <div className={`flex flex-col gap-2 px-6 py-4 text-white sm:flex-row sm:items-center sm:justify-between ${style.header}`}>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-white/80">{subtitle}</p>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          {items.length} Transaksi
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className={style.soft}>
            <tr className="text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2.5 font-semibold">Tanggal</th>
              <th className="px-4 py-2.5 font-semibold">Kategori</th>
              <th className="px-4 py-2.5 font-semibold">Keterangan</th>
              <th className="px-4 py-2.5 text-right font-semibold">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-gray-600">{formatShortDate(item.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}>
                    {cashflowCategoryLabel(item.category)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.description || "-"}</td>
                <td className={`px-4 py-3 text-right font-semibold ${style.text}`}>
                  {style.sign} {formatIDR(item.amount)}
                </td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  {style.empty}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={`border-t-2 ${style.border} ${style.soft}`}>
              <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-ink-strong">
                Subtotal {title}
              </td>
              <td className={`px-4 py-3 text-right text-base font-black ${style.text}`}>
                {style.sign} {formatIDR(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 py-3 text-xs text-gray-400">
        Menampilkan {visibleItems.length} dari {items.length} transaksi.
      </p>
    </section>
  )
}

function NetProfitSummary({ income, expense, netProfit }: { income: number; expense: number; netProfit: number }) {
  const positive = netProfit >= 0

  return (
    <section className="report-net-summary rounded-2xl border-4 border-ink-strong bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink-strong">Ringkasan Laba / Rugi</h2>
          <p className="mt-1 text-xs text-gray-500">Net Profit = Total Pendapatan - Total Pengeluaran</p>
        </div>
        <div className={`rounded-xl px-5 py-3 ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Net Profit</p>
          <p className="text-2xl font-black">
            {positive ? "+ " : ""}
            {formatIDR(netProfit)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Pendapatan</p>
          <p className="mt-1 text-lg font-black text-emerald-700">+ {formatIDR(income)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Total Pengeluaran</p>
          <p className="mt-1 text-lg font-black text-red-700">- {formatIDR(expense)}</p>
        </div>
      </div>
    </section>
  )
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
  const [printScope, setPrintScope] = useState<ReportPrintScope>("all")

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
  const sections = useMemo(() => splitCashflow(periodCashflow), [periodCashflow])
  const totalIncome = sections.income.total
  const totalExpense = sections.expense.total
  const netBalance = sections.net_profit
  const periodOrders = useMemo(() => filterByRange(orders, windowRange), [orders, windowRange])
  const monthlyData: MonthlyPoint[] = useMemo(
    () => buildMonthlySeries(periodCashflow, windowRange),
    [periodCashflow, windowRange],
  )

  const statCards: StatCardData[] = [
    { label: "Pendapatan", value: `+ ${formatIDR(totalIncome)}`, icon: TrendingUp, colorClass: "bg-emerald-100 text-emerald-700" },
    { label: "Pengeluaran", value: `- ${formatIDR(totalExpense)}`, icon: TrendingDown, colorClass: "bg-red-100 text-red-700" },
    {
      label: "Laba/Rugi Bersih",
      value: `${netBalance >= 0 ? "+ " : ""}${formatIDR(netBalance)}`,
      icon: Wallet,
      colorClass: netBalance >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
    },
    { label: "Jumlah Pesanan", value: `${periodOrders.length} Pesanan`, icon: ShoppingBag, colorClass: "bg-gray-100 text-gray-600" },
  ]

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
        scope: printScope,
      },
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-2 py-8 sm:px-6 2xl:max-w-[1600px]">
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
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink">
            <span className="font-medium text-gray-500">Cetak</span>
            <select
              value={printScope}
              onChange={(e) => setPrintScope(e.target.value as ReportPrintScope)}
              className="cursor-pointer bg-transparent text-sm font-semibold text-ink focus:outline-none"
            >
              <option value="all">Pendapatan &amp; Pengeluaran</option>
              <option value="income">Pendapatan saja</option>
              <option value="expense">Pengeluaran saja</option>
            </select>
          </label>
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
                <Bar dataKey="income" name="Pendapatan" fill="#059669" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="expense" name="Pengeluaran" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={18} />
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

      <div className="space-y-6">
        <CashflowTable
          title="Pendapatan"
          subtitle="Semua arus kas masuk pada periode terpilih"
          tone="income"
          items={sections.income.items}
          total={totalIncome}
        />
        <CashflowTable
          title="Pengeluaran"
          subtitle="Semua arus kas keluar pada periode terpilih"
          tone="expense"
          items={sections.expense.items}
          total={totalExpense}
        />
        <NetProfitSummary income={totalIncome} expense={totalExpense} netProfit={netBalance} />
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
  )
}