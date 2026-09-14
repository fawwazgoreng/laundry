import { formatIDR } from "../../../lib/format"
import type { Activity } from "./types"

interface RecentActivityProps {
  items: Activity[]
}

// Daftar aktivitas terkini pelanggan (order terbaru yang sudah diubah ke bentuk ringkas)
export const RecentActivity = ({ items }: RecentActivityProps) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-ink-strong">Aktivitas Terkini</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item, idx) => (
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
  )
}