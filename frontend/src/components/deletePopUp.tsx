import { ConfirmDialog } from "./ConfirmDialog"

interface DeletePopupProps {
    open: boolean
    dataName?: string
    loading?: boolean
    onCancel: () => void
    onConfirm: () => void
}

// Pop-up konfirmasi penghapusan data (dipakai di seluruh halaman kelola)
export default function DeletePopup({ open, dataName, loading = false, onCancel, onConfirm }: DeletePopupProps) {
    return (
        <ConfirmDialog
            open={open}
            tone="danger"
            title="Hapus data ini?"
            message={
                dataName
                    ? `Data "${dataName}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
                    : "Data akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            }
            confirmLabel="Hapus"
            cancelLabel="Batal"
            loading={loading}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    )
}