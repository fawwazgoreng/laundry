import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react"
import { useId } from "react"
import { AlertCircle, Loader2, X } from "lucide-react"
import { cx } from "../lib/utils"

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const dim = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-5 w-5"
    return <Loader2 className={cx("animate-spin text-primary", dim)} />
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: "sm" | "md" | "lg"
    loading?: boolean
}

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    className,
    children,
    disabled,
    ...rest
}: ButtonProps) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    }
    const variants: Record<ButtonVariant, string> = {
        primary: "bg-primary text-white hover:bg-primary-dark shadow-sm",
        secondary: "bg-surface text-ink hover:bg-gray-200 border border-gray-200",
        ghost: "bg-transparent text-primary hover:bg-primary-light",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        outline: "bg-white text-ink border border-gray-300 hover:border-primary hover:text-primary",
    }
    return (
        <button
            className={cx(base, sizes[size], variants[variant], className)}
            disabled={disabled || loading}
            {...rest}
        >
            {loading && <Spinner size="sm" />}
            {children}
        </button>
    )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

export function Input({ label, error, className, id, ...rest }: InputProps) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    return (
        <div className="w-full">
            {label && (
                <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-strong">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={cx(
                    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-strong placeholder:text-gray-400 focus:outline-none focus:ring-2",
                    error
                        ? "border-red-500 focus:ring-red-200"
                        : "border-gray-300 focus:border-primary focus:ring-primary/20",
                    className,
                )}
                {...rest}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
}

export function Select({ label, className, children, id, ...rest }: SelectProps) {
    const generatedId = useId()
    const selectId = id ?? generatedId
    return (
        <div className="w-full">
            {label && (
                <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink-strong">
                    {label}
                </label>
            )}
            <select
                id={selectId}
                className={cx(
                    "w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-ink-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    className,
                )}
                {...rest}
            >
                {children}
            </select>
        </div>
    )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
}

export function Textarea({ label, className, id, ...rest }: TextareaProps) {
    const generatedId = useId()
    const textareaId = id ?? generatedId
    return (
        <div className="w-full">
            {label && (
                <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-ink-strong">
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                className={cx(
                    "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-ink-strong placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    className,
                )}
                {...rest}
            />
        </div>
    )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div className={cx("rounded-2xl border border-gray-200 bg-white shadow-sm", className)}>
            {children}
        </div>
    )
}

export function Badge({ children, color = "gray", className }: { className?: string; children: ReactNode; color?: "red" | "gray" | "green" | "blue" | "yellow" | "orange" }) {
    const colors = {
        red: "bg-red-100 text-red-700",
        gray: "bg-gray-100 text-gray-700",
        green: "bg-green-100 text-green-700",
        blue: "bg-blue-100 text-blue-700",
        yellow: "bg-yellow-100 text-yellow-800",
        orange: "bg-orange-100 text-orange-700",
    }
    return (
        <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", colors[color], className)}>
            {children}
        </span>
    )
}

const STATUS_COLORS: Record<string, "red" | "gray" | "green" | "blue" | "yellow" | "orange"> = {
    BARU: "blue",
    DITERIMA: "yellow",
    DIPROSES: "orange",
    SIAP_ANTAR: "gray",
    SELESAI: "green",
    DIBATALKAN: "red",
}

export function StatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "lg"; className?: string }) {
    const label =
        {
            BARU: "Baru",
            DITERIMA: "Diterima",
            DIPROSES: "Diproses",
            SIAP_ANTAR: "Siap Antar",
            SELESAI: "Selesai",
            DIBATALKAN: "Dibatalkan",
        }[status] ?? status
    return (
        <Badge color={STATUS_COLORS[status] ?? "gray"} className={cx(size === "lg" && "px-3 py-1 text-sm", className)}>
            {label}
        </Badge>
    )
}

export function Modal({
    open = true,
    onClose,
    title,
    children,
    maxWidth = "max-w-lg",
}: {
    open?: boolean
    onClose: () => void
    title?: string
    children: ReactNode
    maxWidth?: string
}) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className={cx("w-full rounded-2xl bg-white p-6 shadow-xl", maxWidth)}>
                <div className="mb-4 flex items-start justify-between">
                    {title && <h3 className="text-lg font-bold text-ink-strong">{title}</h3>}
                    <button
                        onClick={onClose}
                        className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
                <span className="text-2xl">🧺</span>
            </div>
            <p className="text-sm text-gray-500">{message}</p>
            {action}
        </div>
    )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm text-red-600">{message}</p>
            {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    Coba Lagi
                </Button>
            )}
        </div>
    )
}

export function LoadingState({ message = "Memuat data..." }: { message?: string }) {
    return (
        <div role="status" className="flex flex-col items-center gap-3 py-12 text-center">
            <Spinner size="lg" />
            <p className="text-sm text-gray-500">{message}</p>
        </div>
    )
}

export function Pagination({
    page,
    totalPages,
    count,
    perPage,
    onChange,
}: {
    page: number
    totalPages: number
    count?: number
    perPage?: number
    onChange: (page: number) => void
}) {
    if (totalPages <= 1 && !count) return null
    const pages: number[] = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, start + 4)
    for (let i = start; i <= end; i++) pages.push(i)
    const rangeStart = count ? (page - 1) * (perPage ?? count) + 1 : 0
    const rangeEnd = count && perPage ? Math.min(page * perPage, count) : (count ?? 0)

    return (
        <div className="flex items-center justify-between gap-3 pt-4">
            <p className="text-xs text-gray-500">
                {count !== undefined
                    ? perPage
                        ? `Menampilkan ${rangeStart}–${rangeEnd} dari ${count} data`
                        : `Menampilkan ${count} data`
                    : `Halaman ${page}`}
            </p>
            <div className="flex items-center gap-1">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => onChange(page - 1)}
                >
                    &laquo;
                </Button>
                {pages.map((p) => (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        className={cx(
                            "h-8 min-w-8 rounded-lg px-2 text-sm font-semibold",
                            p === page ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100",
                        )}
                    >
                        {p}
                    </button>
                ))}
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => onChange(page + 1)}
                >
                    &raquo;
                </Button>
            </div>
        </div>
    )
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
    return (
        <div className="mb-6 flex items-start justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-ink-strong">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
            </div>
            {action}
        </div>
    )
}