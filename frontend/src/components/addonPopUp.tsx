import type { ServiceAddonGroup } from "../lib/types"
import { Button, Modal } from "./ui"
import { Box } from "lucide-react"

interface AddonPopupProps {
    open: boolean
    data: ServiceAddonGroup[]
    title: string
    message: string
    cancelLabel: string
    confirmLabel: string
    loading?: boolean
    selected: Record<string, number[]>
    onSelectChange: (selected: Record<string, number[]>) => void
    onCancel: () => void
    onConfirm: () => void
    tone?: string
}

export default function AddonPopup({
    open,
    data,
    title,
    message,
    cancelLabel,
    confirmLabel,
    loading = false,
    selected,
    onSelectChange,
    onCancel,
    onConfirm,
    tone = "primary"
}: AddonPopupProps) {
    function toggleAddon(group: ServiceAddonGroup, optionId: number) {
        const current = selected[group.code] ?? []
        let next: number[]

        if (current.includes(optionId)) {
            if (group.is_required && current.length === 1) return // Jangan biarkan kosong jika wajib & sisa 1
            next = group.selection_type === "single" ? [] : current.filter((id) => id !== optionId)
        } else {
            next = group.selection_type === "single" ? [optionId] : [...current, optionId]
        }

        onSelectChange({ ...selected, [group.code]: next })
    }

    return (
        <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
            <div className="space-y-5">
                <p className="text-sm leading-relaxed text-gray-500">{message}</p>
                {data.map((group) => {
                    const selectedAdd = selected[group.code] ?? []
                    return (
                        <fieldset key={group.id} className="rounded-xl border border-gray-200 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <legend className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
                                    <Box size={15} className="text-primary" />
                                    {group.name}
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                                        {group.is_required ? "Wajib" : "Opsional"}
                                    </span>
                                </legend>
                                {!group.is_required && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectChange({ ...selected, [group.code]: [] })}
                                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                            selectedAdd.length === 0
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
                                    const isSelected = selectedAdd.includes(option.id)
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => toggleAddon(group, option.id)}
                                            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                                isSelected
                                                    ? "border-primary bg-primary-light"
                                                    : "border-gray-200 bg-white hover:border-gray-300"
                                            }`}
                                        >
                                            <span className="block text-xs font-semibold text-ink-strong">
                                                {option.name}
                                            </span>
                                            <span className={`mt-0.5 block text-[11px] ${isSelected ? "text-primary" : "text-gray-500"}`}>
                                                {/* Tambahkan format harga jika diperlukan */}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )
                })}
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onCancel} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={tone === "danger" ? "danger" : "primary"}
                        onClick={onConfirm}
                        loading={loading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}