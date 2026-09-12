import { Check, CreditCard, MessageCircle } from "lucide-react"
import { activeOrder } from "../lib/mockData"
import { formatIDR } from "../lib/format"

const steps = ["Diterima", "Dicuci", "Disetrika", "Siap Antar", "Selesai"]
const currentStepIndex = 2 // "Disetrika"

export function OrderDetailPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <nav className="text-xs text-gray-400">
        Layanan / Riwayat Pesanan / <span className="text-ink-strong">Detail Pesanan</span>
      </nav>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-ink-strong">Pesanan #{activeOrder.id}</h1>
            <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              Sedang Diproses
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Dibuat pada: 15 Agustus 2024, 14:30 WIB
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">
            <MessageCircle size={15} /> Hubungi CS
          </button>
          <button className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light">
            Batalkan Pesanan
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-sm font-semibold text-ink-strong">Status Pengerjaan</h2>
        <div className="flex items-center">
          {steps.map((step, idx) => (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    idx < currentStepIndex
                      ? "bg-primary text-white"
                      : idx === currentStepIndex
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {idx < currentStepIndex ? <Check size={15} /> : idx + 1}
                </span>
                <span
                  className={`text-xs font-medium ${
                    idx <= currentStepIndex ? "text-primary" : "text-gray-400"
                  }`}
                >
                  {step}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <span
                  className={`mx-2 h-0.5 flex-1 ${
                    idx < currentStepIndex ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_320px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Informasi Pelanggan</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase text-gray-400">Nama Lengkap</p>
              <p className="font-semibold text-ink-strong">{activeOrder.customerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Nomor Telepon</p>
              <p className="font-semibold text-ink-strong">{activeOrder.customerPhone}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Alamat Pengantaran</p>
              <p className="font-semibold text-ink-strong">{activeOrder.deliveryAddress}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Jadwal &amp; Penanganan</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase text-gray-400">Tipe Layanan</p>
              <p className="font-semibold text-primary">{activeOrder.serviceName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Jadwal Penjemputan</p>
              <p className="font-semibold text-ink-strong">{activeOrder.pickupSchedule}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Estimasi Selesai</p>
              <p className="font-semibold text-ink-strong">{activeOrder.estimatedDone}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Ringkasan Biaya</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal Laundry (3.2 Kg)</span>
              <span className="font-medium text-ink-strong">{formatIDR(activeOrder.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Biaya Antar-Jemput</span>
              <span className="font-medium text-ink-strong">{formatIDR(activeOrder.deliveryFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Diskon Premium Member</span>
              <span className="font-medium text-primary">-{formatIDR(activeOrder.memberDiscount)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Total Pembayaran</span>
            <span className="text-lg font-bold text-primary">{formatIDR(activeOrder.total)}</span>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
            <CreditCard size={16} className="text-gray-400" />
            <div>
              <p className="text-[10px] uppercase text-gray-400">Metode Pembayaran</p>
              <p className="text-sm font-semibold text-ink-strong">{activeOrder.paymentMethod}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-strong">Rincian Item Laundry</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="pb-3 font-medium">Rincian Penanganan</th>
                <th className="pb-3 text-right font-medium">Jumlah</th>
                <th className="pb-3 text-right font-medium">Berat (Est)</th>
                <th className="pb-3 text-right font-medium">Harga/Unit</th>
                <th className="pb-3 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {activeOrder.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-4">
                    <p className="font-semibold text-ink-strong">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.note}</p>
                  </td>
                  <td className="py-4 text-right text-ink">{item.qty} Pcs</td>
                  <td className="py-4 text-right text-ink">{item.weightKg} Kg</td>
                  <td className="py-4 text-right text-ink">{formatIDR(item.pricePerUnit)} /kg</td>
                  <td className="py-4 text-right font-semibold text-ink-strong">
                    {formatIDR(item.subtotal)}
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
