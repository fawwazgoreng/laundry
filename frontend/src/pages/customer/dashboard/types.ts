import type { LucideIcon } from "lucide-react"
import type { OrderStatus } from "../../../lib/types"

export interface DashboardStat {
  label: string
  value: string
  icon: LucideIcon
}

export interface Activity {
  id: string
  title: string
  date: string
  price: number
}

export interface CustomerAddress {
  id: number
  label: string
  isPrimary: boolean
  fullAddress: string
  latitude: number
  longitude: number
}

export interface HistoryRow {
  id: string
  serviceName: string
  weightKg: string
  createdAt: string
  status: OrderStatus
  total: number
}