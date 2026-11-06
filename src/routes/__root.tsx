import { createRootRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { Package, LogIn, LogOut, LayoutDashboard, Receipt, Settings2, ShoppingCart, Truck } from 'lucide-react'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const logout = useAuthStore((state) => state.logout)
  const cartItems = useCartStore((state) => state.items)
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const navigate = useNavigate()

  const isCashier = user?.role === 'cashier'

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 font-bold text-slate-900 text-lg hover:opacity-90">
              <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                <Package className="w-5 h-5" />
              </div>
              <span>Products Tracker</span>
            </Link>

            {token && (
              <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
                {!isCashier && (
                  <Link
                    to="/"
                    className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                )}
                <Link
                  to="/products"
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Products
                </Link>
                <Link
                  to="/sales"
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Sales
                </Link>
                {!isCashier && (
                  <Link
                    to="/supplies"
                    className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                  >
                    <Truck className="w-4 h-4" />
                    Supplies
                  </Link>
                )}
                {!isCashier && (
                  <Link
                    to="/management"
                    className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                  >
                    <Settings2 className="w-4 h-4" />
                    Management
                  </Link>
                )}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {token ? (
              <div className="flex items-center gap-3">
                {cartCount > 0 && (
                  <Link
                    to="/sales"
                    search={{ openCheckout: true }}
                    className="relative p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                    title={`Sales Cart (${cartCount} items)`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                      {cartCount}
                    </span>
                  </Link>
                )}
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-900">{user?.email}</span>
                  <span className="text-[10px] uppercase font-bold text-blue-600">{user?.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <Outlet />
      </main>

      <TanStackRouterDevtools position="bottom-right" />
    </div>
  )
}
