import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check, Info, MapPin, Minus, Plus, Trash2, Wallet, Landmark, WashingMachine, X } from "lucide-react"
import { formatIDR } from "../../lib/format"
import { estimateDeliveryTime } from "../../lib/deliveryEstimate"
import type { Address, DeliveryQuote, PaymentGate, User } from "../../lib/types"
import { addressApi, authApi, orderApi, outletApi } from "../../services/api"
import { useOrderDraft, type DraftServiceAddon } from "../../context/OrderDraftContext"
import { Decimal } from "decimal.js"
import { addonSubtotal } from "../../lib/serviceAddons"
import { ErrorState, LoadingState } from "../../components/ui"
import { ApiError } from "../../services/apiClient"
import { MapClickPicker } from "../../components/mapClickPicker"
import { reverseGeocode } from "../../lib/geoCode"

const progressSteps = ["Pilih Layanan", "Detail & Berat", "Jadwal & Alamat", "Konfirmasi & Bayar"]

type BankCode = "bca" | "mandiri" | "bni" | "bri"
type PaymentChoice = "transfer" | "cod"

const banks: { code: BankCode; name: string; desc: string }[] = [
  { code: "bca", name: "BCA", desc: "BCA Virtual Account" },
  { code: "mandiri", name: "Mandiri", desc: "Mandiri Virtual Account" },
  { code: "bni", name: "BNI", desc: "BNI Virtual Account" },
  { code: "bri", name: "BRI", desc: "BRI Virtual Account" },
]

/** Tarif ongkir per km. Harus sama dengan perhitungan backend (orderEntity.computeDeliveryFee). */
const FEE_PER_KM = 1000
/** Masa tenggang refund (hari). Idealnya diambil dari satu config bersama dengan backend. */
const REFUND_WINDOW_DAYS = 7

interface CartLine {
  key: string
  kind: "service" | "product"
  id: number
  tag: string
  name: string
  desc: string
  qty: number
  unit: string
  estimatedHours?: number
  pricePerUnit: string
  image?: string
  notes: string
  addons: DraftServiceAddon[]
}

function isWeightUnit(unit: string): boolean {
  return unit.toLowerCase() === "kg"
}

function cartLineTotal(line: CartLine): string {
  const addonTotal = new Decimal(
    line.addons.reduce((sum, addon) => sum.plus(addonSubtotal(addon.option, line.qty)), new Decimal(0)),
  )
  return new Decimal(line.pricePerUnit).times(new Decimal(line.qty)).plus(addonTotal).toFixed(2)
}

/**
 * Qty baru setelah tombol +/-. Langkah 0,1 kg dihitung dengan Decimal agar tidak muncul
 * galat floating-point (mis. 0.1 + 0.2 = 0.30000000000000004) yang ikut terkirim ke API.
 */
function nextQty(line: CartLine, delta: number): number {
  const weight = isWeightUnit(line.unit)
  const next = new Decimal(line.qty).plus(delta).toDecimalPlaces(weight ? 1 : 0, Decimal.ROUND_HALF_UP)
  return Decimal.max(next, weight ? 0.1 : 1).toNumber()
}

/* ---------- Koordinat & ongkir ---------- */

interface Coordinate {
  latitude: number
  longitude: number
}

interface DeliverAddress {
  id: number
  label: string
  isPrimary: boolean
  fullAddress: string
  recipientName: string
  phone: string
  coordinate: Coordinate | null
}

/** Nilai dari API bisa number atau string desimal; null/kosong dianggap tidak valid (bukan 0). */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim() !== "") return Number(value)
  return Number.NaN
}

function toCoordinate(latitude: unknown, longitude: unknown): Coordinate | null {
  const lat = toNumber(latitude)
  const lng = toNumber(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng }
}

type DeliveryState =
  | { status: "pending" }
  | { status: "invalid" }
  | { status: "out_of_range"; distanceKm: number; maxKm: number }
  | { status: "ok"; distanceKm: number; fee: number; outletName: string }

