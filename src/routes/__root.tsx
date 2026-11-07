import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { useI18n } from '../i18n/i18n'
import {
  Package,
  LogIn,
  LogOut,
  LayoutDashboard,
  Receipt,
  Settings2,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  FileX2,
  Globe,
  Boxes,
  ChevronDown,
  Check,
} from 'lucide-react'

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
  const { locale, setLocale, tr, tRole } = useI18n()

  const currentPath = useRouterState({ select: (s) => s.location.pathname })
  const isCashier = user?.role === 'cashier'

  const [isOperationsOpen, setIsOperationsOpen] = useState(false)
  const [isLocaleOpen, setIsLocaleOpen] = useState(false)

  const operationsMenuRef = useRef<HTMLDivElement>(null)
  const localeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (operationsMenuRef.current && !operationsMenuRef.current.contains(e.target as Node)) {
        setIsOperationsOpen(false)
      }
      if (localeMenuRef.current && !localeMenuRef.current.contains(e.target as Node)) {
        setIsLocaleOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isOperationsActive = ['/sales', '/supplies', '/movements', '/write-offs'].some((p) => currentPath.startsWith(p))

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
                    {tr('Панель', 'Dashboard')}
                  </Link>
                )}
                <Link
                  to="/products"
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  {tr('Товари', 'Products')}
                </Link>

                {/* Operations Dropdown for Admin/Stockkeeper, or direct Sales link for Cashier */}
                {isCashier ? (
                  <Link
                    to="/sales"
                    className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                  >
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    {tr('Продажі', 'Sales')}
                  </Link>
                ) : (
                  <div className="relative" ref={operationsMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsOperationsOpen(!isOperationsOpen)}
                      className={`px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isOperationsActive ? 'bg-slate-100 text-blue-600 font-semibold' : ''
                      }`}
                    >
                      <Boxes className="w-4 h-4" />
                      <span>{tr('Операції', 'Operations')}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                          isOperationsOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOperationsOpen && (
                      <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl py-1.5 z-50">
                        <Link
                          to="/sales"
                          onClick={() => setIsOperationsOpen(false)}
                          className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors [&.active]:text-blue-600 [&.active]:bg-blue-50/60"
                        >
                          <Receipt className="w-4 h-4 text-emerald-600" />
                          <span>{tr('Продажі', 'Sales')}</span>
                        </Link>
                        <Link
                          to="/supplies"
                          onClick={() => setIsOperationsOpen(false)}
                          className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors [&.active]:text-blue-600 [&.active]:bg-blue-50/60"
                        >
                          <Truck className="w-4 h-4 text-amber-600" />
                          <span>{tr('Поставки', 'Supplies')}</span>
                        </Link>
                        <Link
                          to="/movements"
                          onClick={() => setIsOperationsOpen(false)}
                          className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors [&.active]:text-blue-600 [&.active]:bg-blue-50/60"
                        >
                          <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                          <span>{tr('Переміщення', 'Movements')}</span>
                        </Link>
                        <Link
                          to="/write-offs"
                          onClick={() => setIsOperationsOpen(false)}
                          className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-rose-50/60 flex items-center gap-2.5 transition-colors [&.active]:text-rose-600 [&.active]:bg-rose-50/80"
                        >
                          <FileX2 className="w-4 h-4 text-rose-600" />
                          <span>{tr('Списання', 'Write-Offs')}</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {!isCashier && (
                  <Link
                    to="/management"
                    className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors [&.active]:bg-slate-100 [&.active]:text-blue-600 flex items-center gap-2"
                  >
                    <Settings2 className="w-4 h-4" />
                    {tr('Управління', 'Management')}
                  </Link>
                )}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Compact Locale Dropdown */}
            <div className="relative" ref={localeMenuRef}>
              <button
                type="button"
                onClick={() => setIsLocaleOpen(!isLocaleOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title={tr('Змінити мову інтерфейсу', 'Switch interface language')}
              >
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>{locale === 'uk' ? 'UA' : 'EN'}</span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform ${isLocaleOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isLocaleOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-white border border-slate-200/90 rounded-2xl shadow-xl py-1.5 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setLocale('uk')
                      setIsLocaleOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-xs text-left font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      locale === 'uk' ? 'text-blue-600 bg-blue-50/60 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🇺🇦</span>
                      <span>Українська</span>
                    </span>
                    {locale === 'uk' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocale('en')
                      setIsLocaleOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-xs text-left font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      locale === 'en' ? 'text-blue-600 bg-blue-50/60 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🇬🇧</span>
                      <span>English</span>
                    </span>
                    {locale === 'en' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </div>
              )}
            </div>

            {token ? (
              <div className="flex items-center gap-3">
                {cartCount > 0 && (
                  <Link
                    to="/sales"
                    search={{ openCheckout: true }}
                    className="relative p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                    title={tr(`Кошик продажів (${cartCount} шт.)`, `Sales Cart (${cartCount} items)`)}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                      {cartCount}
                    </span>
                  </Link>
                )}
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-900">{user?.email}</span>
                  <span className="text-[10px] uppercase font-bold text-blue-600">{tRole(user?.role)}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title={tr('Вийти', 'Logout')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {tr('Вийти', 'Logout')}
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                {tr('Увійти', 'Sign In')}
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
