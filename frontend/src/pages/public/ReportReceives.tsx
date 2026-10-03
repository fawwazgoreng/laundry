import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  ArrowLeft,
  Loader2,
  PackageOpen,
  Printer,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react"
import {
  buildMonthlySeries,
  cashflowCategoryLabel,
  filterByRange,
  formatShortDate,
  resolveReportRange,
  summarizeCashflow,
} from "../../lib/report"
import type { LowStockItem, ReportNotaState, ReportRange, ReportRangeMode } from "../../lib/report"
import { formatRupiah } from "../../lib/utils"
import type { CashflowItem, OrderListItem } from "../../lib/types"
import { adminApi, orderApi } from "../../services/api"

interface NotaData {
  range: ReportRange
  cashflow: CashflowItem[]
  orders: OrderListItem[]
  lowStock: LowStockItem[]
  autoPrint: boolean
}

function isReportNotaState(value: unknown): value is ReportNotaState {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ReportNotaState>
  return typeof candidate.periodStart === "number" && typeof candidate.periodEnd === "number"
}

function fromRouterState(state: ReportNotaState): NotaData {
  return {
    range: { start: new Date(state.periodStart), end: new Date(state.periodEnd) },
    cashflow: Array.isArray(state.cashflow) ? state.cashflow : [],
    orders: Array.isArray(state.orders) ? state.orders : [],
    lowStock: Array.isArray(state.lowStock) ? state.lowStock : [],
    autoPrint: Boolean(state.autoPrint),
  }
}

