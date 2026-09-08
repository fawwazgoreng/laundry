import { Outlet } from "react-router-dom"

export function GuestLayout() {
    return (
        <main className="min-h-screen bg-white">
            <Outlet />
        </main>
    )
}