import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { cx } from "../lib/utils"

type ToastType = "success" | "error" | "info"

interface ToastItem {
    id: number
    type: ToastType
    message: string
}

interface ToastContextValue {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Warna ikon + aksen sesuai tipe notifikasi
const toastMeta: Record<ToastType, { icon: typeof CheckCircle2; badge: string; text: string }> = {
    success: { icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-600", text: "text-emerald-600" },
    error: { icon: AlertCircle, badge: "bg-red-50 text-red-600", text: "text-red-600" },
    info: { icon: Info, badge: "bg-blue-50 text-blue-600", text: "text-blue-600" },
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    // Tambahkan notifikasi baru ke tumpukan toast
    const push = useCallback((type: ToastType, message: string) => {
        const id = Date.now() + Math.random()
        setToasts((prev) => [...prev, { id, type, message }])
        // Hapus otomatis setelah 3,5 detik
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 3500)
    }, [])

    const value = useMemo<ToastContextValue>(
        () => ({
            success: (m) => push("success", m),
            error: (m) => push("error", m),
            info: (m) => push("info", m),
        }),
        [push],
    )

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Tumpukan toast di pojok kanan atas */}
            <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
                {toasts.map((toast) => {
                    const meta = toastMeta[toast.type]
                    const Icon = meta.icon
                    return (
                        <div
                            key={toast.id}
                            role="status"
                            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg"
                        >
                            <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.badge)}>
                                <Icon size={16} />
                            </span>
                            <p className="flex-1 pt-1 text-sm font-medium text-ink-strong">{toast.message}</p>
                            <button
                                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                                className={cx("shrink-0 rounded p-0.5 hover:opacity-70", meta.text)}
                                aria-label="Tutup notifikasi"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </ToastContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error("useToast must be used within ToastProvider")
    return ctx
}