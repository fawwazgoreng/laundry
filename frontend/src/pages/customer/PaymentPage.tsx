import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AlertCircle, Check, Copy, Truck, Wallet } from "lucide-react"
import { orderApi, paymentApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah, PAYMENT_METHOD_LABELS } from "../../lib/utils"
import type { OrderDetail, Payment } from "../../lib/types"
import { Button, Card, Spinner } from "../../components/ui"

export default function PaymentPage() {
    const { orderId } = useParams<{ orderId: string }>()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [payment, setPayment] = useState<Payment | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        let mounted = true
        if (!orderId) return
        Promise.all([orderApi.get(orderId), paymentApi.byOrder(orderId)])
            .then(([o, p]) => {
                if (!mounted) return
                setOrder(o)
                setPayment(p)
            })
            .catch((err) => {
                if (mounted) setError(err instanceof ApiError ? err.message : "Gagal memuat pembayaran")
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [orderId])

    const copyVa = async () => {
        if (!payment?.transaction_id) return
        await navigator.clipboard.writeText(payment.transaction_id)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Spinner size="lg" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <Card className="p-8 text-center">
                <p className="text-sm text-gray-500">{error ?? "Pesanan tidak ditemukan"}</p>
                <Link to="/riwayat">
                    <Button className="mt-4">Lihat Riwayat Pesanan</Button>
                </Link>
            </Card>
        )
    }

    const isPaid = payment?.status === "PAID"

    const discountSections: Array<{ label: string; value: number | null }> = [
        { label: "Diskon Premium Member", value: order.discount_member > 0 ? order.discount_member : null },
        { label: "Diskon Voucher Promo", value: order.discount_voucher > 0 ? order.discount_voucher : null },
    ]

    return (
        <div>
            <h1 className="text-2xl font-bold text-ink-strong">Pembayaran</h1>
            <p className="mt-1 text-sm text-gray-500">
                Selesaikan pembayaran untuk <span className="font-semibold text-ink-strong">{order.order_id}</span>
            </p>

            {isPaid && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                        <Check className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="font-bold text-green-700">Pembayaran Diterima 🎉</p>
                        <p className="mt-1 text-sm text-green-600">
                            Pesanan Anda telah terverifikasi otomatis. Anda dapat memantau progres pengerjaan dari halaman riwayat.
                        </p>
                    </div>
                </div>
            )}

            {!isPaid && order.payment_method === "transfer_bank" && (
                <div className="mt-6 grid gap-6 lg:grid-cols-3">
                    <Card className="p-6 lg:col-span-2">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            Selesaikan pembayaran sebelum waktu habis
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                            Pesanan dibuat tanggal {new Date(order.created_at).toLocaleDateString("id-ID")} &middot; status periode pembayaran 24 jam
                        </p>

                        <div className="mt-5 space-y-2 rounded-xl bg-surface p-4 text-xs text-gray-600">
                            <p>1. Selesaikan pembayaran dalam 1x24 jam sejak pesanan dibuat. Lewat batas waktu, pesanan otomatis dibatalkan dan stok kembali.</p>
                            <p>2. Transfer tepat sesuai nominal yang tertera — tanpa dibulatkan atau ditambah kode unik. Nomor Virtual Account khusus untuk transaksi ini.</p>
                            <p>3. Status pembayaran terverifikasi otomatis oleh sistem dalam 1-5 menit setelah dana diterima.</p>
                            <p>4. Nomor Virtual Account hanya berlaku satu kali untuk transaksi ini.</p>
                            <p>5. Simpan bukti transfer sampai status pesanan berubah menjadi "Dibayar".</p>
                        </div>

                        <div className="mt-6 rounded-2xl border border-gray-200 p-6">
                            <p className="text-sm font-semibold text-ink-strong">Bank BRI - akun virtual</p>
                            <p className="mt-1 text-xs text-gray-500">Silahkan transfer ke nomor berikut</p>
                            <div className="mt-4 rounded-xl bg-ink-strong p-5 text-center text-white">
                                <p className="text-xs text-gray-400">Nomor Virtual Account</p>
                                <p className="mt-1 text-2xl font-extrabold tracking-wider">{payment?.transaction_id ?? "-"}</p>
                                <Button size="sm" variant="secondary" className="mt-3" onClick={copyVa}>
                                    <Copy className="h-3.5 w-3.5" /> {copied ? "Tersalin!" : "Salin Nomor"}
                                </Button>
                            </div>
                            <div className="mt-4 flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                                <span className="text-sm text-gray-600">Total nominal yang harus dibayarkan</span>
                                <span className="text-lg font-extrabold text-ink-strong">{formatRupiah(order.total_amount)}</span>
                            </div>
                        </div>

                        <p className="mt-4 text-xs text-gray-400">
                            Pastikan nama penerima yang tampil pada layar konfirmasi adalah <span className="font-semibold text-ink-strong">FADAROSI LAUNDRY</span>.
                        </p>
                    </Card>

                    <PaymentSummary order={order} discountSections={discountSections} />
                </div>
            )}

            {!isPaid && order.payment_method === "cod" && (
                <Card className="mt-6 p-8">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                            <Truck className="h-6 w-6" />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-ink-strong">Bayar di Tempat (COD)</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Siapkan <span className="font-bold text-ink-strong">{formatRupiah(order.total_amount)}</span> tunai
                                untuk dibayarkan kepada kurir Fadarosi saat pakaian diantar.
                            </p>
                            <p className="mt-3 text-xs text-gray-400">
                                Pembayaran akan diverifikasi otomatis oleh admin saat pesanan selesai diantar.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {!isPaid && order.payment_method === "fadarosipay" && (
                <Card className="mt-6 p-8">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                            <Wallet className="h-6 w-6" />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-ink-strong">FADAROSI Pay / E-Wallet</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Total <span className="font-bold text-ink-strong">{formatRupiah(order.total_amount)}</span> telah
                                dibebankan ke saldo FADAROSI Pay Anda secara otomatis.
                            </p>
                            <p className="mt-3 text-xs text-gray-400">Pembayaran diproses instan dengan aman.</p>
                        </div>
                    </div>
                </Card>
            )}

            <div className="mt-8 flex gap-3">
                <Link to={`/riwayat/${order.order_id}`}>
                    <Button variant="outline">Lihat Detail Pesanan</Button>
                </Link>
                <Link to="/toko">
                    <Button variant="ghost">Belanja Produk Lain</Button>
                </Link>
            </div>
        </div>
    )
}

function PaymentSummary({
    order,
    discountSections,
}: {
    order: OrderDetail
    discountSections: Array<{ label: string; value: number | null }>
}) {
    const itemCount = order.services.length + order.products.reduce((s, p) => s + p.qty, 0)
    return (
        <Card className="h-fit p-6">
            <h3 className="font-bold text-ink-strong">Ringkasan Belanja</h3>
            <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600">Total Harga ({itemCount} Barang)</span>
                    <span className="font-medium text-ink-strong">{formatRupiah(order.total_laundry + order.total_product)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Biaya Pengiriman</span>
                    <span className="font-medium text-ink-strong">{formatRupiah(order.delivery_fee)}</span>
                </div>
                {discountSections.map(
                    (d) =>
                        d.value !== null && (
                            <div key={d.label} className="flex justify-between text-green-600">
                                <span>{d.label}</span>
                                <span>-{formatRupiah(d.value)}</span>
                            </div>
                        ),
                )}
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4">
                <span className="font-semibold text-ink-strong">Total Pembayaran</span>
                <span className="text-2xl font-extrabold text-primary">{formatRupiah(order.total_amount)}</span>
            </div>
            <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-[11px] text-gray-500">
                Metode: {PAYMENT_METHOD_LABELS[order.payment_method]}
            </p>
        </Card>
    )
}