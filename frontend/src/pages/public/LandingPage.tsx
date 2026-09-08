import { Link } from "react-router-dom"
import { ArrowRight, CalendarClock, Check, Play, Shirt, Sparkles, Truck, WashingMachine } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { Button } from "../../components/ui"

const STEPS = [
    {
        title: "Pilih Layanan",
        desc: "Pilih jenis cucian, detergen, hingga tambahan produk seperti softener dan pewangi.",
    },
    {
        title: "Tentukan Jadwal",
        desc: "Atur jadwal penjemputan dan estimasi pengantaran yang paling nyaman untuk Anda.",
    },
    {
        title: "Kami Jemput & Cuci",
        desc: "Kurir kami menjemput pakaian, lalu kami cuci, setrika, dan kemas dengan higienis.",
    },
    {
        title: "Antar Kembali Bersih",
        desc: "Pakaian bersih dan wangi diantar kembali tepat waktu, siap dipakai lagi.",
    },
]

const BENEFITS = [
    { icon: Sparkles, title: "Bersih Maksimal", desc: "Detergen pilihan & setrika uap higienis untuk hasil terbaik." },
    { icon: Truck, title: "Jemput-Antar Gratis", desc: "Kurir kami menjemput dan mengantar pakaian sampai depan pintu." },
    { icon: CalendarClock, title: "Jadwal Fleksibel", desc: "Atur penjemputan sesuai waktu luang Anda, kapan pun." },
]

export default function LandingPage() {
    const { user } = useAuth()
    const startTo = user ? (user.role === "admin" ? "/admin" : "/layanan") : "/login"

    return (
        <div className="min-h-screen bg-white">
            {/* Nav */}
            <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
                        <WashingMachine className="h-5 w-5" />
                    </span>
                    <span className="text-lg font-extrabold tracking-tight text-primary">Fadarosi</span>
                </div>
                <div className="flex items-center gap-2">
                    {user ? (
                        <Button onClick={() => (window.location.href = startTo)}>Buka Aplikasi</Button>
                    ) : (
                        <>
                            <Button variant="ghost" size="md" onClick={() => (window.location.href = "/login")}>
                                Masuk
                            </Button>
                            <Button onClick={() => (window.location.href = "/register")}>
                                Daftar Gratis
                            </Button>
                        </>
                    )}
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-light via-white to-white" />
                <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
                    <div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary-light px-4 py-1.5 text-xs font-semibold text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            Layanan Laundry Premium
                        </span>
                        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-ink-strong sm:text-5xl lg:text-6xl">
                            Perawatan Pakaian <span className="text-primary">Premium</span> Tanpa Repot
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
                            Jemput, cuci, setrika, dan antar kembali — semua dalam satu aplikasi. Fadarosi menjaga
                            pakaian kesayangan Anda bersih sempurna setiap waktu.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Link to={startTo}>
                                <Button size="lg">
                                    Mulai Cuci Sekarang <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                            <a href="#langkah">
                                <Button variant="outline" size="lg">
                                    <Play className="h-4 w-4" /> Cara Kerja
                                </Button>
                            </a>
                        </div>
                        <div className="mt-10 flex items-center gap-8">
                            <div>
                                <p className="text-2xl font-extrabold text-ink-strong">10rb+</p>
                                <p className="text-xs text-gray-500">Cucian selesai</p>
                            </div>
                            <div className="h-10 w-px bg-gray-200" />
                            <div>
                                <p className="text-2xl font-extrabold text-ink-strong">98%</p>
                                <p className="text-xs text-gray-500">Pelanggan puas</p>
                            </div>
                            <div className="h-10 w-px bg-gray-200" />
                            <div>
                                <p className="text-2xl font-extrabold text-ink-strong">24 jam</p>
                                <p className="text-xs text-gray-500">Estimasi selesai</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="rounded-3xl bg-gradient-to-br from-primary to-red-700 p-8 text-white shadow-2xl shadow-primary/30">
                            <div className="flex items-center gap-4">
                                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                                    <Shirt className="h-7 w-7" />
                                </span>
                                <div>
                                    <p className="font-bold">Cuci Setrika Premium</p>
                                    <p className="text-sm text-red-100">3.2 Kg • Estimasi 24 jam</p>
                                </div>
                            </div>
                            <div className="mt-6 space-y-3">
                                {["Dijemput kurir hari ini jam 09:00", "Dicuci dengan wangi lavender", "Setrika uap higienis & rapi", "Diantar kembali sebelum 17:00"].map(
                                    (item) => (
                                        <div key={item} className="flex items-center gap-2 text-sm text-red-50">
                                            <Check className="h-4 w-4 shrink-0" /> {item}
                                        </div>
                                    ),
                                )}
                            </div>
                            <div className="mt-6 flex items-end justify-between rounded-2xl bg-black/10 px-4 py-3">
                                <div>
                                    <p className="text-xs text-red-100">Total Pembayaran</p>
                                    <p className="text-xl font-extrabold">Rp 30.600</p>
                                </div>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">
                                    Sedang Diproses
                                </span>
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-white p-4 shadow-xl lg:block">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
                                    <Check className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-ink-strong">Pesanan CLN-20240815-003</p>
                                    <p className="text-xs text-gray-500">Selesai diantar tepat waktu</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits */}
            <section className="border-y border-gray-100 bg-surface">
                <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3">
                    {BENEFITS.map((b) => (
                        <div key={b.title} className="rounded-2xl bg-white p-6 shadow-sm">
                            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                                <b.icon className="h-5 w-5" />
                            </span>
                            <h3 className="font-bold text-ink-strong">{b.title}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{b.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Steps */}
            <section id="langkah" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
                <div className="mx-auto mb-12 max-w-2xl text-center">
                    <span className="text-sm font-semibold uppercase tracking-widest text-primary">Cara Kerja</span>
                    <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-strong sm:text-4xl">
                        4 Langkah Mudah Cucian Bersih Sempurna
                    </h2>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((step, i) => (
                        <div key={step.title} className="relative rounded-2xl border border-gray-200 bg-white p-6">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-extrabold text-white">
                                {i + 1}
                            </span>
                            <h3 className="mt-4 font-bold text-ink-strong">{step.title}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{step.desc}</p>
                            {i < STEPS.length - 1 && (
                                <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary lg:block" />
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="bg-ink-strong py-16">
                <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white">
                        Siap Rasakan Kemudahan Menjaga Pakaian Tetap Bersih?
                    </h2>
                    <p className="mt-3 text-gray-300">
                        Daftar sekarang dan pesanan laundry pertama Anda hanya dalam hitungan menit.
                    </p>
                    <div className="mt-8">
                        {user ? (
                            <Link to={startTo}>
                                <Button size="lg">Masuk ke Aplikasi</Button>
                            </Link>
                        ) : (
                            <Link to="/register">
                                <Button size="lg">Daftar Gratis Sekarang</Button>
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-gray-400 sm:flex-row sm:px-6">
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
                        <WashingMachine className="h-4 w-4" />
                    </span>
                    <span className="font-bold text-primary">Fadarosi</span>
                </div>
                <p>&copy; {new Date().getFullYear()} Fadarosi Laundry. Semua hak dilindungi.</p>
            </footer>
        </div>
    )
}