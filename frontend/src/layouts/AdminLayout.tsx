import { Outlet } from "react-router-dom"
import { Topbar } from "../components/Topbar"

const ADMIN_NAV = [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/pesanan", label: "Pesanan" },
    { to: "/admin/layanan", label: "Layanan" },
    { to: "/admin/produk", label: "Produk" },
    { to: "/admin/pengaturan", label: "Pengaturan" },
]

export function AdminLayout() {
    return (
        <div className="min-h-screen bg-surface">
            <Topbar items={ADMIN_NAV} />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <Outlet />
            </main>
        </div>
    )
}