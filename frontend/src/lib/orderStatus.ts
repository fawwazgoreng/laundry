import type { OrderStatus } from "./types"

export const adminStatusLabel: Record<OrderStatus, string> = {
    BARU: "Baru",
    DITERIMA: "Diterima",
    DIPROSES: "Diproses",
    SIAP_ANTAR: "Siap Antar",
    SELESAI: "Selesai",
    DIBATALKAN: "Dibatalkan",
}

export const adminStatusStyle: Record<OrderStatus, string> = {
    BARU: "bg-blue-100 text-blue-700",
    DITERIMA: "bg-amber-100 text-amber-700",
    DIPROSES: "bg-orange-100 text-orange-700",
    SIAP_ANTAR: "bg-purple-100 text-purple-700",
    SELESAI: "bg-green-100 text-green-700",
    DIBATALKAN: "bg-gray-100 text-gray-500",
}