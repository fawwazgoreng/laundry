import type { CashflowItem, OrderListItem } from "./types"

// Helper bersama untuk halaman Laporan (/admin/laporan) dan Nota Laporan (/laporan/nota).
// Kedua halaman memakai fungsi yang sama supaya hasil filter dan totalnya tidak pernah berbeda.

export type ReportRangeMode = "preset" | "custom"

export interface ReportRange {
  start: Date
  end: Date
}

export interface MonthlyPoint {
  key: string
  label: string
  income: number
  expense: number
}

export interface ReportTotals {
  income: number
  expense: number
  balance: number
}

export interface LowStockItem {
  id: number
  name: string
  stock: number
}

// Data yang dikirim dari halaman Laporan ke Nota Laporan lewat state router.
// Hanya berisi data yang SUDAH difilter halaman laporan, jadi nota tidak perlu fetch ulang.
export interface ReportNotaState {
  periodStart: number
  periodEnd: number
  cashflow: CashflowItem[]
  orders: OrderListItem[]
  lowStock: LowStockItem[]
  autoPrint: boolean
}

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

// Label kategori arus kas dari backend (VARCHAR) ke Bahasa Indonesia
const CASHFLOW_CATEGORY_LABELS: Record<string, string> = {
  sales: "Penjualan",
  refund: "Pengembalian Dana",
  operational: "Operasional",
  expense: "Pengeluaran",
  income: "Pendapatan",
  other: "Lain-lain",
}

export function cashflowCategoryLabel(category: string): string {
  return CASHFLOW_CATEGORY_LABELS[category.toLowerCase()] ?? category
}

export function formatShortDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

// Helper: nilai untuk input date (YYYY-MM-DD) berdasarkan zona waktu lokal
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// Helper: ubah tanggal menjadi key bulan "YYYY-MM" untuk pengelompokan grafik
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

// Rentang waktu aktif: preset bulan terakhir, atau pilihan custom dari/sampai
export function resolveReportRange(
  mode: ReportRangeMode,
  months: number,
  customStart: string,
  customEnd: string,
): ReportRange {
  if (mode === "preset") {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }
  let start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(2000, 0, 1, 0, 0, 0)
  let end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : new Date()
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getTime() > end.getTime()) {
    const tmp = start
    start = end
    end = tmp
  }
  return { start, end }
}

export function isWithinRange(createdAt: string | Date, range: ReportRange): boolean {
  const t = new Date(createdAt).getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

// Saring baris (created_at) apa pun ke dalam rentang periode laporan
export function filterByRange<T extends { created_at: string }>(rows: T[], range: ReportRange): T[] {
  return rows.filter((row) => isWithinRange(row.created_at, range))
}

// Total pendapatan, pengeluaran, dan saldo bersih dari arus kas yang sudah difilter
export function summarizeCashflow(items: CashflowItem[]): ReportTotals {
  const income = items.filter((it) => it.type === "income").reduce((sum, it) => sum + it.amount, 0)
  const expense = items.filter((it) => it.type === "expense").reduce((sum, it) => sum + it.amount, 0)
  return { income, expense, balance: income - expense }
}

// Deret data grafik Pendapatan vs Pengeluaran per bulan untuk rentang periode
export function buildMonthlySeries(items: CashflowItem[], range: ReportRange): MonthlyPoint[] {
  const buckets = new Map<string, MonthlyPoint>()
  const cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1)
  const lastYear = range.end.getFullYear()
  const lastMonth = range.end.getMonth()
  let guard = 0
  while (guard < 120 && (cur.getFullYear() < lastYear || (cur.getFullYear() === lastYear && cur.getMonth() <= lastMonth))) {
    const key = monthKey(cur)
    buckets.set(key, { key, label: MONTH_SHORT[cur.getMonth()], income: 0, expense: 0 })
    cur.setMonth(cur.getMonth() + 1)
    guard += 1
  }
  for (const it of items) {
    const bucket = buckets.get(monthKey(new Date(it.created_at)))
    if (!bucket) continue
    if (it.type === "income") bucket.income += it.amount
    else bucket.expense += it.amount
  }
  return Array.from(buckets.values())
}
