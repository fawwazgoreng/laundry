import { useCallback, useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { FileText, KeyRound, MapPin, Plus, Trash2, UserRound } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { addressApi, authApi, orderApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { formatRupiah } from "../../lib/utils"
import type { Address, AddressInput, OrderListItem } from "../../lib/types"
import { Button, Card, EmptyState, Input, Modal, Select, Spinner, StatusBadge, Textarea } from "../../components/ui"
import { cx } from "../../lib/utils"

const TABS = [
    { key: "riwayat", label: "Riwayat" },
    { key: "alamat", label: "Alamat" },
    { key: "profil", label: "Profil" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export default function ProfilePage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const validTab = TABS.find((t) => t.key === (searchParams.get("tab") as TabKey))
    const [tab, setTab] = useState<TabKey>(validTab?.key ?? "riwayat")

    const changeTab = (next: TabKey) => {
        setTab(next)
        setSearchParams(next === "riwayat" ? {} : { tab: next })
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-ink-strong">Pengaturan Akun</h1>
            <p className="mt-1 text-sm text-gray-500">Kelola riwayat, alamat, dan profil akun Anda.</p>

            <div className="mt-6 flex gap-2 border-b border-gray-200">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => changeTab(t.key)}
                        className={cx(
                            "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                            tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700",
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="mt-6">
                {tab === "riwayat" && <RiwayatTab />}
                {tab === "alamat" && <AlamatTab />}
                {tab === "profil" && <ProfilTab />}
            </div>
        </div>
    )
}

function RiwayatTab() {
    const [orders, setOrders] = useState<OrderListItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        orderApi
            .mine({ page: 1, perPage: 5 })
            .then((res) => setOrders(res.data))
            .catch(() => undefined)
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner />
            </div>
        )
    }

    if (orders.length === 0) {
        return <EmptyState message="Belum ada pesanan." action={<Link to="/layanan"><Button>Pesan Sekarang</Button></Link>} />
    }

    return (
        <Card className="overflow-hidden p-0">
            {orders.map((o, i) => (
                <Link
                    key={o.order_id}
                    to={`/riwayat/${o.order_id}`}
                    className={cx(
                        "flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface/60",
                        i > 0 && "border-t border-gray-100",
                    )}
                >
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                            <FileText className="h-4 w-4" />
                        </span>
                        <div>
                            <p className="text-sm font-bold text-ink-strong">{o.order_id}</p>
                            <p className="text-xs text-gray-400">
                                {new Date(o.created_at).toLocaleDateString("id-ID")} &middot; {formatRupiah(o.total_amount)}
                            </p>
                        </div>
                    </div>
                    <StatusBadge status={o.status} />
                </Link>
            ))}
        </Card>
    )
}

function AlamatTab() {
    const [addresses, setAddresses] = useState<Address[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Address | null>(null)
    const [error, setError] = useState("")

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            setAddresses(await addressApi.list())
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memuat alamat")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void Promise.resolve().then(load)
    }, [load])

    const handlePrimary = async (id: number) => {
        await addressApi.setPrimary(id)
        load()
    }

    const handleDelete = async (id: number) => {
        await addressApi.remove(id)
        load()
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{addresses.length} alamat tersimpan</p>
                <Button onClick={() => { setEditing(null); setShowModal(true) }}>
                    <Plus className="h-4 w-4" /> Tambah Alamat
                </Button>
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            {loading ? (
                <div className="flex justify-center py-14">
                    <Spinner />
                </div>
            ) : addresses.length === 0 ? (
                <Card className="mt-5">
                    <EmptyState message="Belum ada alamat tersimpan." />
                </Card>
            ) : (
                <div className="mt-5 space-y-3">
                    {addresses.map((a) => (
                        <Card key={a.id} className="flex items-center justify-between gap-4 p-5">
                            <div className="flex items-start gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                                    <MapPin className="h-4 w-4" />
                                </span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-ink-strong">{a.label}</p>
                                        {a.is_primary && (
                                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Utama</span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500">{a.address_text}</p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <Button variant="secondary" size="sm" disabled={a.is_primary} onClick={() => handlePrimary(a.id)}>
                                    Jadikan Utama
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setShowModal(true) }}>
                                    Edit
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(a.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {showModal && (
                <AddressModal
                    address={editing}
                    onClose={() => setShowModal(false)}
                    onSaved={() => {
                        setShowModal(false)
                        load()
                    }}
                />
            )}
        </div>
    )
}

function AddressModal({ address, onClose, onSaved }: { address: Address | null; onClose: () => void; onSaved: () => void }) {
    const [label, setLabel] = useState(address?.label ?? "Rumah")
    const [addressText, setAddressText] = useState(address?.address_text ?? "")
    const [latitude, setLatitude] = useState(address?.latitude?.toString() ?? "")
    const [longitude, setLongitude] = useState(address?.longitude?.toString() ?? "")
    const [error, setError] = useState("")
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setError("")
        if (!addressText.trim()) {
            setError("Alamat tidak boleh kosong")
            return
        }
        const payload: AddressInput = {
            label,
            address_text: addressText,
            latitude: latitude ? parseFloat(latitude) : 0,
            longitude: longitude ? parseFloat(longitude) : 0,
        }
        setSaving(true)
        try {
            if (address) await addressApi.update(address.id, payload)
            else await addressApi.create(payload)
            onSaved()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal menyimpan alamat")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={address ? "Edit Alamat" : "Tambah Alamat Baru"} onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Label</label>
                    <Select value={label} onChange={(e) => setLabel(e.target.value)}>
                        <option value="Rumah">Rumah</option>
                        <option value="Kantor">Kantor</option>
                        <option value="Apartemen">Apartemen</option>
                    </Select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Alamat Lengkap</label>
                    <Textarea rows={3} placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota" value={addressText} onChange={(e) => setAddressText(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Latitude</label>
                        <Input placeholder="-6.2088" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Longitude</label>
                        <Input placeholder="106.8456" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                    </div>
                </div>
                {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose}>Batal</Button>
                    <Button loading={saving} onClick={handleSave}>Simpan</Button>
                </div>
            </div>
        </Modal>
    )
}

function ProfilTab() {
    const { user, refreshProfile } = useAuth()
    const [fullName, setFullName] = useState(user?.username ?? "")
    const [phone, setPhone] = useState(user?.phone ?? "")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [saving, setSaving] = useState(false)

    const handleSaveProfile = async () => {
        setError("")
        setSuccess("")
        setSaving(true)
        try {
            await authApi.updateProfile({
                ...(fullName !== user?.username ? { username: fullName } : {}),
                ...(phone !== user?.phone ? { phone } : {}),
            })
            await refreshProfile()
            setSuccess("Profil berhasil diperbarui")
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Gagal memperbarui profil")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
                <h3 className="flex items-center gap-2 font-bold text-ink-strong">
                    <UserRound className="h-4 w-4 text-primary" /> Data Profil
                </h3>
                <div className="mt-5 space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Email</label>
                        <Input value={user?.email ?? ""} disabled className="bg-surface/60" />
                        <p className="mt-1 text-[11px] text-gray-400">Email tidak dapat diubah</p>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Nama Pengguna</label>
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-ink-strong">Nomor Telepon</label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                </div>
                <div className="mt-5 flex items-center gap-3">
                    <Button loading={saving} onClick={handleSaveProfile}>Simpan Perubahan</Button>
                    {success && <span className="text-sm font-medium text-green-600">{success}</span>}
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="flex items-center gap-2 font-bold text-ink-strong">
                    <KeyRound className="h-4 w-4 text-primary" /> Keamanan
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                    Anda dapat mengubah kata sandi melalui halaman pengaturan. Hubungi admin jika memerlukan bantuan.
                </p>
                <div className="mt-5">
                    <label className="mb-1 block text-sm font-medium text-ink-strong">Kata Sandi</label>
                    <div className="flex gap-3">
                        <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <Button variant="outline">Ganti</Button>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-400">Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.</p>
                </div>
                {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
            </Card>
        </div>
    )
}