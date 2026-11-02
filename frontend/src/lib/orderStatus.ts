import type { OrderStatus, Payment } from "./types"

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
export const paymentStatusLabel: Record<Payment["status"], string> = {
    PENDING: "PENDING",
    PAID: "PAID",
    FAILED: "FAILED",
    EXPIRED: "EXPIRED",
    DIBATALKAN: "DIBATALKAN",
    REFUNDED: "REFUNDED",
    CANCELLED: "CANCELLED",
}

export const paymentStatusStyle: Record<Payment["status"], string> = {
    PENDING: "bg-amber-100 text-amber-700",
    PAID: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    EXPIRED: "bg-gray-100 text-gray-500",
    DIBATALKAN: "bg-gray-100 text-gray-500",
    REFUNDED: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-500",
}
