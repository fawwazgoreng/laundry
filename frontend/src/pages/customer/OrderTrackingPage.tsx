import { Clock, Home, Warehouse } from "lucide-react"
import { activeOrder, orderTrackingSteps } from "../lib/mockData"
import { formatIDR } from "../lib/format"

export function OrderTrackingPage() {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-ink-strong">Order #{activeOrder.id}</h1>
            <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              Sedang Diproses
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">Nama Pelanggan</p>
              <p className="text-sm font-semibold text-ink-strong">{activeOrder.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Layanan Terpilih</p>
              <p className="text-sm font-semibold text-ink-strong">Cuci Setrika</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Berat Cucian</p>
              <p className="text-sm font-semibold text-ink-strong">3.2 Kg</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Biaya</p>
              <p className="text-sm font-semibold text-primary">{formatIDR(activeOrder.subtotal)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-sm font-semibold text-ink-strong">Garis Waktu Proses</h2>
          <ol className="space-y-6">
            {orderTrackingSteps.map((step, idx) => (
              <li key={step.id} className="relative flex gap-4 pl-1">
                {idx < orderTrackingSteps.length - 1 && (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-gray-200" />
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

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary-light px-4 py-3">
          <Clock size={16} className="text-primary" />
          <div>
            <p className="text-xs text-gray-500">Estimasi Tiba</p>
            <p className="text-sm font-bold text-ink-strong">17:30 WIB</p>
          </div>
        </div>

        <div className="relative h-96 overflow-hidden rounded-xl bg-gray-100">
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
              Starting Outlet
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
              Rumah Anda
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