const PENDING_DELIVERY: DeliveryState = { status: "pending" }

function toDeliverAddress(address: Address): DeliverAddress {
  return {
    id: address.id,
    label: address.label,
    isPrimary: address.is_primary,
    fullAddress: address.address_text,
    recipientName: address.label,
    phone: "",
    coordinate: toCoordinate(address.latitude, address.longitude),
  }
}

/** Backend memilih outlet terjauh dan menghitung ongkir; UI hanya menampilkan hasilnya. */
function toDeliveryState(quote: DeliveryQuote): DeliveryState {
  const distanceKm = Math.ceil(Number(quote.distance_km))
  const fee = Math.ceil(Number(quote.delivery_fee))
  const maxKm = Number(quote.max_coverage_km)
  if (!Number.isFinite(distanceKm) || !Number.isFinite(fee || !Number.isFinite(maxKm))) {
    return { status: "invalid" }
  }
  if (!quote.in_range) return { status: "out_of_range", distanceKm, maxKm }
  return { status: "ok", distanceKm, fee, outletName: quote.outlet.name }
}

function deliveryProblem(delivery: DeliveryState, quoteError: string | null): string | null {
  if (quoteError) return quoteError
  switch (delivery.status) {
    case "out_of_range":
      return `Jarak alamat terlalu jauh (${delivery.distanceKm.toFixed(2)} km, melebihi jangkauan ${delivery.maxKm} km). Pilih alamat atau titik lain.`
    case "invalid":
      return "Koordinat titik pengantaran atau outlet tidak valid, ongkos kirim tidak dapat dihitung."
    default:
      return null
  }
}

/* ---------- Kelayakan refund (pratinjau saat checkout) ---------- */

interface RefundCheck {
  eligible: boolean
  reasons: string[]
}

/**
 * Pratinjau syarat yang sudah bisa diketahui saat checkout. Syarat lain
 * (status order Selesai, pembayaran PAID, masa tenggang) dicek server saat refund diajukan.
 */
