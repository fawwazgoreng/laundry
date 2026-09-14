import type { DashboardStat } from "./types"

interface StatsCardsProps {
  stats: DashboardStat[]
}

// Grid kartu statistik ringkasan (total pengeluaran, jumlah order, dll.)
export const StatsCards = ({ stats }: StatsCardsProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5">
          <span className="flex w-9 h-9 p-2 text-lg mb-2 bg-gray-200 text-ink rounded-lg items-center justify-center">
            <stat.icon></stat.icon>
          </span>
          <p className="text-xs text-gray-500">{stat.label}</p>
          <p className="mt-2 text-lg font-bold text-ink-strong">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}