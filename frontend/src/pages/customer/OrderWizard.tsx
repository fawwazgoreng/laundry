import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, ChevronLeft, ChevronRight, MapPin, Minus, Plus, Shirt, ShoppingBag, Truck } from "lucide-react"
import { useOrderDraft } from "../../context/OrderDraftContext"
import { addressApi, orderApi, outletApi, serviceApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { fromLocalInputValue, formatRupiah, toLocalInputValue } from "../../lib/utils"
import type { Address, OrderCreateInput, Outlet, PaymentMethod, Service } from "../../lib/types"
import { Button, Card, EmptyState, Input, Spinner } from "../../components/ui"

const STEPS = ["Jenis Cucian", "Detail & Berat", "Alamat & Jadwal", "Konfirmasi"]

export default function OrderWizard() {
    const navigate = useNavigate()
    const draft = useOrderDraft()
    const [step, setStep] = useState(1)

    const [services, setServices] = useState<Service[]>([])
    const [addresses, setAddresses] = useState<Address[]>([])
    const [outlet, setOutlet] = useState<Outlet | null>(null)
    const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
    const [pickup, setPickup] = useState("")
    const [delivery, setDelivery] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer_bank")
    const [loadingInit, setLoadingInit] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        let mounted = true
        serviceApi
            .list()
            .then((list) => {
                if (!mounted) return
                setServices(list)
            })
        Promise.all([addressApi.list(), outletApi.getDefault()])
            .then(([addrs, outl]) => {
                if (!mounted) return
                setAddresses(addrs)
                setOutlet(outl)
                const primary = addrs.find((a) => a.is_primary) ?? addrs[0]
                if (primary) setSelectedAddressId(primary.id)
            })
            .catch(() => undefined)
            .finally(() => {
                if (mounted) setLoadingInit(false)
            })
        return () => {
            mounted = false
        }
    }, [])

    const longestDuration = useMemo(
        () => Math.max(0, ...draft.services.map((s) => s.service.estimated_duration_hours)),
        [draft.services],
    )

    const deliveryFee = useMemo(() => {
        const km = outlet ? Math.min(outlet.max_coverage_km, 3) : 3
        return Math.round(km * 2000)
    }, [outlet])

    const discountMember = useMemo(() => {
        const sub = draft.subtotalServices + draft.subtotalProducts
        return Math.round(Math.min(sub * 0.15, 15000))
    }, [draft.subtotalServices, draft.subtotalProducts])

    const total = useMemo(() => {
        const sub = draft.subtotalServices + draft.subtotalProducts
        return Math.round(sub + deliveryFee - discountMember)
    }, [draft.subtotalServices, draft.subtotalProducts, deliveryFee, discountMember])

    const canProceed = step === 1 ? draft.services.length > 0 : true

    const handlePickupChange = (value: string) => {
        setPickup(value)
        if (value && longestDuration > 0) {
            const d = new Date(value)
            d.setHours(d.getHours() + longestDuration)
            setDelivery(toLocalInputValue(d))
        }
    }

    const handleSubmit = async () => {
        setError("")
        if (!selectedAddressId || !outlet) {
            setError("Pilih alamat pengiriman terlebih dahulu")
            return
        }
        if (!pickup || !delivery) {
            setError("Lengkapi jadwal penjemputan dan estimasi pengantaran")
            return
        }
        setSubmitting(true)
        try {
            const payload: OrderCreateInput = {
                services: draft.services.map((s) => ({
                    laundry_service_id: s.service.id,
                    qty: s.qty,
                    notes: s.notes,
                })),
                products: draft.products.map((p) => ({
                    product_id: p.product.id,
                    qty: p.qty,
                })),
                user_address_id: selectedAddressId,
                outlet_id: outlet.id,
                distance_km: Math.min(outlet.max_coverage_km, 3),
                payment_method: paymentMethod,
                discount_member: discountMember,
                pickup_schedule: fromLocalInputValue(pickup),
                estimated_delivery: fromLocalInputValue(delivery),
            }
            const order = await orderApi.create(payload)
            draft.clear()
            navigate(`/payment/${order.order_id}`)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal membuat pesanan, coba lagi")
        } finally {
            setSubmitting(false)
        }
    }

    if (loadingInit) {
        return (
            <div className="flex justify-center py-20">
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-ink-strong">Langkah Pemesanan Laundry</h1>
            <p className="mt-1 text-sm text-gray-500">
                Pilih layanan, atur jadwal, dan selesaikan pesanan Fadarosi Anda.
            </p>

            {/* Progress */}
            <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
                {STEPS.map((label, i) => {
                    const n = i + 1
                    const active = n === step
                    const done = n < step
                    return (
                        <div key={label} className="flex items-center gap-2 whitespace-nowrap">
                            <button
                                onClick={() => done && setStep(n)}
                                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                    active ? "bg-primary text-white shadow-sm" : done ? "bg-primary-light text-primary" : "bg-white text-gray-500"
                                }`}
                            >
                                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? "bg-white/25" : done ? "bg-primary text-white" : "bg-gray-200"}`}>
                                    {done ? <Check className="h-3 w-3" /> : n}
                                </span>
                                {label}
                            </button>
                            {n < STEPS.length && <ChevronRight className="h-4 w-4 text-gray-300" />}
                        </div>
                    )
                })}
            </div>

            {error && (
                <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-2">
                    {step === 1 && (
                        <StepServices services={services} />
                    )}
                    {step === 2 && <StepDetail />}
                    {step === 3 && (
                        <StepSchedule
                            addresses={addresses}
                            selectedId={selectedAddressId}
                            onSelect={setSelectedAddressId}
                            pickup={pickup}
                            delivery={delivery}
                            onPickup={handlePickupChange}
                            onDelivery={setDelivery}
                            createAddressLink="/profil?tab=alamat"
                        />
                    )}
                    {step === 4 && (
                        <StepConfirm
                            paymentMethod={paymentMethod}
                            setPaymentMethod={setPaymentMethod}
                        />
                    )}

                    <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
                        <Button variant="secondary" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                            <ChevronLeft className="h-4 w-4" /> Kembali
                        </Button>
                        {step < 4 ? (
                            <Button disabled={!canProceed} onClick={() => setStep((s) => Math.min(4, s + 1))}>
                                Lanjut <ChevronRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button loading={submitting} onClick={handleSubmit}>
                                Buat Pesanan Sekarang
                            </Button>
                        )}
                    </div>
                </Card>

                {/* Summary sidebar */}
                <SummaryCard
                    step={step}
                    deliveryFee={deliveryFee}
                    discountMember={discountMember}
                    total={total}
                />
            </div>
        </div>
    )
}

