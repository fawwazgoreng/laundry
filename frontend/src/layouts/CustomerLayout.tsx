import { Outlet } from "react-router-dom"
import { Topbar } from "../components/Topbar"

const CUSTOMER_NAV = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/layanan", label: "Layanan" },
    { to: "/toko", label: "Toko" },
]

export function CustomerLayout() {
    return (
        <div className="min-h-screen bg-surface">
            <Topbar items={CUSTOMER_NAV} />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <Outlet />
            </main>
        </div>
    )
}