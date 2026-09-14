import { Route, Routes } from "react-router-dom"
import { useAuth } from "./context/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { GuestLayout } from "./layouts/GuestLayout"
import { CustomerLayout } from "./layouts/CustomerLayout"
import { AdminLayout } from "./layouts/AdminLayout"
import LandingPage from "./pages/public/LandingPage"
import { LoginPage, RegisterPage } from "./pages/public/AuthPages"
import { DashboardPage } from "./pages/customer/DashboardPage"
import { LaundryWizardPage } from "./pages/customer/LaundryWizardPage"
import { ShopPage } from "./pages/customer/ShopPage"
import { CheckoutPage } from "./pages/customer/CheckoutPage"
import { OrderDetailPage } from "./pages/customer/OrderDetailPage"
import { OrderTrackingPage } from "./pages/customer/OrderTrackingPage"
import { PaymentPage } from "./pages/customer/PaymentPage"
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage"
import { AdminOrderManagementPage } from "./pages/admin/AdminOrderManagementPage"
import { AdminProductManagementPage } from "./pages/admin/AdminProductManagementPage"
import { AdminServiceManagementPage } from "./pages/admin/AdminServiceManagementPage"
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage"
import { UserOrderHistory } from "./pages/customer/HistoryPage"

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
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/history" element={<UserOrderHistory />} />
                    <Route path="/layanan" element={<LaundryWizardPage />} />
                    <Route path="/toko" element={<ShopPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/riwayat/:orderId" element={<OrderDetailPage />} />
                    <Route path="/tracking/:orderId" element={<OrderTrackingPage />} />
                    <Route path="/payment/:orderId" element={<PaymentPage />} />
                </Route>
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute adminOnly />}>
                <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/admin/pesanan" element={<AdminOrderManagementPage />} />
                    <Route path="/admin/layanan" element={<AdminServiceManagementPage />} />
                    <Route path="/admin/produk" element={<AdminProductManagementPage />} />
                    <Route path="/admin/pengaturan" element={<AdminSettingsPage />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    )
}