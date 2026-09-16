import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Scissors, Shirt, Wind, Zap } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { Service } from "../../lib/types"
import { serviceApi } from "../../services/api"
import { useOrderDraft } from "../../context/OrderDraftContext"

const wizardSteps = ["Jenis Cucian", "Detail & Berat", "Alamat & Jadwal", "Konfirmasi"]

const serviceIcons: Record<string, typeof Wind> = {
  "cuci-kering": Wind,
  "cuci-setrika": Shirt,
  "setrika-saja": Scissors,
  "express-6-jam": Zap,
}

const estimatedWeightKg = 3.0

function slugifyName(name: string): string {
  const map: Record<string, string> = {
    "Cuci Kering": "cuci-kering",
    "Cuci Setrika": "cuci-setrika",
    Setrika: "setrika-saja",
    Express: "express-6-jam",
  }
  return map[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

interface ServiceCard {
  id: number
  name: string
  description: string
  slug: string
  pricePerKg: number
}

export function LaundryWizardPage() {
  const navigate = useNavigate()
  const { addService } = useOrderDraft()
  const [services, setServices] = useState<ServiceCard[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)

  useEffect(() => {
    serviceApi
      .list()
      .then((list: Service[]) => {
        const cards: ServiceCard[] = list.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          slug: slugifyName(s.name),
          pricePerKg: s.price_per_unit,
        }))
        setServices(cards)
        setSelectedServiceId((current) => current ?? cards[0]?.id ?? null)
      })
      .catch(() => undefined)
  }, [])

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? services[0]
  const estimatedTotal = (selectedService?.pricePerKg ?? 0) * estimatedWeightKg

  function handleContinue() {
    if (!selectedService) return
    addService(
      {
        id: selectedService.id,
        name: selectedService.name,
        unit: "kg",
        price_per_unit: selectedService.pricePerKg,
        description: selectedService.description,
        estimated_duration_hours: 24,
        is_active: true,
      },
      estimatedWeightKg,
    )
    navigate("/checkout")
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-5 text-sm font-semibold text-ink-strong">Langkah Pemesanan Laundry</h2>
            <div className="flex flex-wrap items-center gap-3">
              {wizardSteps.map((step, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      idx === 0 ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`text-sm font-semibold ${idx === 0 ? "text-primary" : "text-gray-400"}`}
                  >
                    {step}
                  </span>
                  {idx < wizardSteps.length - 1 && <span className="mx-1 text-gray-300">{">"}</span>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h1 className="text-lg font-bold text-ink-strong">Pilih Jenis Layanan Laundry</h1>
            <p className="text-sm text-gray-500">
              Pilih satu atau lebih jenis penanganan laundry yang Anda butuhkan saat ini.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {services.map((service) => {
                const Icon = serviceIcons[service.slug] ?? Shirt
                const isSelected = service.id === selectedServiceId
                return (
                  <button
                    key={service.id}
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`relative flex flex-col gap-3 rounded-2xl border-2 bg-white p-5 text-left transition-colors ${
                      isSelected ? "border-primary" : "border-gray-200"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                        <Check size={12} />
                      </span>
                    )}
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isSelected ? "bg-primary-light text-primary" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink-strong">{service.name}</p>
                      <p className="mt-1 text-xs text-gray-400">{service.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Ringkasan Pesanan</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Layanan Terpilih</span>
              <span className="font-medium text-ink-strong">{selectedService?.name ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Estimasi Berat</span>
              <span className="font-medium text-ink-strong">{estimatedWeightKg.toFixed(1)} Kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Biaya per Kg</span>
              <span className="font-medium text-ink-strong">
                {selectedService ? formatIDR(selectedService.pricePerKg) : "-"}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Estimasi Total</span>
            <span className="text-lg font-bold text-primary">{formatIDR(estimatedTotal)}</span>
          </div>
          <button
            onClick={handleContinue}
            disabled={!selectedService}
            className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Lanjutkan
          </button>
        </aside>
      </div>
    </div>
  )
}