import { Link } from "react-router-dom"
import { ArrowRight, CalendarClock, Sparkles, Truck, MapPin, PhoneCall, Mail, ShoppingCart } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { Button, Spinner } from "../../components/ui"
import { useEffect, useState } from "react"
import { productApi, serviceApi } from "../../services/api"
import type { Product, Service } from "../../lib/types"
import { formatRupiah } from "../../lib/utils"

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

const footerCallUs = [
    { icon: MapPin, desc: "Jl Kembang Kancilan no 45" },
    { icon: PhoneCall, desc: "+62 896-3654-6423" },
    { icon: Mail, desc: "fadarosi@gmail.com" }
]

const BENEFITS = [
    { icon: Sparkles, title: "Bersih Maksimal", desc: "Detergen pilihan & setrika uap higienis untuk hasil terbaik." },
    { icon: Truck, title: "Jemput-Antar Gratis", desc: "Kurir kami menjemput dan mengantar pakaian sampai depan pintu." },
    { icon: CalendarClock, title: "Jadwal Fleksibel", desc: "Atur penjemputan sesuai waktu luang Anda, kapan pun." },
]

const socialMedia = [
    { img: "/facebook.png" , src: "https://facebook.com"},
    { img: "/instagram.png" , src: "https://instagram.com"},
    { img: "/twitter.png" , src: "https://twitter.com"},
    { img: "/youtube.png" , src: "https://youtube.com"},
]

