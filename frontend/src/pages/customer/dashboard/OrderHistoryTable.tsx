import { formatIDR } from "../../../lib/format"
import type { OrderStatus } from "../../../lib/types"
import type { HistoryRow } from "./types"

// Warna badge untuk setiap status order
const statusStyle: Record<OrderStatus, string> = {
  BARU: "bg-blue-100 text-blue-700",
  DITERIMA: "bg-amber-100 text-amber-700",
  DIPROSES: "bg-orange-100 text-orange-700",
  SIAP_ANTAR: "bg-purple-100 text-purple-700",
  SELESAI: "bg-green-100 text-green-700",
  DIBATALKAN: "bg-gray-100 text-gray-500",
}

// Label status order dalam Bahasa Indonesia
const statusLabel: Record<OrderStatus, string> = {
  BARU: "Baru",
  DITERIMA: "Diterima",
  DIPROSES: "Diproses",
  SIAP_ANTAR: "Siap Antar",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
}

interface OrderHistoryTableProps {
  orders: HistoryRow[]
}

// Tabel riwayat pesanan pelanggan dengan badge status
export const OrderHistoryTable = ({ orders }: OrderHistoryTableProps) => {
  return (
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
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-50 last:border-0">
                <td className="py-3 font-medium text-ink-strong">{order.id}</td>
                <td className="py-3 text-gray-600">{order.serviceName}</td>
                <td className="py-3 text-gray-600">{order.weightKg} kg</td>
                <td className="py-3 text-gray-600">{order.createdAt}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[order.status]}`}>
                    {statusLabel[order.status]}
                  </span>
                </td>
                <td className="py-3 text-right font-semibold text-ink-strong">{formatIDR(order.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}