function StepServices({ services }: { services: Service[] }) {
    const draft = useOrderDraft()
    return (
        <div>
            <h2 className="text-lg font-bold text-ink-strong">Jenis Layanan Laundry</h2>
            <p className="mt-1 text-sm text-gray-500">
                Pilih satu atau lebih jenis penanganan laundry yang Anda butuhkan saat ini.
            </p>
            {services.length === 0 ? (
                <EmptyState message="Belum ada layanan tersedia." />
            ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {services.map((svc) => {
                        const selected = draft.services.find((s) => s.service.id === svc.id)
                        return (
                            <div
                                key={svc.id}
                                className={`rounded-2xl border p-5 transition-colors ${
                                    selected ? "border-primary bg-primary-light/50 ring-1 ring-primary" : "border-gray-200 bg-white hover:border-primary/40"
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                                        <Shirt className="h-5 w-5" />
                                    </span>
                                    {selected && (
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                                            <Check className="h-3.5 w-3.5" />
                                        </span>
                                    )}
                                </div>
                                <h3 className="mt-3 font-bold text-ink-strong">{svc.name}</h3>
                                <p className="mt-1 text-xs text-gray-500">{svc.description}</p>
                                <div className="mt-3 flex items-center justify-between">
                                    <p className="text-sm font-bold text-primary">
                                        {formatRupiah(svc.price_per_unit)}{" "}
                                        <span className="font-medium text-gray-400">/ {svc.unit}</span>
                                    </p>
                                    <p className="text-[11px] text-gray-400">Estimasi {svc.estimated_duration_hours} jam</p>
                                </div>
                                <Button
                                    variant={selected ? "outline" : "primary"}
                                    className="mt-4 w-full"
                                    onClick={() =>
                                        selected
                                            ? draft.removeService(svc.id)
                                            : draft.addService(svc, 1)
                                    }
                                >
                                    {selected ? "Hapus" : "+ Pilih Layanan"}
                                </Button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function StepDetail() {
    const draft = useOrderDraft()
    return (
        <div>
            <h2 className="text-lg font-bold text-ink-strong">Detail & Berat Cucian</h2>
            <p className="mt-1 text-sm text-gray-500">Atur estimasi berat (kg) untuk setiap layanan yang dipilih.</p>
            {draft.services.length === 0 ? (
                <EmptyState message="Belum ada layanan dipilih." />
            ) : (
                <div className="mt-5 space-y-3">
                    {draft.services.map((s) => (
                        <div key={s.service.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold text-ink-strong">{s.service.name}</p>
                                <p className="text-xs text-gray-400">
                                    {formatRupiah(s.service.price_per_unit)} / {s.service.unit} &middot; estimasi {s.service.estimated_duration_hours} jam
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Stepper value={s.qty} onChange={(v) => draft.updateServiceQty(s.service.id, v)} suffix="Kg" />
                                <p className="w-28 text-right font-bold text-ink-strong">
                                    {formatRupiah(s.qty * s.service.price_per_unit)}
                                </p>
                            </div>
                        </div>
                    ))}
                    {draft.products.length > 0 && (
                        <>
                            <div className="pt-2">
                                <p className="text-sm font-semibold text-gray-500">Produk tambahan</p>
                            </div>
                            {draft.products.map((p) => (
                                <div key={p.product.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                                            <ShoppingBag className="h-4 w-4" />
                                        </span>
                                        <div>
                                            <p className="font-semibold text-ink-strong">{p.product.name}</p>
                                            <p className="text-xs text-gray-400">Kemasan {p.product.size}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Stepper value={p.qty} onChange={(v) => draft.updateProductQty(p.product.id, v)} suffix="Pcs" />
                                        <p className="w-28 text-right font-bold text-ink-strong">{formatRupiah(p.qty * p.product.price)}</p>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

function Stepper({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix: string }) {
    return (
        <div className="flex items-center overflow-hidden rounded-lg border border-gray-300">
            <button type="button" className="px-3 py-2 text-gray-500 hover:bg-surface" onClick={() => onChange(Math.max(0.5, value - 0.5))}>
                <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-20 border-x border-gray-300 px-2 py-2 text-center text-sm font-semibold text-ink-strong">
                {value} {suffix}
            </span>
            <button type="button" className="px-3 py-2 text-gray-500 hover:bg-surface" onClick={() => onChange(value + 0.5)}>
                <Plus className="h-4 w-4" />
            </button>
        </div>
    )
}

function StepSchedule({
    addresses,
    selectedId,
    onSelect,
    pickup,
    delivery,
    onPickup,
    onDelivery,
    createAddressLink,
}: {
    addresses: Address[]
    selectedId: number | null
    onSelect: (id: number) => void
    pickup: string
    delivery: string
    onPickup: (v: string) => void
    onDelivery: (v: string) => void
    createAddressLink: string
}) {
    return (
        <div>
            <h2 className="text-lg font-bold text-ink-strong">Alamat & Jadwal</h2>
            <p className="mt-1 text-sm text-gray-500">Tentukan alamat penjemputan serta jadwal pengambilan dan pengantaran.</p>

            <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-ink-strong">Alamat Pengiriman & Penjemputan</p>
                {addresses.length === 0 ? (
                    <EmptyState message="Belum ada alamat tersimpan." action={<a href={createAddressLink} className="text-sm font-semibold text-primary hover:underline">+ Tambah alamat</a>} />
                ) : (
                    <div className="space-y-3">
                        {addresses.map((a) => (
                            <label
                                key={a.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                                    selectedId === a.id ? "border-primary bg-primary-light/50 ring-1 ring-primary" : "border-gray-200 bg-white hover:border-primary/40"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="address"
                                    className="mt-1 accent-primary"
                                    checked={selectedId === a.id}
                                    onChange={() => onSelect(a.id)}
                                />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-ink-strong">{a.label}</p>
                                        {a.is_primary && (
                                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Utama</span>
                                        )}
                                    </div>
                                    <p className="mt-1 flex items-start gap-1 text-sm text-gray-500">
                                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a.address_text}
                                    </p>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-strong">
                        <Truck className="h-4 w-4 text-primary" /> Jadwal Penjemputan
                    </p>
                    <Input type="datetime-local" value={pickup} onChange={(e) => onPickup(e.target.value)} required />
                </div>
                <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-strong">
                        <Check className="h-4 w-4 text-primary" /> Estimasi Pengantaran
                    </p>
                    <Input type="datetime-local" value={delivery} onChange={(e) => onDelivery(e.target.value)} required />
                </div>
            </div>
        </div>
    )
}

function StepConfirm({
    paymentMethod,
    setPaymentMethod,
}: {
    paymentMethod: PaymentMethod
    setPaymentMethod: (m: PaymentMethod) => void
}) {
    const draft = useOrderDraft()
    const methods: Array<{ value: PaymentMethod; title: string; desc: string }> = [
        { value: "transfer_bank", title: "Transfer Bank (Verifikasi Otomatis)", desc: "Transfer via Virtual Account BCA, Mandiri, BNI, BRI" },
        { value: "cod", title: "Bayar di Tempat (COD)", desc: "Bayar tunai kepada kurir Fadarosi saat pakaian diantar" },
        { value: "fadarosipay", title: "FADAROSI Pay / E-Wallet", desc: "Bayar online instan menggunakan saldo FADAROSI Pay" },
    ]
    return (
        <div>
            <h2 className="text-lg font-bold text-ink-strong">Konfirmasi & Pembayaran</h2>
            <p className="mt-1 text-sm text-gray-500">Periksa kembali ringkasan dan pilih metode pembayaran favorit Anda.</p>

            <div className="mt-5">
                <p className="mb-3 text-sm font-semibold text-ink-strong">Metode Pembayaran</p>
                <div className="space-y-3">
                    {methods.map((m) => (
                        <label
                            key={m.value}
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                                paymentMethod === m.value ? "border-primary bg-primary-light/50 ring-1 ring-primary" : "border-gray-200 bg-white hover:border-primary/40"
                            }`}
                        >
                            <input type="radio" name="payment" className="mt-1 accent-primary" checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} />
                            <div>
                                <p className="font-semibold text-ink-strong">{m.title}</p>
                                <p className="mt-0.5 text-xs text-gray-500">{m.desc}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {draft.services.length > 0 && (
                <div className="mt-6">
                    <p className="mb-2 text-sm font-semibold text-ink-strong">Layanan & Produk Terpilih</p>
                    <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
                        {draft.services.map((s) => (
                            <div key={s.service.id} className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    {s.service.name} <span className="text-gray-400">({s.qty} {s.service.unit})</span>
                                </span>
                                <span className="font-semibold text-ink-strong">{formatRupiah(s.qty * s.service.price_per_unit)}</span>
                            </div>
                        ))}
                        {draft.products.map((p) => (
                            <div key={p.product.id} className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    {p.product.name} <span className="text-gray-400">({p.qty} {p.product.size})</span>
                                </span>
                                <span className="font-semibold text-ink-strong">{formatRupiah(p.qty * p.product.price)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function SummaryCard({
    step,
    deliveryFee,
    discountMember,
    total,
}: {
    step: number
    deliveryFee: number
    discountMember: number
    total: number
}) {
    const draft = useOrderDraft()
    return (
        <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="overflow-hidden">
                <div className="bg-primary px-6 py-4 text-white">
                    <h3 className="font-bold">Ringkasan Pesanan</h3>
                </div>
                <div className="space-y-3 p-6">
                    {draft.services.length === 0 && draft.products.length === 0 ? (
                        <p className="text-sm text-gray-400">Belum ada item dipilih.</p>
                    ) : (
                        <>
                            {draft.services.map((s) => (
                                <div key={s.service.id} className="flex justify-between gap-2 text-sm">
                                    <span className="text-gray-600">{s.service.name}</span>
                                    <span className="shrink-0 text-gray-400">{s.qty} {s.service.unit}</span>
                                </div>
                            ))}
                            {draft.services.length > 0 && (
                                <div className="flex justify-between gap-2 text-sm">
                                    <span className="font-semibold text-ink-strong">Subtotal Layanan</span>
                                    <span className="font-semibold text-ink-strong">{formatRupiah(draft.subtotalServices)}</span>
                                </div>
                            )}
                            {draft.products.map((p) => (
                                <div key={p.product.id} className="flex justify-between gap-2 text-sm">
                                    <span className="text-gray-600">{p.product.name}</span>
                                    <span className="shrink-0 text-gray-400">{p.qty} {p.product.size}</span>
                                </div>
                            ))}
                            {draft.products.length > 0 && (
                                <div className="flex justify-between gap-2 text-sm">
                                    <span className="font-semibold text-ink-strong">Subtotal Produk</span>
                                    <span className="font-semibold text-ink-strong">{formatRupiah(draft.subtotalProducts)}</span>
                                </div>
                            )}
                        </>
                    )}
                    <div className="border-t border-gray-100 pt-3">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Biaya Pengiriman</span>
                            <span>{formatRupiah(deliveryFee)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-green-600">
                            <span>Diskon Premium Member</span>
                            <span>-{formatRupiah(discountMember)}</span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between border-t border-gray-100 pt-3">
                        <span className="font-semibold text-ink-strong">Total Pembayaran</span>
                        <span className="text-xl font-extrabold text-primary">{formatRupiah(total)}</span>
                    </div>
                </div>
            </Card>
            {step === 4 && (
                <p className="mt-3 text-center text-xs text-gray-400">
                    Dengan menekan "Buat Pesanan Sekarang", Anda menyetujui syarat & ketentuan pembayaran Fadarosi.
                </p>
            )}
        </div>
    )
}