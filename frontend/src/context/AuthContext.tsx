import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { User } from "../lib/types"
import { authApi } from "../services/api"
import { tokenStore } from "../services/apiClient"

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
        const payload = await authApi.login(email, password)
        tokenStore.set(payload.accessToken, payload.refreshToken)
        setUser(payload.user)
        return payload.user
    }, [])

    const register = useCallback(async (data: { username: string; phone: string; email: string; password: string }) => {
        const payload = await authApi.register(data)
        return payload
    }, [])

    const logout = useCallback(async () => {
        try {
            await authApi.logout()
        } catch {
            // ignore
        } finally {
            tokenStore.clear()
            setUser(null)
        }
    }, [])

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