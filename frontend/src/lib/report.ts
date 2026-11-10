import { Decimal } from "decimal.js"
import type { CashflowItem, OrderListItem } from "./types"

// Helper bersama untuk halaman Laporan (/admin/laporan) dan Nota Laporan (/laporan/nota).
// Kedua halaman memakai fungsi yang sama supaya hasil filter dan totalnya tidak pernah berbeda.

export type ReportRangeMode = "preset" | "custom"

// Cakupan cetak nota laporan: pendapatan saja, pengeluaran saja, atau keduanya
// dalam satu dokumen.
export type ReportPrintScope = "all" | "income" | "expense"

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

export interface CashflowCategoryTotal {
  category: string
  total: number
  count: number
}

export interface CashflowSection {
  total: number
  categories: CashflowCategoryTotal[]
  items: CashflowItem[]
}

export interface CashflowSections {
  income: CashflowSection
  expense: CashflowSection
  net_profit: number
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
  scope?: ReportPrintScope
}

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

export function isReportPrintScope(value: unknown): value is ReportPrintScope {
  return value === "all" || value === "income" || value === "expense"
}

export function reportScopeLabel(scope: ReportPrintScope): string {
  if (scope === "income") return "Laporan Pendapatan"
  if (scope === "expense") return "Laporan Pengeluaran"
  return "Laporan Keuangan"
}

// Saring arus kas sesuai cakupan cetak. Nilai "all" mempertahankan keduanya
// dalam satu dokumen, sedangkan income/expense hanya mengambil satu sisi.
export function filterCashflowByScope(items: CashflowItem[], scope: ReportPrintScope): CashflowItem[] {
  if (scope === "all") return items
  return items.filter((item) => item.type === scope)
}

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

// Pisahkan transaksi menjadi section Pendapatan dan Pengeluaran.
// Nilai mentah tidak pernah dicampur: setiap section punya item, kategori, dan subtotal sendiri.
export function buildCashflowSection(items: CashflowItem[]): CashflowSection {
  const sorted = items.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const totals = new Map<string, { total: Decimal; count: number }>()
  let total = new Decimal(0)

  for (const item of sorted) {
    const amount = new Decimal(item.amount)
    total = total.plus(amount)
    const current = totals.get(item.category) ?? { total: new Decimal(0), count: 0 }
    current.total = current.total.plus(amount)
    current.count += 1
    totals.set(item.category, current)
  }

  const categories = Array.from(totals.entries())
    .map(([category, value]) => ({ category, total: value.total.toNumber(), count: value.count }))
    .sort((a, b) => b.total - a.total)

  return { total: total.toNumber(), categories, items: sorted }
}

export function splitCashflow(items: CashflowItem[]): CashflowSections {
  const income = buildCashflowSection(items.filter((it) => it.type === "income"))
  const expense = buildCashflowSection(items.filter((it) => it.type === "expense"))
  return { income, expense, net_profit: income.total - expense.total }
}

// Total pendapatan, pengeluaran, dan saldo bersih dari arus kas yang sudah difilter
export function summarizeCashflow(items: CashflowItem[]): ReportTotals {
  const { income, expense, net_profit } = splitCashflow(items)
  return { income: income.total, expense: expense.total, balance: net_profit }
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
    if (it.type === "income") bucket.income = new Decimal(bucket.income).plus(it.amount).toNumber()
    else bucket.expense = new Decimal(bucket.expense).plus(it.amount).toNumber()
  }
  return Array.from(buckets.values())
}
