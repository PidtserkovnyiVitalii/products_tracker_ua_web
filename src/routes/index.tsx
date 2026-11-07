import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../i18n/i18n'
import { api } from '../api/api'
import {
  Package,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Settings2,
  FolderTree,
  MapPin,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const { tr, tRole } = useI18n()
  const isCashier = user?.role === 'cashier'
  const isStaff = user?.role === 'admin' || user?.role === 'stockkeeper'

  // Fetch summary stats for Staff / Admin
  const { data: productsCount = 0 } = useQuery<number>({
    queryKey: ['stats', 'products'],
    queryFn: async () => {
      const res = await api.get('/api/v1/products')
      return Array.isArray(res.data) ? res.data.length : 0
    },
    enabled: !!token && isStaff,
  })

  const { data: locationsCount = 0 } = useQuery<number>({
    queryKey: ['stats', 'locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return Array.isArray(res.data) ? res.data.length : 0
    },
    enabled: !!token && isStaff,
  })

  const { data: categoriesCount = 0 } = useQuery<number>({
    queryKey: ['stats', 'categories'],
    queryFn: async () => {
      const res = await api.get('/api/v1/categories')
      return Array.isArray(res.data) ? res.data.length : 0
    },
    enabled: !!token && isStaff,
  })

  const { data: salesCount = 0 } = useQuery<number>({
    queryKey: ['stats', 'sales'],
    queryFn: async () => {
      const res = await api.get('/api/v1/sales')
      return Array.isArray(res.data) ? res.data.length : 0
    },
    enabled: !!token && isStaff,
  })

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-4 h-4" />
              Products Tracker UA
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {user
                ? tr(`З поверненням, ${user.email}`, `Welcome back, ${user.email}`)
                : tr('Вітаємо у Products Tracker', 'Welcome to Products Tracker')}
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-xl">
              {isCashier
                ? tr(
                    'Касовий POS-термінал: пошук у каталозі іграшок, перевірка залишків у магазинах, оформлення продажів та повернень.',
                    'Cashier Point-of-Sale terminal: search toys catalog, verify store stocks, process customer sales, and handle returns.'
                  )
                : tr(
                    'Централізована панель управління: каталог товарів, дерево категорій, залишки на складах і в магазинах та замовлення клієнтів.',
                    'Centralized operational dashboard: catalog inventory, category tree taxonomy, physical location stocks, and customer orders.'
                  )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {token ? (
              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <div className="text-xs text-slate-300">{tr('Активна роль', 'Active Role')}</div>
                  <div className="text-sm font-bold uppercase tracking-wider text-white">
                    {tRole(user?.role)}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-2xl shadow-lg transition-all"
              >
                {tr('Увійти для початку роботи', 'Sign In to Start')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Staff Operational Stats KPI Bar */}
      {token && isStaff && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tr('Товари', 'Products')}
              </div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{productsCount}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tr('Локації', 'Locations')}
              </div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{locationsCount}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tr('Категорії', 'Categories')}
              </div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{categoriesCount}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tr('Продажі', 'Sales Orders')}
              </div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{salesCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Focused Action Cards */}
      {token && isCashier && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/sales"
            className="group p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xs hover:shadow-xl hover:border-emerald-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Receipt className="w-7 h-7" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-2">
                {tr('Касовий термінал', 'Point of Sale')}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-between">
                <span>{tr('Продажі та Каса', 'Sales & Checkout')}</span>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                {tr(
                  'Створюйте замовлення зі скануванням штрихкодів камерою, застосовуйте знижки, приймайте оплату готівкою чи карткою та оформлюйте повернення.',
                  'Create new customer orders with camera barcode scanning, apply discounts, choose cash/card payments, and process receipt refunds.'
                )}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm font-bold text-emerald-600">
              <span>{tr('Відкрити касовий термінал', 'Open Sales Terminal')}</span>
              <span>&rarr;</span>
            </div>
          </Link>

          <Link
            to="/products"
            className="group p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xs hover:shadow-xl hover:border-blue-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Package className="w-7 h-7" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-2">
                {tr('Каталог і залишки', 'Catalog & Stock')}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-between">
                <span>{tr('Каталог товарів', 'Products Catalog')}</span>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                {tr(
                  'Шукайте та переглядайте іграшки, фільтруйте за категоріями та магазинами, перевіряйте наявність і додавайте товари до кошика.',
                  'Search and review toys, filter by multiple categories and store locations, verify unit availability, and add items directly to cart.'
                )}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm font-bold text-blue-600">
              <span>{tr('Переглянути каталог', 'Browse Catalog')}</span>
              <span>&rarr;</span>
            </div>
          </Link>
        </div>
      )}

      {/* Staff (Stockkeeper / Admin) 3 Primary Action Cards */}
      {token && isStaff && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/products"
            className="group p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-lg hover:border-blue-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center justify-between">
                <span>{tr('Товари та Залишки', 'Products & Inventory')}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                {tr(
                  'Керуйте позиціями каталогу, редагуйте ціни й описи, коригуйте складські залишки та друкуйте етикетки зі штрихкодами.',
                  'Manage catalog items, edit prices & descriptions, adjust warehouse stocks, and print barcode price stickers.'
                )}
              </p>
            </div>
            <div className="mt-6 text-xs font-bold text-blue-600 flex items-center gap-1">
              <span>{tr('Керувати товарами', 'Manage Products')}</span>
              <span>&rarr;</span>
            </div>
          </Link>

          <Link
            to="/sales"
            className="group p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-lg hover:border-emerald-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center justify-between">
                <span>{tr('Продажі та Чеки', 'Sales & Orders')}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                {tr(
                  'Оформлюйте продажі клієнтам, відстежуйте виручку, друкуйте чеки 80мм/A4 та виконуйте повернення з відновленням залишків.',
                  'Process customer sales, track transaction revenue, print 80mm/A4 receipts, and perform stock-restoring refunds.'
                )}
              </p>
            </div>
            <div className="mt-6 text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span>{tr('Переглянути продажі', 'View Sales')}</span>
              <span>&rarr;</span>
            </div>
          </Link>

          <Link
            to="/management"
            className="group p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-lg hover:border-purple-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Settings2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center justify-between">
                <span>{tr('Управління', 'Management')}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                {tr(
                  'Налаштовуйте ієрархічне дерево категорій, фізичні магазини, склади та постачальників по всій Україні.',
                  'Configure hierarchical category tree taxonomy and physical store & warehouse locations across Ukraine.'
                )}
              </p>
            </div>
            <div className="mt-6 text-xs font-bold text-purple-600 flex items-center gap-1">
              <span>{tr('Налаштувати структуру', 'Configure Structure')}</span>
              <span>&rarr;</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