export function ReportNotaPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const routerState = location.state

  // Jika halaman dibuka langsung (refresh/bookmark), filter diambil dari query string.
  const params = useMemo(() => {
    const months = Number(searchParams.get("bulan"))
    return {
      mode: (searchParams.get("mode") === "custom" ? "custom" : "preset") as ReportRangeMode,
      months: Number.isFinite(months) && months > 0 ? months : 1,
      customStart: searchParams.get("dari") ?? "",
      customEnd: searchParams.get("sampai") ?? "",
    }
  }, [searchParams])

  const [nota, setNota] = useState<NotaData | null>(() =>
    isReportNotaState(routerState) ? fromRouterState(routerState) : null,
  )
  const [loading, setLoading] = useState(() => !isReportNotaState(routerState))
  const [error, setError] = useState<string | null>(null)

  // Fallback: nota dibuka tanpa state router, jadi ambil datanya sendiri dan filter ulang.
  useEffect(() => {
    if (nota) return
    let active = true
    const range = resolveReportRange(params.mode, params.months, params.customStart, params.customEnd)
    Promise.all([adminApi.cashflow(), orderApi.list({ perPage: 200 }), adminApi.stats()])
      .then(([cash, orderPage, stats]) => {
        if (!active) return
        setNota({
          range,
          cashflow: filterByRange(cash.items, range),
          orders: filterByRange(orderPage.data, range),
          lowStock: stats.low_stock_products.slice(0, 5),
          autoPrint: false,
        })
      })
      .catch(() => {
        if (active) setError("Data laporan tidak dapat dimuat. Buka nota ini dari halaman Laporan Admin.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [nota, params])

  useEffect(() => {
    if (!nota?.autoPrint) return
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [nota])

  useEffect(() => {
    if (nota) document.title = `Laporan Arus Kas - Fadarosi`
  }, [nota])

  const totals = useMemo(() => summarizeCashflow(nota?.cashflow ?? []), [nota])
  const monthlyData = useMemo(
    () => buildMonthlySeries(nota?.cashflow ?? [], nota?.range ?? { start: new Date(), end: new Date() }),
    [nota],
  )
  const cashflowRows = useMemo(
    () =>
      (nota?.cashflow ?? [])
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [nota],
  )

  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Menyiapkan Nota Laporan...</span>
        </div>
      </div>
    )
  }

  if (error || !nota) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <XCircle className="mb-4 h-12 w-12 text-red-500" />
        <h1 className="text-lg font-bold text-ink-strong">Nota Laporan Tidak Tersedia</h1>
        <p className="mt-2 text-sm text-gray-500">{error ?? "Data laporan tidak tersedia."}</p>
        <Link
          to="/admin/laporan"
          className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
        >
          Kembali ke Laporan
        </Link>
      </div>
    )
  }

  const periodLabel = `${formatShortDate(nota.range.start)} s/d ${formatShortDate(nota.range.end)}`

  const statCards = [
    { label: "Pendapatan", value: `+ ${formatRupiah(totals.income)}`, icon: TrendingUp, tone: "bg-red-100 text-red-600" },
    { label: "Pengeluaran", value: `- ${formatRupiah(totals.expense)}`, icon: TrendingDown, tone: "bg-emerald-100 text-emerald-600" },
    { label: "Saldo Bersih", value: formatRupiah(totals.balance), icon: Wallet, tone: "bg-blue-100 text-blue-600" },
    { label: "Jumlah Pesanan", value: `${nota.orders.length} Pesanan`, icon: ShoppingBag, tone: "bg-gray-100 text-gray-600" },
  ]

  return (
    <div className="min-h-screen bg-surface px-4 py-8 sm:px-6">
      <div className="print-hidden mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <Link
          to="/admin/laporan"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
        >
          <ArrowLeft size={15} />
          Kembali ke Laporan
        </Link>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
        >
          <Printer size={15} />
          Cetak / Export PDF
        </button>
      </div>

      <section className="print-area mx-auto max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-black text-white">
              F
            </span>
            <div>
              <p className="text-lg font-black tracking-tight text-ink-strong">FADAROSI</p>
              <p className="text-xs text-gray-400">Laundry, Toko &amp; Antar-Jemput</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Laporan Arus Kas</p>
            <p className="text-sm font-bold text-ink-strong">{periodLabel}</p>
            <p className="mt-1 text-xs text-gray-400">Dicetak pada {formatShortDate(new Date())}</p>
          </div>
        </header>

        <div className="border-b border-gray-100 p-6 sm:p-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Ringkasan Periode</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-gray-100 p-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                    <p className="text-sm font-bold text-ink-strong">{stat.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 border-b border-gray-100 p-6 lg:grid-cols-3 sm:p-8">
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">
              Pendapatan vs Pengeluaran (per Bulan)
            </h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Pendapatan" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#9ca3af" radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Stok Menipis</h2>
              <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
                {nota.lowStock.length} Produk
              </span>
            </div>
            <div className="space-y-3">
              {nota.lowStock.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <PackageOpen size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-strong">{item.name}</p>
                    <p className={`text-xs font-medium ${item.stock === 0 ? "text-primary" : "text-gray-400"}`}>
                      {item.stock === 0 ? "Stok habis" : `Sisa ${item.stock} Pcs`}
                    </p>
                  </div>
                </div>
              ))}
              {nota.lowStock.length === 0 && <p className="text-sm text-gray-400">Tidak ada peringatan stok.</p>}
            </div>
          </div>
        </div>

        <div className="border-b border-gray-100 p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Rincian Arus Kas</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
              {cashflowRows.length} Transaksi
            </span>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400">
                <th className="pb-2 font-medium">Tanggal</th>
                <th className="pb-2 font-medium">Kategori</th>
                <th className="pb-2 font-medium">Keterangan</th>
                <th className="pb-2 font-medium">Tipe</th>
                <th className="pb-2 text-right font-medium">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {cashflowRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 text-gray-600">{formatShortDate(row.created_at)}</td>
                  <td className="py-2.5 font-medium text-ink-strong">{cashflowCategoryLabel(row.category)}</td>
                  <td className="py-2.5 text-gray-600">{row.description}</td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${row.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}
                    >
                      {row.type === "income" ? "Masuk" : "Keluar"}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold ${row.type === "income" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {row.type === "income" ? "+" : "-"} {formatRupiah(row.amount)}
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
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={4} className="py-3 text-right font-bold text-ink-strong">
                  Saldo Bersih
                </td>
                <td className="py-3 text-right font-black text-primary">{formatRupiah(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* <div className="border-b border-gray-100 p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Pesanan dalam Periode</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
              {orderRows.length} Pesanan
            </span>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400">
                <th className="pb-2 font-medium">No. Order</th>
                <th className="pb-2 font-medium">Pelanggan</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Metode Bayar</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderRows.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 font-medium text-ink-strong">{order.order_id}</td>
                  <td className="py-2.5 text-gray-600">{order.customer_name}</td>
                  <td className="py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${adminStatusStyle[order.status as OrderStatus]}`}>
                      {adminStatusLabel[order.status as OrderStatus]}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-600">{order.payment_method}</td>
                  <td className="py-2.5 text-right font-semibold text-ink-strong">{formatRupiah(order.total_amount)}</td>
                </tr>
              ))}
              {orderRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                    Tidak ada pesanan pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={4} className="py-3 text-right font-bold text-ink-strong">
                  Total Nilai Pesanan
                </td>
                <td className="py-3 text-right font-black text-primary">{formatRupiah(ordersTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div> */}

        <footer className="flex flex-col gap-6 bg-gray-50 p-6 sm:flex-row sm:justify-between sm:p-8">
          <div className="max-w-sm text-xs text-gray-500">
            <p className="font-semibold text-ink-strong">Keterangan</p>
            <p className="mt-1">
              Laporan ini menampilkan seluruh transaksi arus kas dan pesanan pada periode {periodLabel}. Pendapatan
              tercatat dari pembayaran yang masuk, pengeluaran dari biaya operasional laundry.
            </p>
            <p className="mt-2">
              Dokumen ini dihasilkan otomatis oleh sistem Fadarosi dan sah tanpa tanda tangan basah.
            </p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xs text-gray-400">Admin Fadarosi</p>
            <p className="mt-12 text-sm font-black tracking-tight text-ink-strong">FADAROSI</p>
          </div>
        </footer>
      </section>
    </div>
  )
}
