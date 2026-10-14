import { useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Shirt, Eye, EyeClosed } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { ApiError } from "../../services/apiClient"
import { Button, Input } from "../../components/ui"
import { formatFormError } from "../../lib/format"

function AuthSidebar() {
    return (
        <div className="relative hidden overflow-hidden bg-primary px-24 py-16 text-white lg:flex lg:flex-col lg:justify-between col-span-4">
            <div className="relative flex items-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-primary">
                    <img src="/components/shirt-icon.png" alt="" />
                </span>
                <span className="text-2xl font-extrabold tracking-tight">Fadarosi</span>
            </div>
            <div className="relative">
                <h2 className="text-[40px] font-extrabold leading-tight tracking-tight">
                    Kembalikan Kesegaran Pakaian Anda Bersama Kami
                </h2>
                <p className="mt-4 text-[16px] font-extralight text-red-100">
                    Masuk ke akun FADAROSI Anda untuk memantau cucian, menjadwalkan penjemputan, atau membeli detergen pewangi ramah lingkungan.
                </p>
            </div>
            <div className="relative">
                <img src="/components/hero-image-pane.png" alt="" className="w-full" />
            </div>
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
        <div className="grid min-h-screen lg:grid-cols-9">
            <AuthSidebar />
            <div className="flex items-center justify-center bg-white px-6 py-12 col-span-5">
                <div className="w-full max-w-md">
                    <div className="mb-8 lg:hidden">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                            <Shirt className="h-5 w-5" />
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
                        <div className="w-full relative">
                            <Input
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Masukkan password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            {showPassword ? <EyeClosed
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="mt-2 text-xs font-medium text-ink hover:underline absolute top-7 right-5"
                            >
                            </EyeClosed> : <Eye
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="mt-2 text-xs font-medium text-ink hover:underline absolute top-7 right-5"
                            >
                            </Eye>}
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
            setError(err instanceof ApiError ? formatFormError(err.details) : "Terjadi kesalahan, coba lagi")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid min-h-screen lg:grid-cols-9">
            <AuthSidebar />
            <div className="flex items-center justify-center bg-white px-6 py-12 col-span-5">
                <div className="w-full max-w-md">
                    <div className="mb-8 lg:hidden">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                            <Shirt className="h-5 w-5" />
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
                        <div className="w-full relative">
                            <Input
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Minimal 8 karakter"
                                value={form.password}
                                onChange={set("password")}
                                required
                                minLength={8}
                            />
                            {showPassword ? <EyeClosed
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="mt-2 text-xs font-medium text-ink hover:underline absolute top-7 right-5"
                            >
                            </EyeClosed> : <Eye
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="mt-2 text-xs font-medium text-ink hover:underline absolute top-7 right-5"
                            >
                            </Eye>}
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