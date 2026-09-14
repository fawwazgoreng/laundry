import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatIDR } from "../../../lib/format"

interface SpendingTrendProps {
  data: Array<{ month: string; value: number }>
}

// Grafik garis tren pengeluaran pelanggan dalam 6 bulan terakhir
export const SpendingTrend = ({ data }: SpendingTrendProps) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-ink-strong">Tren Pengeluaran</h2>
      <p className="text-xs text-gray-400">6 bulan terakhir</p>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => [formatIDR(Number(value)), "Pengeluaran"]} />
            <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}