import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Clock, Home, Warehouse } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { OrderDetail } from "../../lib/types"
import { orderApi } from "../../services/api"
import { ErrorState } from "../../components/ui"

const stepMeta: Record<string, { label: string; description: string }> = {
  BARU: { label: "Pesanan Dibuat", description: "Pesanan diterima dan menunggu konfirmasi outlet." },
  DITERIMA: { label: "Diterima Outlet", description: "Pakaian telah diterima staf di outlet." },
  DIPROSES: { label: "Dicuci & Disetrika", description: "Pakaian sedang dicuci dan disetrika." },
  SIAP_ANTAR: { label: "Siap Antar", description: "Pakaian siap diantar kembali ke alamat Anda." },
  SELESAI: { label: "Selesai", description: "Pesanan telah terkirim dan selesai." },
  DIBATALKAN: { label: "Dibatalkan", description: "Pesanan dibatalkan." },
}

interface TrackingStep {
  id: string
  timestamp: string | null
  label: string
  description: string
  done: boolean
  active: boolean
}

export function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!orderId) return
    orderApi
      .get(orderId)
      .then((data) => {
        setOrder(data)
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat status pengiriman")
      })
  }, [orderId, reloadKey])

  if (!order) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 2xl:max-w-[1600px]">
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <p role="status" className="py-16 text-center text-sm text-gray-400">
            Memuat status pengiriman...
          </p>
        )}
      </div>
    )
  }

  const meta = stepMeta[order.status] ?? { label: order.status, description: "" }
  const trackings = [...order.trackings].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const orderTrackingSteps: TrackingStep[] = trackings.map((t) => ({
    id: t.id,
    timestamp: new Date(t.created_at).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    label: stepMeta[t.status]?.label ?? t.notes,
    description: t.notes || stepMeta[t.status]?.description || "",
    done: t.status !== order.status,
    active: t.status === order.status,
  }))

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2 2xl:max-w-[1600px]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-ink-strong">Order #{order.order_id}</h1>
            <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              {meta.label}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">Nama Pelanggan</p>
              <p className="text-sm font-semibold text-ink-strong">{order.customer.username}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Layanan Terpilih</p>
              <p className="text-sm font-semibold text-ink-strong">
                {order.services.map((s) => s.service_name).join(", ") || "Produk Toko"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Berat Cucian</p>
              <p className="text-sm font-semibold text-ink-strong">
                {order.services.reduce((sum, s) => sum + s.qty, 0)} Kg
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Biaya</p>
              <p className="text-sm font-semibold text-primary">{formatIDR(order.total_amount)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-sm font-semibold text-ink-strong">Garis Waktu Proses</h2>
          <ol className="space-y-6">
            {orderTrackingSteps.map((step, idx) => (
              <li key={step.id} className="relative flex gap-4 pl-1">
                {idx < orderTrackingSteps.length - 1 && (
                  <span className="absolute left-1.75 top-4 h-full w-px bg-gray-200" />
                )}
                <span
                  className={`z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${
                    step.done ? "bg-ink-strong" : step.active ? "bg-primary" : "bg-gray-200"
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    {step.timestamp && (
                      <span className="text-xs text-gray-400">{step.timestamp}</span>
                    )}
                    <p
                      className={`text-sm font-semibold ${
                        step.active ? "text-primary" : "text-ink-strong"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-2xl border relative border-gray-200 bg-white">
        <div className="mb-4 flex items-center absolute z-100 gap-2 top-4 left-4 rounded-xl bg-white px-4 py-3">
          <Clock size={16} className="text-primary" />
          <div>
            <p className="text-xs text-gray-500">Estimasi Tiba</p>
            <p className="text-sm font-bold text-ink-strong">17:30 WIB</p>
          </div>
        </div>

        <div className="relative h-96 overflow-hidden rounded-xl bg-gray-200">
          <svg viewBox="0 0 400 400" className="h-full w-full">
            <path
              d="M 40 340 C 120 300, 140 260, 120 220 S 200 140, 240 120 S 320 70, 340 40"
              fill="none"
              stroke="#374151"
              strokeWidth="3"
              strokeDasharray="8 6"
            />
          </svg>

          <div className="absolute bottom-8 left-8 flex flex-col items-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-strong text-white">
              <Warehouse size={16} />
            </span>
            <span className="mt-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold shadow">
              {order.outlet?.name ?? "Starting Outlet"}
            </span>
          </div>

          <div className="absolute right-10 top-10 flex flex-col items-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
              <Home size={16} />
            </span>
            <span className="mt-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold shadow">
              Home Delivery
            </span>
          </div>

          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="h-4 w-4 rounded-full border-2 border-white bg-primary shadow" />
            <span className="mt-1 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-white shadow">
              {order.address?.label ?? "Rumah Anda"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}