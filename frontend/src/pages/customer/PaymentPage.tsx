import { Decimal } from "decimal.js"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { AlertTriangle, Box, Check, Copy, Hash, Info, RefreshCcw, ShieldCheck, Timer } from "lucide-react"
import { formatIDR } from "../../lib/format"
import { orderApi, paymentApi } from "../../services/api"
import { ErrorState, LoadingState } from "../../components/ui"
import { useToast } from "../../components/Toast"

const PAYMENT_WINDOW_HOURS = 24

const terms = [
  {
    icon: Timer,
    text: "Selesaikan pembayaran dalam 1x24 jam sejak pesanan dibuat. Lewat batas waktu, pesanan otomatis dibatalkan dan stok/slot kembali.",
  },
  {
    icon: Hash,
    text: "Transfer tepat sesuai nominal yang tertera — tanpa dibulatkan atau ditambah kode unik. Nomor Virtual Account ini sudah unik khusus untuk transaksi ini.",
  },
  {
    icon: RefreshCcw,
    text: "Status pembayaran terverifikasi otomatis oleh sistem dalam 1–5 menit setelah dana diterima, tanpa perlu konfirmasi manual.",
  },
  {
    icon: Box,
    text: "Nomor Virtual Account hanya berlaku satu kali untuk transaksi ini dan tidak dapat dipakai ulang untuk pesanan lain.",
  },
  {
    icon: ShieldCheck,
    text: 'Simpan bukti transfer sampai status pesanan berubah menjadi "Dibayar" sebagai antisipasi kendala sistem.',
  },
]

interface SummaryRow {
  label: string
  value: string
}

const paymentMethodLabel: Record<string, string> = {
  fadarosipay: "FADAROSI Pay - E-Wallet",
  transfer_bank: "Bank BRI - akun virtual",
  cod: "Bayar di Tempat (COD)",
}

export function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { error: toastError } = useToast()
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [vaNumber, setVaNumber] = useState("")
  const [paymentLabel, setPaymentLabel] = useState("Bank BRI - akun virtual")
  const [createdAt, setCreatedAt] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_WINDOW_HOURS * 60 * 60)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!orderId) return
    Promise.all([paymentApi.byOrder(orderId), orderApi.get(orderId)])
      .then(([payment, order]) => {
        setVaNumber(payment.va_number ?? payment.transaction_id)
        setPaymentLabel(paymentMethodLabel[order.payment_method] ?? "Transfer Bank")
        setCreatedAt(
          new Date(order.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        )
        const rows: SummaryRow[] = [
          {
            label: `Total Harga (${order.services.length + order.products.length} Barang)`,
            value: new Decimal(order.total_laundry).plus(order.total_product).toFixed(2),
          },
          { label: "Biaya Pengiriman", value: order.delivery_fee },
        ]
        setSummary(rows)
        const expiresAt = new Date(payment.created_at).getTime() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000
        setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)))
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat detail pembayaran")
      })
      .finally(() => setLoading(false))
  }, [orderId, reloadKey])

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const total = summary.reduce((acc, item) => acc.plus(new Decimal(item.value)), new Decimal(0)).toNumber()
  const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0")
  const seconds = String(secondsLeft % 60).padStart(2, "0")

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(vaNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toastError("Gagal menyalin nomor Virtual Account")
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Pembayaran</h1>
        <p className="text-sm text-gray-500">selesaikan pembayaran untuk {orderId}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Timer size={18} className="text-ink" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-strong">Selesaikan pembayaran sebelum waktu habis</p>
            <p className="text-xs text-gray-400">Pesanan dibuat tanggal {createdAt}</p>
          </div>
        </div>
        <span className="rounded-lg bg-primary px-5 py-2.5 font-mono text-lg font-bold text-white">
          {hours}:{minutes}:{seconds}
        </span>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Info size={16} className="text-ink" />
          <h2 className="text-sm font-semibold text-ink-strong">Syarat &amp; Ketentuan pembayaran</h2>
        </div>
        <ul className="space-y-4">
          {terms.map((term, idx) => {
            const Icon = term.icon
            return (
              <li key={idx} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Icon size={14} className="text-gray-500" />
                </span>
                <p className="text-sm text-gray-500">{term.text}</p>
              </li>
            )
          })}
        </ul>
      </div>

      {loading ? (
        <LoadingState message="Memuat detail pembayaran..." />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Box size={16} className="text-ink" />
            <div>
              <p className="text-sm font-semibold text-ink-strong">{paymentLabel}</p>
              <p className="text-xs text-gray-400">Silahkan transfer ke nomor berikut</p>
            </div>
          </div>

          <p className="mb-1 block text-xs font-medium text-gray-500">Nomor Virtual Account</p>
          <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <span className="font-mono text-sm font-semibold text-ink-strong">{vaNumber}</span>
            <button onClick={handleCopy} className="text-gray-400 hover:text-primary">
              {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
            </button>
          </div>

          <p className="mb-1 block text-xs font-medium text-gray-500">Total nominal yang harus dibayarkan</p>
          <div className="mb-4 rounded-lg border border-gray-200 px-4 py-3">
            <span className="text-lg font-bold text-ink-strong">{formatIDR(total)}</span>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-xs font-medium text-emerald-700">
              Pastikan nama penerima yang tampil adalah fadarosi laundry
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Ringkasan Belanja</h2>
          <div className="space-y-2 text-sm">
            {summary.map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-gray-500">{row.label}</span>
                <span className={`font-medium ${new Decimal(row.value).isNegative() ? "text-primary" : "text-ink-strong"}`}>
                  {new Decimal(row.value).isNegative() ? "-" : ""}
                  {formatIDR(new Decimal(row.value).abs().toNumber())}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Total Pembayaran</span>
            <span className="text-lg font-bold text-primary">{formatIDR(total)}</span>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}