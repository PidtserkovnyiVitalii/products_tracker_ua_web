import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../i18n/i18n'
import { api } from '../api/api'
import {
  Receipt,
  Truck,
  ArrowLeftRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  User as UserIcon,
  Eye,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

interface DashboardSale {
  id: string
  created_at: string
  status: 'completed' | 'refunded'
  total_price: number
  payment_method: 'cash' | 'card'
  user?: {
    id: string
    email: string
    role: string
  }
}

interface DashboardSupply {
  id: string
  reference_number?: string | null
  status: 'pending' | 'received' | 'cancelled'
  created_at: string
  supplier?: {
    id: string
    name: string
  } | null
  location?: {
    id: string
    name: string
  } | null
  total_cost: number
  total_items_count: number
  total_units_count: number
}

interface DashboardTransfer {
  id: string
  reference_number?: string | null
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
  source_location?: {
    id: string
    name: string
  } | null
  destination_location?: {
    id: string
    name: string
  } | null
  total_items_count: number
  total_units_count: number
}

function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const { tr, tRole } = useI18n()
  const isCashier = user?.role === 'cashier'
  const isStaff = user?.role === 'admin' || user?.role === 'stockkeeper'

  // Fetch Sales (Available to all authenticated roles)
  const { data: sales = [] } = useQuery<DashboardSale[]>({
    queryKey: ['sales', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/v1/sales')
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!token,
  })

  // Fetch Supplies (Staff only)
  const { data: supplies = [] } = useQuery<DashboardSupply[]>({
    queryKey: ['supplies', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/v1/supplies')
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!token && isStaff,
  })

  // Fetch Transfers (Staff only)
  const { data: transfers = [] } = useQuery<DashboardTransfer[]>({
    queryKey: ['transfers', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/v1/transfers')
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!token && isStaff,
  })

  // Attention & Sales Calculations
  const metrics = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const dayOfWeek = now.getDay() // 0 = Sun, 1 = Mon, ...
    const diffToMonday = (dayOfWeek + 6) % 7
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).getTime()

    const completedSales = sales.filter((s) => s.status === 'completed')

    // Today's Sales
    const todaySales = completedSales.filter((s) => new Date(s.created_at).getTime() >= startOfToday)
    const todayRevenue = todaySales.reduce((sum, s) => sum + (Number(s.total_price) || 0), 0)

    // This Week's Sales
    const weekSales = completedSales.filter((s) => new Date(s.created_at).getTime() >= startOfWeek)
    const weekRevenue = weekSales.reduce((sum, s) => sum + (Number(s.total_price) || 0), 0)

    // Cashier Personal Breakdown
    const mySales = completedSales.filter(
      (s) => Boolean(user?.email && s.user?.email === user.email)
    )
    const myTodaySales = mySales.filter((s) => new Date(s.created_at).getTime() >= startOfToday)
    const myTodayRevenue = myTodaySales.reduce((sum, s) => sum + (Number(s.total_price) || 0), 0)

    const myWeekSales = mySales.filter((s) => new Date(s.created_at).getTime() >= startOfWeek)
    const myWeekRevenue = myWeekSales.reduce((sum, s) => sum + (Number(s.total_price) || 0), 0)

    // Unfinished (pending) supplies & transfers
    const pendingSupplies = supplies.filter((s) => s.status === 'pending')
    const pendingTransfers = transfers.filter((t) => t.status === 'pending')

    return {
      todaySalesCount: todaySales.length,
      todayRevenue,
      weekSalesCount: weekSales.length,
      weekRevenue,
      myTodaySalesCount: myTodaySales.length,
      myTodayRevenue,
      myWeekSalesCount: myWeekSales.length,
      myWeekRevenue,
      pendingSupplies,
      pendingTransfers,
    }
  }, [sales, supplies, transfers, user])

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

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
                    'Касовий термінал: аналітика продажів за сьогодні та поточний тиждень, оформлення замовлень і повернень.',
                    'Cashier POS terminal: sales analytics for today and this week, fast order checkout, and refunds.'
                  )
                : tr(
                    'Оперативний центр: контроль продажів за день і тиждень, незавершені поставки та внутрішні переміщення.',
                    'Operations center: track daily and weekly sales, unreceived supplier deliveries, and pending warehouse transfers.'
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

      {/* Attention KPI Metrics Bar */}
      {token && (
        <div
          className={`grid gap-4 mb-8 ${
            isCashier ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {/* Today's Sales */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tr('Продажі сьогодні', 'Sales Today')}
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                ₴{metrics.todayRevenue.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="font-bold text-slate-700">{metrics.todaySalesCount}</span>
                <span>{tr('замовлень', 'orders')}</span>
              </div>
            </div>

            {isCashier && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  {tr('Мої продажі:', 'My sales:')}
                </span>
                <span className="font-bold text-blue-600">
                  {metrics.myTodaySalesCount} {tr('замовл.', 'ord.')} (₴
                  {metrics.myTodayRevenue.toLocaleString('uk-UA', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  )
                </span>
              </div>
            )}
          </div>

          {/* This Week's Sales */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tr('Продажі за тиждень', 'Sales This Week')}
              </span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                ₴{metrics.weekRevenue.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="font-bold text-slate-700">{metrics.weekSalesCount}</span>
                <span>{tr('замовлень', 'orders')}</span>
              </div>
            </div>

            {isCashier && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  {tr('Мої продажі:', 'My sales:')}
                </span>
                <span className="font-bold text-blue-600">
                  {metrics.myWeekSalesCount} {tr('замовл.', 'ord.')} (₴
                  {metrics.myWeekRevenue.toLocaleString('uk-UA', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  )
                </span>
              </div>
            )}
          </div>

          {/* Pending Supplies (Staff Only) */}
          {!isCashier && (
            <Link
              to="/supplies"
              search={{ status: 'pending' }}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {tr('Поставки в обробці', 'Pending Supplies')}
                </span>
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{metrics.pendingSupplies.length}</div>
                <div className="text-xs font-medium text-slate-500 mt-1 flex items-center justify-between">
                  <span>{tr('Очікують оприбуткування', 'Awaiting receipt')}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          )}

          {/* Pending Movements (Staff Only) */}
          {!isCashier && (
            <Link
              to="/movements"
              search={{ status: 'pending' }}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {tr('Переміщення в дорозі', 'Pending Transfers')}
                </span>
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{metrics.pendingTransfers.length}</div>
                <div className="text-xs font-medium text-slate-500 mt-1 flex items-center justify-between">
                  <span>{tr('Очікують підтвердження', 'Awaiting confirmation')}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Staff "Attention Required" Section */}
      {token && !isCashier && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {tr('Потребує уваги', 'Attention Required')}
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {metrics.pendingSupplies.length + metrics.pendingTransfers.length}{' '}
              {tr('активних завдань', 'pending tasks')}
            </span>
          </div>

          {metrics.pendingSupplies.length === 0 && metrics.pendingTransfers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {tr('Все виконано та актуально', 'All Caught Up')}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {tr(
                  'Наразі немає незавершених поставок від постачальників або відкритих переміщень між складами.',
                  'No pending supplier receipts or stock movements requiring attention at this time.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Unfinished Supplies Panel */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {tr('Незавершені поставки', 'Unfinished Supplies')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      {metrics.pendingSupplies.length}
                    </span>
                  </div>
                  <Link
                    to="/supplies"
                    search={{ status: 'pending' }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <span>{tr('Всі поставки', 'All supplies')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 flex-1">
                  {metrics.pendingSupplies.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      {tr('Немає відкритих поставок', 'No open supplies')}
                    </div>
                  ) : (
                    metrics.pendingSupplies.slice(0, 5).map((supply) => (
                      <Link
                        key={supply.id}
                        to="/supplies"
                        search={{ status: 'pending', view_id: supply.id }}
                        className="p-3.5 hover:bg-amber-50/60 transition-colors flex items-center justify-between gap-4 group cursor-pointer"
                        title={tr('Відкрити деталі поставки', 'Open supply details')}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                              {supply.reference_number || `#${supply.id.slice(0, 8)}`}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                              {tr('Очікує', 'Pending')}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 truncate">
                            <span className="font-semibold text-slate-700">{supply.supplier?.name || '—'}</span>
                            <span>&bull;</span>
                            <span>{supply.location?.name || '—'}</span>
                            <span>&bull;</span>
                            <span className="text-[11px] text-slate-400">{formatDateTime(supply.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-900">
                              ₴{supply.total_cost.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {supply.total_units_count} {tr('шт.', 'units')}
                            </div>
                          </div>
                          <Eye className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Unfinished Transfers Panel */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {tr('Переміщення в дорозі', 'Transfers in Transit')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                      {metrics.pendingTransfers.length}
                    </span>
                  </div>
                  <Link
                    to="/movements"
                    search={{ status: 'pending' }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <span>{tr('Всі переміщення', 'All transfers')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 flex-1">
                  {metrics.pendingTransfers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      {tr('Немає відкритих переміщень', 'No open transfers')}
                    </div>
                  ) : (
                    metrics.pendingTransfers.slice(0, 5).map((transfer) => (
                      <Link
                        key={transfer.id}
                        to="/movements"
                        search={{ status: 'pending', view_id: transfer.id }}
                        className="p-3.5 hover:bg-purple-50/60 transition-colors flex items-center justify-between gap-4 group cursor-pointer"
                        title={tr('Відкрити деталі переміщення', 'Open movement details')}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                              {transfer.reference_number || `#${transfer.id.slice(0, 8)}`}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                              {tr('В дорозі', 'In Transit')}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-slate-700">
                              {transfer.source_location?.name || '—'}
                            </span>
                            <span className="text-slate-400">&rarr;</span>
                            <span className="font-semibold text-slate-700">
                              {transfer.destination_location?.name || '—'}
                            </span>
                            <span>&bull;</span>
                            <span className="text-[11px] text-slate-400">{formatDateTime(transfer.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-900">
                              {transfer.total_units_count} {tr('шт.', 'units')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {transfer.total_items_count} {tr('позицій', 'items')}
                            </div>
                          </div>
                          <Eye className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cashier Recent Sales & Quick Access */}
      {token && isCashier && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {tr('Останні оформлені чеки', 'Recent Checkout Receipts')}
              </span>
            </div>
            <Link
              to="/sales"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>{tr('Відкрити касу (POS)', 'Open Sales (POS)')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {sales.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {tr('Продажів ще не було', 'No sales recorded yet')}
              </div>
            ) : (
              sales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">#{sale.id.slice(0, 8)}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          sale.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-red-50 text-red-700 border border-red-200/60'
                        }`}
                      >
                        {sale.status === 'completed' ? tr('Оплачено', 'Paid') : tr('Повернення', 'Refunded')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{sale.payment_method === 'cash' ? tr('Готівка', 'Cash') : tr('Картка', 'Card')}</span>
                      <span>&bull;</span>
                      <span className="text-[11px] text-slate-400">{formatDateTime(sale.created_at)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">
                      ₴{Number(sale.total_price).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