export default function LandingPage() {
    const { user } = useAuth()
    const startTo = user ? (user.role === "admin" ? "/admin" : "/layanan") : "/login"
    const [layanan, setLayanan] = useState<Service[] | []>([])
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        const res = async () => {
            const service = await serviceApi.list()
            const product = await productApi.list({ inStockOnly: true });
            setLayanan(service);
            setProducts(product.data);
            setLoading(false)
        };
        res().catch(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Nav */}
            <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center p-1 justify-center rounded-full bg-primary text-white">
                        <img src="/components/shirt-icon.png" className="flex self-center" />
                    </span>
                    <span className=" font-extrabold tracking-tight text-ink-strong text-[20px] uppercase">Fadarosi</span>
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
                <div className="absolute inset-0 bg-linear-to-br from-primary-light via-white to-white" />
                <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
                    <div>
                        <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight text-ink-strong sm:text-4xl lg:text-5xl">
                            Perawatan Pakaian <span className="text-primary">Premium</span> Tanpa Repot
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
                            Serahkan cucian kotor Anda kepada profesional. Kami menjemput, membersihkan dengan teknologi modern, dan mengantarkannya kembali dalam kondisi rapi sempurna.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Link to={startTo}>
                                <Button size="lg">
                                    Pesan Sekarang
                                </Button>
                            </Link>
                            <a href="#langkah">
                                <Button variant="outline" size="lg">
                                    Lihat Layanan
                                </Button>
                            </a>
                        </div>
                    </div>

                    <div className="relative">
                        <img src="/components/hero-image.png" alt="" className="w-full" />
                    </div>
                </div>
            </section>

            {/* Benefits */}
            <section className="border-y border-gray-100 bg-surface ">
                                <div className="flex justify-between items-end-safe mb-12 w-full mx-auto max-w-7xl px-4 pt-20 sm:px-6">
                    <div className=" max-w-2xl">
                        <span className="text-sm font-semibold uppercase tracking-widest text-primary">Benefits</span>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-strong">
                            Mengapa memilih <b className="text-primary">FADAROSI</b> laundry
                        </h2>
                    </div>
                </div>
                <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 sm:px-6 md:grid-cols-3">
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

            {/* Product list */}
            <section id="langkah" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
                <div className="flex justify-between items-end-safe mb-12 w-full">
                    <div className=" max-w-2xl">
                        <span className="text-sm font-semibold uppercase tracking-widest text-primary">Produk Perawatan Mandiri</span>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-strong">
                            Bawa keharuman <b className="text-primary">Premium</b><br /> ke rumah
                        </h2>
                    </div>
                    <Link to={"/toko"} className="flex gap-2 text-primary">
                            Lihat Semua Produk
                        <ArrowRight></ArrowRight>
                        </Link>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {products.map((p, i) => {
                        if (i < 4) {
                            return (
                                <div key={p.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white flex flex-col">
                                    <span className="flex w-full items-center justify-between ">
                                        <img src={p.image} alt={p.name} className="w-full max-h-64"/>
                                    </span>
                                    <span className="flex flex-col p-4">
                                    <h3 className="font-medium text-primary text-[16px]">{p.category}</h3>
                                    <h3 className="mt-0.5 font-bold text-ink-strong text-[18px]">{p.name}</h3>
                                    <span className="flex items-center justify-between">
                                        <h3 className="mt-2 leading-relaxed text-ink-strong font-bold text-[18px]">{formatRupiah(p.price)}</h3>
                                        <Link to={""} className="w-9 h-9 bg-primary rounded-xl text-white flex items-center justify-center">
                                            <ShoppingCart className="text-[12px] font-extrabold"></ShoppingCart>
                                        </Link>
                                    </span>
                                    </span>
                                </div>
                            )
                        }
                    })}
                </div>
            </section>


            {/* Steps */}
            <section id="cara-kerja" className="mx-auto px-4 py-20 sm:px-6 bg-surface">
                <div className="max-w-7xl mx-auto">
                    <div className="mx-auto mb-12 max-w-2xl text-center">
                        <span className="text-sm font-semibold uppercase tracking-widest text-primary">Cara Kerja</span>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-strong">
                            4 Langkah Mudah Cucian Bersih Sempurna
                        </h2>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map((step, i) => (
                            <div key={step.title} className="relative rounded-2xl border border-gray-200 bg-white p-6">
                                <span className="flex w-full items-center justify-between ">
                                    <span className="flex h-10 w-10 items-center justify-center text-4xl font-extrabold text-gray-300">
                                        0{i + 1}
                                    </span>
                                    {i < STEPS.length - 1 && (
                                        <ArrowRight className="text-gray-300 text-extrabold" />
                                    )}
                                </span>
                                <h3 className="mt-4 font-bold text-ink-strong">{step.title}</h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>


            {/* CTA */}
            <section className="bg-ink-strong py-16">
                <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center p-1 justify-center rounded-full bg-primary text-white">
                                <img src="/components/shirt-icon.png" className="" />
                            </span>
                            <span className=" font-extrabold tracking-tight text-primary-light text-[20px] uppercase">Fadarosi</span>
                        </div>
                        <p className="text-gray-600 font-extralight">
                            Layanan perawatan pakaian premium terbaik di Indonesia. Kami menjaga pakaian Anda tetap bersih, rapi, dan awet dengan teknologi ramah lingkungan.</p>
                        <span className="flex felx-col gap-4 ">
                            {socialMedia.map((val, i) => (
                            <Link to={val.src} target="blank" className="bg-ink p-2 w-9 h-9 overflow-hidden rounded-full flex items-center justify-center" key={i}>
                                <img src={val.img} alt="" className="w-4" />
                            </Link>
                            ))}
                        </span>
                    </div>
                    <div>
                        <p className="font-semibold text-primary-light text-[16px]">Layanan Kami</p>
                        <span className="flex flex-col gap-4 py-4">
                            {layanan.map((service) => (
                                <p className="text-ink text-[14px]" key={service.id}>{service.name}</p>
                            ))}
                        </span>
                    </div>
                    <div className="flex lg:col-span-2 lg:justify-end">
                        <div className="flex flex-col gap-4">
                            <p className="font-semibold text-primary-light text-[16px]">Hubungi Kami</p>
                            {footerCallUs.map((callUs, key) => (
                                <span className="flex gap-4" key={key}>
                                    <callUs.icon></callUs.icon>
                                    <p className="text-ink text-[14px] ">{callUs.desc}</p>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <footer className="bg-ink-strong border-t-2 border-ink w-full">
                <div className="mx-auto flex max-w-360 flex-col items-center justify-between gap-4 px-10 py-10 text-sm text-gray-400 sm:flex-row sm:px-6">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-600">© 2026 FADAROSI. Hak Cipta Dilindungi Undang-Undang.</span>
                    </div>
                    {/* <p>&copy; {new Date().getFullYear()} Fadarosi Laundry. Semua hak dilindungi.</p> */}
                </div>
            </footer>
        </div>
    )
}