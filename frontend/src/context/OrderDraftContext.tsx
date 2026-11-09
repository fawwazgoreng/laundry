import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Decimal } from "decimal.js"
import type { PaymentMethod, Product, Service, ServiceAddonGroup, ServiceAddonOption } from "../lib/types"
import { selectedAddonsSubtotal } from "../lib/serviceAddons"

export interface DraftServiceAddon {
    group: ServiceAddonGroup
    option: ServiceAddonOption
}

export interface DraftService {
    service: Service
    qty: number
    notes: string
    addons: DraftServiceAddon[]
}

export interface DraftProduct {
    product: Product
    qty: number
    addons: DraftServiceAddon[]
}

interface OrderDraftContextValue {
    services: DraftService[]
    products: DraftProduct[]
    totalItems: number
    subtotalServices: number
    subtotalAddons: number
    subtotalProducts: number
    addService: (service: Service, qty?: number, addons?: DraftServiceAddon[]) => void
    updateServiceQty: (serviceId: number, qty: number) => void
    removeService: (serviceId: number) => void
    addProduct: (product: Product, qty?: number, addons?: DraftServiceAddon[]) => void
    updateProductQty: (productId: number, qty: number) => void
    removeProduct: (productId: number) => void
    setServiceQty: (serviceId: number, qty: number) => void
    addProducts: (products: Product[]) => void
    clear: () => void
}

const OrderDraftContext = createContext<OrderDraftContextValue | null>(null)

export function OrderDraftProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<DraftService[]>([])
    const [products, setProducts] = useState<DraftProduct[]>([])

    const addService = useCallback((service: Service, qty = 1, addons?: DraftServiceAddon[]) => {
        setServices((prev) => {
            const existing = prev.find((s) => s.service.id === service.id)
            if (existing) {
                return prev.map((s) =>
                    s.service.id === service.id
                        ? { ...s, qty: s.qty + qty, addons: addons ?? s.addons }
                        : s,
                )
            }
            return [...prev, { service, qty, notes: "", addons: addons ?? [] }]
        })
    }, [])

    const setServiceQty = useCallback((serviceId: number, qty: number) => {
        setServices((prev) =>
            qty <= 0
                ? prev.filter((s) => s.service.id !== serviceId)
                : prev.map((s) => (s.service.id === serviceId ? { ...s, qty } : s)),
        )
    }, [])

    const updateServiceQty = useCallback((serviceId: number, qty: number) => {
        setServiceQty(serviceId, qty)
    }, [setServiceQty])

    const removeService = useCallback((serviceId: number) => {
        setServices((prev) => prev.filter((s) => s.service.id !== serviceId))
    }, [])

    const addProduct = useCallback((product: Product, qty = 1, addons?: DraftServiceAddon[]) => {
        setProducts((prev) => {
            const existing = prev.find((p) => p.product.id === product.id)
            if (existing) {
                return prev.map((p) =>
                    p.product.id === product.id
                        ? { ...p, qty: p.qty + qty, addons: addons ?? p.addons }
                        : p,
                )
            }
            return [...prev, { product, qty, addons: addons ?? [] }]
        })
    }, [])

    const addProducts = useCallback((items: Product[]) => {
        setProducts((prev) => {
            const next = [...prev]
            for (const product of items) {
                const existing = next.find((p) => p.product.id === product.id)
                if (existing) existing.qty += 1
                else next.push({ product, qty: 1, addons: [] })
            }
            return next
        })
    }, [])

    const updateProductQty = useCallback((productId: number, qty: number) => {
        setProducts((prev) =>
            qty <= 0
                ? prev.filter((p) => p.product.id !== productId)
                : prev.map((p) => (p.product.id === productId ? { ...p, qty } : p)),
        )
    }, [])

    const removeProduct = useCallback((productId: number) => {
        setProducts((prev) => prev.filter((p) => p.product.id !== productId))
    }, [])

    const clear = useCallback(() => {
        setServices([])
        setProducts([])
    }, [])

    const value = useMemo(() => {
        const sumAddons = (addons: DraftServiceAddon[], qty: number) =>
            new Decimal(selectedAddonsSubtotal(addons, qty))
        const subtotalAddons = services.reduce(
            (sum, s) => sum.plus(sumAddons(s.addons, s.qty)),
            new Decimal(0),
        ).plus(
            products.reduce((sum, p) => sum.plus(sumAddons(p.addons, p.qty)), new Decimal(0)),
        )
        const subtotalServices = services.reduce(
            (sum, s) => sum
                .plus(new Decimal(s.service.price_per_unit).times(new Decimal(s.qty)))
                .plus(sumAddons(s.addons, s.qty)),
            new Decimal(0),
        )
        const subtotalProducts = products.reduce(
            (sum, p) => sum
                .plus(new Decimal(p.product.price).times(new Decimal(p.qty)))
                .plus(sumAddons(p.addons, p.qty)),
            new Decimal(0),
        )
        return {
            services,
            products,
            totalItems: services.length + products.reduce((sum, p) => sum + p.qty, 0),
            subtotalServices: subtotalServices.toNumber(),
            subtotalAddons: subtotalAddons.toNumber(),
            subtotalProducts: subtotalProducts.toNumber(),
            addService,
            updateServiceQty,
            removeService,
            addProduct,
            updateProductQty,
            removeProduct,
            setServiceQty,
            addProducts,
            clear,
        }
    }, [
        services,
        products,
        addService,
        updateServiceQty,
        removeService,
        addProduct,
        updateProductQty,
        removeProduct,
        setServiceQty,
        addProducts,
        clear,
    ])

    return <OrderDraftContext.Provider value={value}>{children}</OrderDraftContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrderDraft(): OrderDraftContextValue {
    const ctx = useContext(OrderDraftContext)
    if (!ctx) throw new Error("useOrderDraft must be used within OrderDraftProvider")
    return ctx
}

export const PAYMENT_METHOD_DEFAULT: PaymentMethod = "transfer_bank"