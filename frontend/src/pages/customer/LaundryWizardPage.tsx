import { Decimal } from "decimal.js"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Droplets, Scissors, Shirt, Sparkles, Wind, Zap } from "lucide-react"
import { formatIDR } from "../../lib/format"
import type { Service, ServiceAddonGroup } from "../../lib/types"
import { formatAddonPrice, selectedAddonsSubtotal } from "../../lib/serviceAddons"
import { serviceApi } from "../../services/api"
import { useOrderDraft, type DraftServiceAddon } from "../../context/OrderDraftContext"
import { ErrorState, LoadingState } from "../../components/ui"

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

function defaultAddonSelections(service?: Service): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  for (const group of service?.addon_groups ?? []) {
    const preferred =
      group.options.find((option) => option.is_default) ??
      (group.is_required ? group.options[0] : undefined)
    result[group.code] = preferred ? [preferred.id] : []
  }
  return result
}

function groupIcon(group: ServiceAddonGroup) {
  return group.code === "detergen" ? Droplets : Sparkles
}

export function LaundryWizardPage() {
  const navigate = useNavigate()
  const { addService } = useOrderDraft()
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addOnsError, setAddOnsError] = useState<string | null>(null)

  useEffect(() => {
    serviceApi
      .list()
      .then((list: Service[]) => {
        setServices(list)
        const first = list[0]
        setSelectedServiceId(first?.id ?? null)
        setSelectedAddons(defaultAddonSelections(first))
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat daftar layanan")
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? services[0]
  const selectedAddonList: DraftServiceAddon[] = (selectedService?.addon_groups ?? []).flatMap((group) => {
    const optionIds = selectedAddons[group.code] ?? []
    return group.options
      .filter((option) => optionIds.includes(option.id))
      .map((option) => ({ group, option }))
  })
  const laundryBase = new Decimal(selectedService?.price_per_unit ?? "0")
    .times(new Decimal(estimatedWeightKg))
  const addonTotal = new Decimal(selectedAddonsSubtotal(selectedAddonList, estimatedWeightKg))
  const estimatedTotal = laundryBase.plus(addonTotal)

  function handleSelectService(service: Service) {
    setSelectedServiceId(service.id)
    setSelectedAddons(defaultAddonSelections(service))
  }

  function toggleAddon(group: ServiceAddonGroup, optionId: number) {
    setSelectedAddons((prev) => {
      const current = prev[group.code] ?? []
      let next: number[]
      if (current.includes(optionId)) {
        if (group.is_required) return prev
        next = group.selection_type === "single" ? [] : current.filter((id) => id !== optionId)
      } else {
        next = group.selection_type === "single" ? [optionId] : [...current, optionId]
      }
      return { ...prev, [group.code]: next }
    })
  }

  function handleContinue() {
    if (!selectedService) return
    if (selectedAddonList.length < 1) {
      setAddOnsError("Silahkan memilih detergen dan pewangi")
      window.scrollBy({
        top: 800,
        behavior: "smooth"
      })
      return
    }
    addService(selectedService, estimatedWeightKg, selectedAddonList)
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
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
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
              {loading ? (
                <div className="col-span-full">
                  <LoadingState message="Memuat layanan..." />
                </div>
              ) : loadError ? (
                <div className="col-span-full">
                  <ErrorState message={loadError} />
                </div>
              ) : (
                services.map((service) => {
                  const Icon = serviceIcons[slugifyName(service.name)] ?? Shirt
                  const isSelected = service.id === selectedServiceId
                  return (
                    <button
                      key={service.id}
                      onClick={() => handleSelectService(service)}
                      className={`relative flex flex-col gap-3 rounded-2xl border-2 bg-white p-5 text-left transition-colors ${isSelected ? "border-primary" : "border-gray-200"
                        }`}
                    >
                      {isSelected && (
                        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                          <Check size={12} />
                        </span>
                      )}
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? "bg-primary-light text-primary" : "bg-gray-100 text-gray-500"
                          }`}
                      >
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink-strong">{service.name}</p>
                        <p className="mt-1 text-xs text-gray-400">{service.description}</p>
                        <p className="mt-2 text-xs font-semibold text-primary">
                          {formatIDR(service.price_per_unit)} / {service.unit}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {selectedService && selectedService.addon_groups.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-ink-strong">Opsi Tambahan Layanan</h2>
              </div>
              <p className="mb-5 text-xs text-gray-500">
                Add-on hanya berlaku untuk layanan ini dan tidak mengurangi stok produk toko.
              </p>

              <div className="space-y-4">
                {selectedService.addon_groups.map((group) => {
                  const Icon = groupIcon(group)
                  const selected = selectedAddons[group.code] ?? []
                  return (
                    <fieldset key={group.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <legend className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
                          <Icon size={15} className="text-primary" />
                          {group.name}
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            {group.is_required ? "Wajib" : "Opsional"}
                          </span>
                        </legend>
                        {!group.is_required && (
                          <button
                            type="button"
                            onClick={() => setSelectedAddons((prev) => ({ ...prev, [group.code]: [] }))}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${selected.length === 0
                              ? "bg-primary-light text-primary"
                              : "bg-gray-100 text-gray-500"
                              }`}
                          >
                            Tanpa {group.name}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {group.options.map((option) => {
                          const isSelected = selected.includes(option.id)
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleAddon(group, option.id)}
                              className={`rounded-lg border px-3 py-2 text-left transition-colors ${isSelected
                                ? "border-primary bg-primary-light"
                                : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                            >
                              <span className="block text-xs font-semibold text-ink-strong">
                                {option.name}
                              </span>
                              <span className={`mt-0.5 block text-[11px] ${isSelected ? "text-primary" : "text-gray-500"}`}>
                                {formatAddonPrice(option, selectedService.unit)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )
                })}
              </div>
            </div>
          )}
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
              <span className="text-gray-500">
                Biaya per {selectedService?.unit ?? "unit"}
              </span>
              <span className="font-medium text-ink-strong">
                {selectedService ? formatIDR(selectedService.price_per_unit) : "-"}
              </span>
            </div>
            {selectedAddonList.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tambahan Add-on</span>
                <span className="font-medium text-ink-strong">{formatIDR(addonTotal.toNumber())}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Estimasi Total</span>
            <span className="text-lg font-bold text-primary">{formatIDR(estimatedTotal.toNumber())}</span>
          </div>
          {(addOnsError && addOnsError.length > 3) && (
            <div className="m-4">
              <p className="text-sm text-red-600">{addOnsError}</p>
            </div>
          )}
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
