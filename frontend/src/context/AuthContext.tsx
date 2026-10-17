import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { User } from "../lib/types"
import { authApi } from "../services/api"
import { ApiError, tokenStore } from "../services/apiClient"
import { formatFormError } from "../lib/format"
import { useToast } from "../components/Toast"

interface AuthContextValue {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<User>
    register: (data: { username: string; phone: string; email: string; password: string }) => Promise<User>
    logout: () => Promise<void>
    refreshProfile: () => Promise<void>
    isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const toast = useToast()

    const refreshProfile = useCallback(async () => {
        try {
            const me = await authApi.me()
            setUser(me)
        } catch {
            setUser(null)
            tokenStore.clear()
        }
    }, [])

    useEffect(() => {
        let mounted = true
        const boot = async () => {
            if (!tokenStore.getAccess()) {
                setLoading(false)
                return
            }
            await refreshProfile()
            if (mounted) setLoading(false)
        }
        boot().catch(() => {
            if (mounted) setLoading(false)
        })
        return () => {
            mounted = false
        }
    }, [refreshProfile])

    const login = useCallback(async (email: string, password: string) => {
        try {
            const payload = await authApi.login(email, password)
            tokenStore.set(payload.accessToken, payload.refreshToken)
            setUser(payload.user)
            toast.success(
                payload.user.role === "admin"
                    ? "Login berhasil. Selamat datang, Admin!"
                    : "Login berhasil. Selamat datang kembali!",
            )
            return payload.user
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Login gagal, silakan coba lagi.")
            throw err
        }
    }, [toast])

    const register = useCallback(async (data: { username: string; phone: string; email: string; password: string }) => {
        try {
            const payload = await authApi.register(data)
            toast.success("Registrasi berhasil. Silakan masuk dengan akun Anda.")
            return payload
        } catch (err) {
            toast.error(err instanceof ApiError ? formatFormError(err.details) : "Registrasi gagal, silakan coba lagi.")
            throw err
        }
    }, [toast])

    const logout = useCallback(async () => {
        try {
            await authApi.logout()
        } catch {
            // abaikan error jaringan saat keluar, sesi lokal tetap dibersihkan
        } finally {
            tokenStore.clear()
            setUser(null)
            toast.success("Anda telah keluar.")
        }
    }, [toast])

    const value = useMemo(
        () => ({
            user,
            loading,
            login,
            register,
            logout,
            refreshProfile,
            isAdmin: user?.role === "admin",
        }),
        [user, loading, login, register, logout, refreshProfile],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within AuthProvider")
    return ctx
}