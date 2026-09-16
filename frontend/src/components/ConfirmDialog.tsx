import { Button, Modal } from "./ui"

interface ConfirmDialogProps {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: "primary" | "danger"
    loading?: boolean
    onConfirm: () => void
    onCancel: () => void
}

// Modal konfirmasi umum: dipakai sebelum aksi destruktif / perubahan status
export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Simpan",
    cancelLabel = "Batal",
    tone = "primary",
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
            <div className="space-y-5">
                <p className="text-sm leading-relaxed text-gray-500">{message}</p>
                <div className="flex justify-end gap-3">
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