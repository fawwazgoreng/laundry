import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Spinner } from "./ui"

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
    const { user, loading, isAdmin } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/dashboard" replace />
    }

    return <Outlet />
}