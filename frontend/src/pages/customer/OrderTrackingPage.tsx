import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Clock } from "lucide-react"
import { formatIDR } from "../../lib/format"
import { DELIVERY_BUFFER_HOURS, estimateDeliveryTime } from "../../lib/deliveryEstimate"
import type { OrderDetail } from "../../lib/types"
import { orderApi } from "../../services/api"
import { ErrorState } from "../../components/ui"
import { RouteMap } from "../../components/map"

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

interface MapPoint {
  latitude: number
  longitude: number
  label: string
}

function formatDateTime(value: Date): string {
  const day = value.toLocaleDateString("id-ID", { weekday: "long" })
  const date = value.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  const time = value.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })
  return `${day}, ${date} · ${time} WIB`
}

function RouteCard({
  title,
  description,
  from,
  to,
  color,
}: {
  title: string
  description: string
  from: MapPoint | null
  to: MapPoint | null
  color: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-ink-strong">{title}</h2>
      <p className="mt-1 text-xs text-gray-400">{description}</p>
      {from && to ? (
        <div className="mt-4 h-64 overflow-hidden rounded-xl border border-gray-200">
          <RouteMap from={from} to={to} color={color} />
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-50 px-3 py-6 text-center text-xs text-gray-400">
          Lokasi rute belum tersedia.
        </p>
      )}
    </div>
  )
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

  const hasServices = order.services.length > 0
  const serviceHours = order.services.reduce(
    (max, service) => Math.max(max, service.estimated_duration_hours),
    0,
  )
  const savedEstimate = order.estimated_delivery ? new Date(order.estimated_delivery) : null
  const estimate = savedEstimate && !Number.isNaN(savedEstimate.getTime())
    ? savedEstimate
    : estimateDeliveryTime(new Date(order.created_at), serviceHours)
  const totalWeight = order.services.reduce((sum, service) => sum + service.qty, 0)
  const itemSummary =
    [
      ...order.services.map((service) => `${service.service_name} (${service.qty} ${service.unit})`),
      ...order.products.map((product) => `${product.product_name} (${product.qty} ${product.size})`),
    ].join(", ") || "-"

  const outletPoint: MapPoint | null = order.outlet
    ? {
        latitude: order.outlet.latitude,
        longitude: order.outlet.longitude,
        label: order.outlet.name,
      }
    : null
  const pickupPoint: MapPoint | null = order.address
    ? {
        latitude: order.address.latitude,
        longitude: order.address.longitude,
        label: order.address.label,
      }
    : null
  const deliveryPoint: MapPoint | null =
    order.latitude !== null && order.longitude !== null
      ? { latitude: order.latitude, longitude: order.longitude, label: "Titik Pengantaran" }
      : pickupPoint

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
              <p className="text-xs text-gray-400">Item Pesanan</p>
              <p className="text-sm font-semibold text-ink-strong">{itemSummary}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Berat Cucian</p>
              <p className="text-sm font-semibold text-ink-strong">
                {totalWeight > 0 ? `${totalWeight} Kg` : "-"}
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

      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
            <Clock size={18} />
          </span>
          <div>
            <p className="text-xs text-gray-400">Estimasi Tiba</p>
            <p className="text-sm font-bold text-ink-strong">{formatDateTime(estimate)}</p>
            <p className="text-xs text-gray-400">
              {hasServices
                ? `Durasi layanan ${serviceHours} jam + ${DELIVERY_BUFFER_HOURS} jam proses pengantaran`
                : "Estimasi pengantaran produk"}
            </p>
          </div>
        </div>

        {hasServices && (
          <RouteCard
            title="Rute Penjemputan"
            description="Dari outlet menuju alamat penjemputan."
            from={outletPoint}
            to={pickupPoint}
            color="#374151"
          />
        )}
        <RouteCard
          title="Rute Pengantaran"
          description="Dari outlet menuju titik pengantaran pesanan."
          from={outletPoint}
          to={deliveryPoint}
          color="#2563eb"
        />
      </div>
    </div>
  )
}
