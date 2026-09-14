import { HashLink } from "react-router-hash-link"
import { History, LayoutGrid, MapPin, User as UserIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface TabItem {
  key: string
  label: string
  icon: LucideIcon
  src: string
}

// Daftar tab navigasi pada halaman dashboard (lompat ke anchor section)
const tabs: TabItem[] = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutGrid, src: "#ringkasan" },
  { key: "profil", label: "Profil", icon: UserIcon, src: "#profil" },
  { key: "alamat", label: "Alamat", icon: MapPin, src: "#alamat" },
  { key: "history", label: "History", icon: History, src: "#history" },
]

interface DashboardTabsProps {
  active: string
  onSelect: (key: string) => void
}

// Render baris tab yang menandai tab aktif dan menggulir ke section terkait
export const DashboardTabs = ({ active, onSelect }: DashboardTabsProps) => {
  return (
    <div className="flex gap-2 border-gray-200" id="ringkasan">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.key
        return (
          <HashLink
            key={tab.key}
            to={tab.src}
            onClick={() => onSelect(tab.key)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              isActive ? "bg-primary text-white " : "border-transparent text-ink bg-white hover:text-ink-strong"
            }`}
          >
            <Icon size={20} />
            {tab.label}
          </HashLink>
        )
      })}
    </div>
  )
}