function evaluateCheckoutRefund(cart: readonly CartLine[], method: PaymentChoice): RefundCheck {
  const reasons: string[] = []
  if (cart.some((line) => line.kind === "service")) {
    reasons.push("Pesanan berisi layanan laundry (order campuran layanan + produk juga tidak dapat direfund).")
  }
  if (method === "cod") {
    reasons.push("Pembayaran COD bukan payment gateway.")
  }
  return { eligible: reasons.length === 0, reasons }
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const { services, products, removeProduct, removeService, clear } = useOrderDraft()

  const [cart, setCart] = useState<CartLine[]>(() => [
    ...services.map((s) => ({
      key: `service-${s.service.id}`,
      kind: "service" as const,
      id: s.service.id,
      tag: "Layanan Laundry",
      name: s.service.name,
      desc: s.service.description,
      qty: s.qty,
      unit: s.service.unit,
      estimatedHours: s.service.estimated_duration_hours,
      pricePerUnit: s.service.price_per_unit,
      notes: s.notes,
      addons: s.addons,
    })),
    ...products.map((p) => ({
      key: `product-${p.product.id}`,
      kind: "product" as const,
      id: p.product.id,
      tag: "Toko Detergen",
      name: p.product.name,
      desc: `${p.product.category} • ${p.product.size}`,
      qty: p.qty,
      unit: "Pcs",
      pricePerUnit: p.product.price,
      image: p.product.image,
      notes: "",
      addons: p.addons,
    })),
  ])
  const [addresses, setAddresses] = useState<DeliverAddress[]>([])
  const [addressLoading, setAddressLoading] = useState(true)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>("transfer")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [choiceAddress, setChoiceAddress] = useState(0)
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "map">("pickup")
  const [deliveryPoint, setDeliveryPoint] = useState<Coordinate | null>(null)
  const [deliveryAddressText, setDeliveryAddressText] = useState("")
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [quoteResult, setQuoteResult] = useState<{ key: string; state: DeliveryState; error: string | null } | null>(null)

  // State pop-up bank
  const [showBankModal, setShowBankModal] = useState(false)
  const [selectedBank, setSelectedBank] = useState<BankCode | null>(null)

  useEffect(() => {
    addressApi
      .list()
      .then((list: Address[]) => {
        const mapped = list.map(toDeliverAddress)
        setAddresses(mapped)
        // Tandai alamat utama (atau alamat pertama) sebagai pilihan bawaan
        const primary = mapped.find((a) => a.isPrimary) ?? mapped[0]
        if (primary) setChoiceAddress(primary.id)
        setAddressError(null)
      })
      .catch((err) => {
        setAddressError(err instanceof Error ? err.message : "Gagal memuat daftar alamat")
      })
      .finally(() => setAddressLoading(false))
    authApi
      .me()
      .then((user) => setCurrentUser(user))
      .catch(() => undefined)
  }, [])

  const pickupAddress = addresses.find((addr) => addr.id === choiceAddress)
  const deliveryCoordinate = deliveryMode === "pickup" ? pickupAddress?.coordinate ?? null : deliveryPoint
  const deliveryLat = deliveryCoordinate?.latitude
  const deliveryLng = deliveryCoordinate?.longitude
  const deliveryKey = deliveryLat !== undefined && deliveryLng !== undefined ? `${deliveryLat},${deliveryLng}` : null

  // Ongkir dihitung backend (outlet terjauh) dari titik pengantaran terpilih.
  useEffect(() => {
    if (deliveryLat === undefined || deliveryLng === undefined) return
    const key = `${deliveryLat},${deliveryLng}`
    let active = true
    outletApi
      .deliveryQuote(deliveryLat, deliveryLng)
      .then((quote) => {
        if (!active) return
        setQuoteResult({ key, state: toDeliveryState(quote), error: null })
      })
      .catch((err) => {
        if (!active) return
        setQuoteResult({
          key,
          state: { status: "invalid" },
          error: err instanceof Error ? err.message : "Gagal menghitung ongkos kirim",
        })
      })
    return () => {
      active = false
    }
  }, [deliveryLat, deliveryLng])

  function handleMapPick(coords: { lat: number; lng: number }) {
    const point = { latitude: coords.lat, longitude: coords.lng }
    setDeliveryPoint(point)
    setDeliveryLoading(true)
    reverseGeocode(point.latitude, point.longitude)
      .then((result) => setDeliveryAddressText(result.displayName))
      .catch(() =>
        setDeliveryAddressText(`Lokasi ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`),
      )
      .finally(() => setDeliveryLoading(false))
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.key === key
          ? { ...line, qty: nextQty(line, delta) }
          : line,
      ),
    )
  }

  function removeLine(line: CartLine) {
    setCart((prev) => prev.filter((item) => item.key !== line.key))
    if (line.kind === "service") removeService(line.id)
    else removeProduct(line.id)
  }

  const delivery = deliveryKey && quoteResult?.key === deliveryKey ? quoteResult.state : PENDING_DELIVERY
  const quoteError = deliveryKey && quoteResult?.key === deliveryKey ? quoteResult.error : null
  const deliveryNote = deliveryProblem(delivery, quoteError)
  const deliveryFee = delivery.status === "ok" ? delivery.fee : null

  const refundCheck = useMemo(() => evaluateCheckoutRefund(cart, paymentMethod), [cart, paymentMethod])

  const itemsTotal = cart.reduce((sum, line) => sum.plus(cartLineTotal(line)), new Decimal(0))
  const memberDiscount = 0
  const voucherDiscount = 0
  const total = itemsTotal.plus(deliveryFee ?? 0).minus(memberDiscount).minus(voucherDiscount)

  const pickupSchedule = useMemo(() => new Date(), [])
  const serviceHours = cart.reduce(
    (max, line) => (line.kind === "service" ? Math.max(max, line.estimatedHours ?? 0) : max),
    0,
  )
  const estimatedDelivery = useMemo(
    () => estimateDeliveryTime(pickupSchedule, serviceHours),
    [pickupSchedule, serviceHours],
  )

  function formatDateTime(date: Date) {
    const day = date.toLocaleDateString("id-ID", { weekday: "long" })
    const dateStr = date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB"
    return `${day}, ${dateStr} · ${timeStr}`
  }

  const pickupText = formatDateTime(pickupSchedule)
  const deliveryText = formatDateTime(estimatedDelivery)

  async function handleCreateOrder(bank?: BankCode) {
    if (delivery.status !== "ok" || !choiceAddress || !deliveryCoordinate) return
    setSubmitting(true)
    setError("")
    try {
      const order: PaymentGate = await orderApi.create({
        services: cart
          .filter((line) => line.kind === "service")
          .map((line) => ({
            laundry_service_id: line.id,
            qty: line.qty,
            notes: line.notes || undefined,
            addons: line.addons.map((addon) => ({
              group_code: addon.group.code,
              option_id: addon.option.id,
            })),
          })),
        products: cart
          .filter((line) => line.kind === "product")
          .map((line) => ({
            product_id: line.id,
            qty: line.qty,
            addons: line.addons.map((addon) => ({
              group_code: addon.group.code,
              option_id: addon.option.id,
            })),
          })),
        user_address_id: choiceAddress,
        latitude: deliveryCoordinate.latitude,
        longitude: deliveryCoordinate.longitude,
        payment_method: paymentMethod === "cod" ? "cod" : "transfer_bank",
        bank,
        pickup_schedule: pickupSchedule.toISOString(),
        estimated_delivery: estimatedDelivery.toISOString(),
        notes: "",
      })
      if (paymentMethod === "transfer") {
        const vaNumber = order.va_number
        if (vaNumber) {
          localStorage.setItem(`va_${order.order_id}`, vaNumber)
        }
        if (bank) {
          localStorage.setItem(`bank_${order.order_id}`, bank)
        }
        navigate(`/payment/${order.order_id}`)
        return
      }
      if (paymentMethod === "cod") {
        navigate(`/riwayat/${order.order_id}`)
        return
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan saat membuat pesanan")
    } finally {
      clear()
      setSubmitting(false)
      setShowBankModal(false)
    }
  }

  // Transfer -> tampilkan pop-up bank, COD -> langsung buat pesanan
  function handleSubmitClick() {
    if (paymentMethod === "transfer") {
      setShowBankModal(true)
    } else {
      handleCreateOrder()
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8 2xl:max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Buat Pesanan &amp; Checkout</h1>
        <p className="text-sm text-gray-500">
          Selesaikan detail pengiriman, jadwal, dan pembayaran untuk memproses pesanan Fadarosi Anda.
        </p>
      </div>

      {/* Info kebijakan refund */}
      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="flex gap-3">
          <Info size={18} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              <span className="font-semibold">Kebijakan refund:</span> refund hanya berlaku untuk order yang seluruh
              itemnya berupa <span className="font-semibold">Product</span> (produk fisik), dibayar melalui{" "}
              <span className="font-semibold">Transfer Bank (Virtual Account)</span> dan sudah lunas, berstatus{" "}
              <span className="font-semibold">Selesai</span>, serta diajukan dalam masa tenggang{" "}
              <span className="font-semibold">{REFUND_WINDOW_DAYS} hari</span>.
            </p>
            <p>
              Order layanan laundry, campuran layanan + produk, atau pembayaran COD otomatis tidak memenuhi syarat
              refund.
            </p>
          </div>
        </div>
        {cart.length > 0 && (
          <div
            className={`flex gap-2 rounded-xl border px-3 py-2 ${refundCheck.eligible
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-300 bg-white text-amber-900"
              }`}
          >
            {refundCheck.eligible ? (
              <Check size={16} className="mt-0.5 shrink-0" />
            ) : (
              <X size={16} className="mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {refundCheck.eligible
                  ? "Pesanan ini memenuhi syarat refund (setelah berstatus Selesai)."
                  : "Pesanan ini tidak memenuhi syarat refund."}
              </p>
              {!refundCheck.eligible && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                  {refundCheck.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progres pemesanan */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-strong">Progres Pemesanan</h2>
        <div className="flex flex-wrap items-center gap-3">
          {progressSteps.map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {idx < 3 ? <Check size={14} /> : idx + 1}
              </span>
              <span className={`text-sm font-semibold ${idx === 3 ? "text-primary" : "text-ink-strong"}`}>
                {step}
              </span>
              {idx < progressSteps.length - 1 && <span className="mx-1 text-gray-300">{">"}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Layanan & produk terpilih */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Layanan &amp; Produk Terpilih</h2>
              <div className="flex gap-4 text-xs font-semibold text-primary">
                <Link to={"/layanan"}>+ Tambah Layanan</Link>
                <Link to={"/produk"}>+ Tambah Barang</Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {cart.map((line) => (
                <div key={line.key} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="bg-primary-light w-16 h-16 shrink-0 overflow-hidden flex items-center justify-center text-4xl rounded-xl">
                      {line.kind === "service" ? (
                        <WashingMachine className="w-8 h-8 text-primary" />
                      ) : (
                        <img src={line.image} className="w-full h-full block object-cover" alt="" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className="inline-block rounded bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {line.tag}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-ink-strong truncate">{line.name}</p>
                      <p className="text-xs text-gray-400 truncate">{line.desc}</p>
                      {line.addons.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {line.addons.map((addon) => (
                            <li key={`${addon.group.code}-${addon.option.id}`} className="text-[11px] text-primary">
                              {addon.group.name}: {addon.option.name}{" "}
                              {addon.option.price_mode === "per_unit"
                                ? `(+${formatIDR(addon.option.price)}/${line.unit})`
                                : `(+${formatIDR(addon.option.price)}/order)`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                    {/* Tombol Qty */}
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 bg-white">
                      <button onClick={() => updateQty(line.key, isWeightUnit(line.unit) ? -0.1 : -1)} className="cursor-pointer">
                        <Minus size={14} className="text-gray-400 hover:text-ink-strong" />
                      </button>
                      <span className="w-14 text-center text-sm font-medium select-none">
                        {line.qty.toFixed(isWeightUnit(line.unit) ? 1 : 0)} {line.unit}
                      </span>
                      <button onClick={() => updateQty(line.key, isWeightUnit(line.unit) ? 0.1 : 1)} className="cursor-pointer">
                        <Plus size={14} className="text-gray-400 hover:text-ink-strong" />
                      </button>
                    </div>

                    {/* Harga */}
                    <div className="text-right min-w-20">
                      <p className="text-xs text-gray-400">
                        {formatIDR(line.pricePerUnit)} / {isWeightUnit(line.unit) ? "Kg" : "unit"}
                      </p>
                      <p className="text-sm font-bold text-ink-strong">
                        {formatIDR(cartLineTotal(line))}
                      </p>
                    </div>

                    <button
                      onClick={() => removeLine(line)}
                      className="text-gray-300 hover:text-primary cursor-pointer transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  Belum ada layanan atau produk yang dipilih.
                </p>
              )}
            </div>
          </div>

          {/* Alamat Penjemputan */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-strong">Alamat Penjemputan</h2>
              <Link to={"/dashboard#alamat"} className="text-xs font-semibold text-primary">
                + Tambah Alamat
              </Link>
            </div>
            {addressLoading ? (
              <LoadingState message="Memuat daftar alamat..." />
            ) : addressError ? (
              <ErrorState message={addressError} />
            ) : addresses.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                Belum ada alamat penjemputan tersimpan. Tambahkan alamat terlebih dahulu.
              </p>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => setChoiceAddress(addr.id)}
                  className={`mb-3 flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-4 sm:flex-row sm:items-center sm:gap-6 ${addr.id === choiceAddress ? "border-primary" : "border-gray-200"
                    }`}
                >
                  <span
                    className={`h-6 w-6 shrink-0 rounded-full border-2 ${choiceAddress === addr.id ? "border-primary bg-primary" : "border-gray-300"
                      }`}
                  />
                  <span>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink-strong">{addr.label}</p>
                      {addr.isPrimary && (
                        <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Utama
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {addr.recipientName} • {currentUser?.phone || "-"}
                    </p>
                    <p className="text-sm text-gray-500">{addr.fullAddress}</p>
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Alamat Pengantaran */}
          {cart.filter((item) => item.kind === "service").length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-ink-strong">Alamat Pengantaran</h2>
            <p className="mt-1 text-xs text-gray-500">
              Ongkos kirim dihitung dari titik pengantaran yang dipilih.
            </p>
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => setDeliveryMode("pickup")}
                className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left ${deliveryMode === "pickup" ? "border-primary" : "border-gray-200"
                  }`}
              >
                <span
                  className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 ${deliveryMode === "pickup" ? "border-primary bg-primary" : "border-gray-300"
                    }`}
                />
                <span>
                  <p className="text-sm font-semibold text-ink-strong">Ikuti alamat penjemputan</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {pickupAddress ? pickupAddress.fullAddress : "Pilih alamat penjemputan terlebih dahulu."}
                  </p>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("map")}
                className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left ${deliveryMode === "map" ? "border-primary" : "border-gray-200"
                  }`}
              >
                <span
                  className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 ${deliveryMode === "map" ? "border-primary bg-primary" : "border-gray-300"
                    }`}
                />
                <span>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-strong">
                    <MapPin size={14} /> Pilih titik di peta
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {deliveryPoint
                      ? deliveryAddressText || `${deliveryPoint.latitude.toFixed(6)}, ${deliveryPoint.longitude.toFixed(6)}`
                      : "Tentukan titik pengantaran pada peta."}
                  </p>
                </span>
              </button>
            </div>

            {deliveryMode === "map" && (
              <div className="mt-3 space-y-3 rounded-xl border border-gray-200 p-4">
                <MapClickPicker
                  key={deliveryPoint ? `${deliveryPoint.latitude}-${deliveryPoint.longitude}` : "checkout-map"}
                  defaultCenter={
                    deliveryPoint
                      ? { lat: deliveryPoint.latitude, lng: deliveryPoint.longitude }
                      : { lat: -6.496861119036644, lng: 110.90468997753888 }
                  }
                  onChange={handleMapPick}
                />
                <p className="text-xs text-gray-500">
                  {deliveryLoading
                    ? "Mencari alamat..."
                    : deliveryAddressText || "Klik peta untuk memilih titik lokasi pengantaran."}
                </p>
                {deliveryPoint && (
                  <p className="text-xs text-gray-400">
                    {deliveryPoint.latitude.toFixed(6)}, {deliveryPoint.longitude.toFixed(6)}
                  </p>
                )}
              </div>
            )}

            {delivery.status === "ok" && (
              <p className="mt-3 text-xs text-gray-400">
                ±{delivery.distanceKm.toFixed(2)} km dari {delivery.outletName} · ongkir{" "}
                {formatIDR(delivery.fee.toFixed(2))}
              </p>
            )}
          </div>
          )}

          {/* Jadwal */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Jadwal Pengambilan &amp; Pengantaran</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-1 text-xs font-semibold text-primary">Jadwal Penjemputan</p>
                <p className="text-sm font-medium text-ink-strong">{pickupText}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-1 text-xs font-semibold text-emerald-600">Estimasi Pengantaran</p>
                <p className="text-sm font-medium text-ink-strong">{deliveryText}</p>
              </div>
            </div>
          </div>

          {/* Metode pembayaran */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-strong">Metode Pembayaran</h2>
            <div className="space-y-3">
              <button
                onClick={() => setPaymentMethod("transfer")}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${paymentMethod === "transfer" ? "border-primary" : "border-gray-200"
                  }`}
              >
                <span
                  className={`h-4 w-4 rounded-full border-2 ${paymentMethod === "transfer" ? "border-primary bg-primary" : "border-gray-300"
                    }`}
                />
                <Landmark size={18} className="text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-ink-strong">Transfer Bank (Verifikasi Otomatis)</p>
                  <p className="text-xs text-gray-400">Transfer via Virtual Account BCA, Mandiri, BNI, BRI</p>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod("cod")}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${paymentMethod === "cod" ? "border-primary" : "border-gray-200"
                  }`}
              >
                <span
                  className={`h-4 w-4 rounded-full border-2 ${paymentMethod === "cod" ? "border-primary bg-primary" : "border-gray-300"
                    }`}
                />
                <Wallet size={18} className="text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-ink-strong">Bayar di Tempat (COD)</p>
                  <p className="text-xs text-gray-400">Bayar tunai kepada kurir Fadarosi saat pakaian dijemput</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Ringkasan belanja */}
        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-strong">Ringkasan Belanja</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Harga ({cart.length} Barang)</span>
              <span className="font-medium text-ink-strong">{formatIDR(itemsTotal.toFixed(2))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Biaya Pengiriman</span>
              <span className="font-medium text-ink-strong">
                {deliveryFee ? formatIDR(deliveryFee.toFixed(2)) : "-"}
              </span>
            </div>
            {delivery.status === "ok" && (
              <p className="text-right text-xs text-gray-400">
                ±{Math.ceil(delivery.distanceKm).toFixed(2)} km × {formatIDR(FEE_PER_KM.toFixed(2))}/km
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-ink-strong">Total Pembayaran</span>
            <span className="text-lg font-bold text-primary">{formatIDR(total.toFixed(2))}</span>
          </div>
          {deliveryFee === null && !deliveryNote && cart.length > 0 && (
            <p className="mt-3 text-xs text-gray-400">
              Total belum termasuk ongkos kirim. Pilih alamat pengiriman untuk menghitungnya.
            </p>
          )}
          {deliveryNote && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{deliveryNote}</p>
          )}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button
            onClick={handleSubmitClick}
            disabled={submitting || cart.length === 0 || delivery.status !== "ok"}
            className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? "Membuat Pesanan..." : "Buat Pesanan Sekarang"}
          </button>
        </aside>
      </div>

      {/* Pop-up pilih bank */}
      {showBankModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !submitting && setShowBankModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-ink-strong">Pilih Bank Virtual Account</h3>
                <p className="text-xs text-gray-500">Nomor VA akan dibuat sesuai bank yang Anda pilih.</p>
              </div>
              <button
                onClick={() => setShowBankModal(false)}
                disabled={submitting}
                className="cursor-pointer text-gray-400 hover:text-ink-strong"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 space-y-3">
              {banks.map((b) => (
                <button
                  key={b.code}
                  onClick={() => setSelectedBank(b.code)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${selectedBank === b.code ? "border-primary bg-primary-light/40" : "border-gray-200"
                    }`}
                >
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${selectedBank === b.code ? "border-primary bg-primary" : "border-gray-300"
                      }`}
                  />
                  <Landmark size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-ink-strong">{b.name}</p>
                    <p className="text-xs text-gray-400">{b.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
              <span className="text-gray-500">Total Pembayaran</span>
              <span className="font-bold text-primary">{formatIDR(total.toFixed(2))}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBankModal(false)}
                disabled={submitting}
                className="w-full cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-ink-strong disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => selectedBank && handleCreateOrder(selectedBank)}
                disabled={!selectedBank || submitting}
                className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? "Memproses..." : "Konfirmasi & Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}