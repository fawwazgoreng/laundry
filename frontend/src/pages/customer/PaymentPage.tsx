import { useEffect, useState } from "react"
import { AlertTriangle, Box, Check, Copy, Hash, Info, RefreshCcw, ShieldCheck, Timer } from "lucide-react"
import { formatIDR } from "../lib/format"

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

const summary = [
  { label: "Total Harga (4 Barang)", value: 114100 },
  { label: "Biaya Pengiriman", value: 10000 },
  { label: "Diskon Premium Member", value: -15000 },
  { label: "Diskon Voucher Promo", value: -10000 },
]

const total = summary.reduce((acc, item) => acc + item.value, 0)
const vaNumber = "262080000123456"

export function PaymentPage() {
  const [secondsLeft, setSecondsLeft] = useState(4 * 60 + 33)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const seconds = String(secondsLeft % 60).padStart(2, "0")

  function handleCopy() {
    navigator.clipboard.writeText(vaNumber).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Pembayaran</h1>
        <p className="text-sm text-gray-500">selesaikan pembayaran untuk CLN-81202</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Timer size={18} className="text-ink" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-strong">Selesaikan pembayaran sebelum waktu habis</p>
            <p className="text-xs text-gray-400">Pesanan dibuat tanggal 12 Sept 2024</p>
          </div>
        </div>
        <span className="rounded-lg bg-primary px-5 py-2.5 font-mono text-lg font-bold text-white">
          00:{minutes}:{seconds}
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Box size={16} className="text-ink" />
            <div>
              <p className="text-sm font-semibold text-ink-strong">Bank BRI - akun virtual</p>
              <p className="text-xs text-gray-400">Silahkan transfer ke nomor berikut</p>
            </div>
          </div>

          <label className="mb-1 block text-xs font-medium text-gray-500">Nomor Virtual Account</label>
          <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <span className="font-mono text-sm font-semibold text-ink-strong">{vaNumber}</span>
            <button onClick={handleCopy} className="text-gray-400 hover:text-primary">
              {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
            </button>
          </div>

          <label className="mb-1 block text-xs font-medium text-gray-500">Total nominal yang harus dibayarkan</label>
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
                <span className={`font-medium ${row.value < 0 ? "text-primary" : "text-ink-strong"}`}>
                  {row.value < 0 ? "-" : ""}
                  {formatIDR(Math.abs(row.value))}
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
    </div>
  )
}
