import { useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { LogOut, Menu, X } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { cx } from "../lib/utils"
import { Button } from "./ui"

interface NavItem {
    to: string
    label: string
}

export function Topbar({ items }: { items: NavItem[] }) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)

    const handleLogout = async () => {
        await logout()
        navigate("/")
    }

    return (
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
            <div className="mx-auto grid grid-cols-3 h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-8 col-span-1">
                    <Link to={user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/"} className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                            <img src="/components/shirt-icon.png" className="h-5 w-5" />
                        </span>
                        <span className="text-lg font-extrabold tracking-tight text-primary">Fadarosi</span>
                    </Link>
                </div>

                <nav className="hidden items-center justify-center gap-1 md:flex col-span-1">
                        {items.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/dashboard" || item.to === "/admin"}
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                                        isActive ? "bg-primary-light text-primary" : "text-ink hover:bg-surface",
                                    )
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                </nav>

                <div className="hidden items-center justify-end gap-3 md:flex col-span-1">
                    <div className="flex items-center gap-2.5 rounded-xl bg-white py-1.5 pl-1.5 pr-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                            {user?.username?.charAt(0)?.toUpperCase()}
                        </span>
                        <div className="leading-tight">
                            <p className="text-sm font-semibold text-ink-strong">{user?.username} {user?.role === "admin" ? "( Admin )" : ""}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-surface hover:text-primary"
                        title="Keluar"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>

                <button
                    onClick={() => setOpen((v) => !v)}
                    className="rounded-lg p-2 text-ink-strong md:hidden"
                >
                    {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {open && (
                <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-2 md:hidden">
                    <nav className="flex flex-col gap-1">
                        {items.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/dashboard" || item.to === "/admin"}
                                onClick={() => setOpen(false)}
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-lg px-3 py-2.5 text-sm font-semibold",
                                        isActive ? "bg-primary-light text-primary" : "text-ink",
                                    )
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-sm font-bold text-primary">
                                    {user?.username?.charAt(0)?.toUpperCase()}
                                </span>
                                <span className="text-sm font-semibold text-ink-strong">{user?.username}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                Keluar
                            </Button>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    )
}