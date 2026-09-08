import { useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { WashingMachine, Eye, EyeOff } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { ApiError } from "../../services/apiClient"
import { Button, Input } from "../../components/ui"

function AuthSidebar({ variant }: { variant: "login" | "register" }) {
    return (
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-red-700 to-red-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary">
                    <WashingMachine className="h-6 w-6" />
                </span>
                <span className="text-2xl font-extrabold tracking-tight">Fadarosi</span>
            </div>
            <div className="relative">
                <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
                    Perawatan Pakaian Premium Tanpa Repot
                </h2>
                <p className="mt-4 max-w-sm text-red-100">
                    {variant === "login"
                        ? "Silakan masuk untuk melanjutkan dan kelola cucian Anda dengan mudah."
                        : "Bergabunglah dengan Fadarosi dan nikmati layanan laundry premium di rumah Anda."}
                </p>
                <ul className="mt-8 space-y-3 text-sm text-red-50">
                    <li>✓ Jemput & antar gratis</li>
                    <li>✓ Hasil bersih wangi maksimal</li>
                    <li>✓ Status pesanan real-time</li>
                </ul>
            </div>
            <p className="relative text-sm text-red-200">&copy; {new Date().getFullYear()} Fadarosi Laundry</p>
        </div>
    )
}

export function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)
        try {
            const user = await login(email, password)
            navigate(user.role === "admin" ? "/admin" : (location.state as { from?: string } | null)?.from ?? "/dashboard")
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Terjadi kesalahan, coba lagi")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            <AuthSidebar variant="login" />
            <div className="flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-md">
                    <div className="mb-8 lg:hidden">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                            <WashingMachine className="h-5 w-5" />
                        </span>
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink-strong">Selamat Datang Kembali</h1>
                    <p className="mt-2 text-sm text-gray-500">Silakan masuk ke akun Fadarosi Anda untuk melanjutkan.</p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <Input
                            label="Email"
                            type="email"
                            placeholder="nama@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <div>
                            <Input
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Masukkan password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="mt-2 text-xs font-medium text-primary hover:underline"
                            >
                                {showPassword ? "Sembunyikan" : "Tampilkan"} password
                            </button>
                        </div>

                        {error && (
                            <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>
                        )}

                        <Button type="submit" className="w-full" size="lg" loading={loading}>
                            Masuk
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Belum punya akun?{" "}
                        <Link to="/register" className="font-semibold text-primary hover:underline">
                            register sekarang
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export function RegisterPage() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ username: "", phone: "", email: "", password: "" })
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }))

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)
        try {
            await register(form)
            navigate("/login", { state: { registered: true } })
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Terjadi kesalahan, coba lagi")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            <AuthSidebar variant="register" />
            <div className="flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-md">
                    <div className="mb-8 lg:hidden">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                            <WashingMachine className="h-5 w-5" />
                        </span>
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink-strong">Selamat Datang</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Silakan register ke akun Fadarosi Anda untuk melanjutkan.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                        <Input label="Username" placeholder="namakamu" value={form.username} onChange={set("username")} required />
                        <Input label="Nomor Telepon" type="tel" placeholder="081234567890" value={form.phone} onChange={set("phone")} required />
                        <Input label="Email" type="email" placeholder="nama@email.com" value={form.email} onChange={set("email")} required />
                        <div>
                            <Input
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Minimal 8 karakter"
                                value={form.password}
                                onChange={set("password")}
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                {showPassword ? "Sembunyikan" : "Tampilkan"} password
                            </button>
                        </div>

                        {error && (
                            <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>
                        )}

                        <Button type="submit" className="w-full" size="lg" loading={loading}>
                            Register
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Sudah punya akun?{" "}
                        <Link to="/login" className="font-semibold text-primary hover:underline">
                            login sekarang
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}