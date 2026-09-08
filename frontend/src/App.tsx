import { Route, Routes } from "react-router-dom"
import { useAuth } from "./context/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { GuestLayout } from "./layouts/GuestLayout"
import { CustomerLayout } from "./layouts/CustomerLayout"
import { AdminLayout } from "./layouts/AdminLayout"
import LandingPage from "./pages/public/LandingPage"
import { LoginPage, RegisterPage } from "./pages/public/AuthPages"
import CustomerDashboard from "./pages/customer/CustomerDashboard"
import OrderWizard from "./pages/customer/OrderWizard"
import ProductShopPage from "./pages/customer/ProductShopPage"
import OrderHistoryPage from "./pages/customer/OrderHistoryPage"
import OrderDetailPage from "./pages/customer/OrderDetailPage"
import PaymentPage from "./pages/customer/PaymentPage"
import ProfilePage from "./pages/customer/ProfilePage"
import AdminDashboard from "./pages/admin/AdminDashboard"
import AdminOrders from "./pages/admin/AdminOrders"
import AdminOrderDetail from "./pages/admin/AdminOrderDetail"
import AdminServices from "./pages/admin/AdminServices"
import AdminProducts from "./pages/admin/AdminProducts"
import AdminSettings from "./pages/admin/AdminSettings"

function NotFound() {
    const { user } = useAuth()
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
            <p className="text-6xl font-black text-primary">404</p>
            <h1 className="mt-4 text-xl font-bold text-ink-strong">Halaman Tidak Ditemukan</h1>
            <p className="mt-2 text-sm text-gray-500">Halaman yang Anda cari mungkin telah dipindahkan atau dihapus.</p>
            <a href={user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/"} className="mt-6">
                <span className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark">
                    Kembali ke Beranda
                </span>
            </a>
        </div>
    )
}

export default function App() {
    return (
        <Routes>
            {/* Public */}
            <Route element={<GuestLayout />}>
                <Route index element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Customer (logged in) */}
            <Route element={<ProtectedRoute />}>
                <Route element={<CustomerLayout />}>
                    <Route path="/dashboard" element={<CustomerDashboard />} />
                    <Route path="/layanan" element={<OrderWizard />} />
                    <Route path="/toko" element={<ProductShopPage />} />
                    <Route path="/riwayat" element={<OrderHistoryPage />} />
                    <Route path="/riwayat/:orderId" element={<OrderDetailPage />} />
                    <Route path="/payment/:orderId" element={<PaymentPage />} />
                    <Route path="/profil" element={<ProfilePage />} />
                </Route>
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute adminOnly />}>
                <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/pesanan" element={<AdminOrders />} />
                    <Route path="/admin/pesanan/:orderId" element={<AdminOrderDetail />} />
                    <Route path="/admin/layanan" element={<AdminServices />} />
                    <Route path="/admin/produk" element={<AdminProducts />} />
                    <Route path="/admin/pengaturan" element={<AdminSettings />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    )
}