import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect, type FormEvent } from 'react'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../i18n/i18n'
import { PrintWaybillPortal, type PrintableWaybillData } from '../components/PrintWaybillPortal'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import { exportWriteOffToExcel, getReasonLabel, type ExportableWriteOff } from '../utils/waybillExport'
import {
  FileX2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  X,
  Store,
  Warehouse,
  Camera,
  Package,
} from 'lucide-react'

export const Route = createFileRoute('/write-offs')({
  beforeLoad: () => {
    const { token, user } = useAuthStore.getState()
    if (!token) {
      throw redirect({ to: '/login' })
    }
    if (user?.role === 'cashier') {
      throw redirect({ to: '/products' })
    }
  },
  validateSearch: (
    search: Record<string, unknown>
  ): {
    status?: string
    reason?: string
    location_id?: string
    query?: string
    view_id?: string
  } => ({
    status: (search.status as string) || undefined,
    reason: (search.reason as string) || undefined,
    location_id: (search.location_id as string) || undefined,
    query: (search.query as string) || undefined,
    view_id: (search.view_id as string) || undefined,
  }),
  component: WriteOffsPage,
})

export interface LocationItem {
  id: string
  name: string
  address?: string | null
  location_type: 'store' | 'warehouse'
}

export interface CatalogProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  price: number
  category_id: string | null
  category_name?: string | null
  total_stock: number
  stocks: { id: string; location_id: string; quantity: number }[]
}

export interface WriteOffItemRecord {
  id: string
  product_id: string
  quantity: number
  retail_price: number
  cost_price: number
  line_retail_total: number
  line_cost_total: number
  location_stock_current: number
  product?: {
    id: string
    name: string
    sku: string
    barcode?: string | null
    current_price: number
    category_id?: string | null
    category_name?: string | null
  } | null
}

export interface WriteOffRecord {
  id: string
  reference_number: string
  reason: 'defect' | 'personal_use' | 'loss' | 'marketing' | 'other'
  status: 'pending' | 'completed' | 'cancelled'
  notes?: string | null
  location_id: string
  location?: LocationItem | null
  user_id: string
  user?: {
    id: string
    email: string
    role: string
  } | null
  total_items_count: number
  total_units_count: number
  total_retail_loss: number
  total_cost_loss: number
  completed_at?: string | null
  created_at: string
  updated_at: string
  write_off_items: WriteOffItemRecord[]
}

function WriteOffsPage() {
  const { tr, locale } = useI18n()
  const navigate = useNavigate({ from: '/write-offs' })
  const searchParams = Route.useSearch()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

  const [searchQuery, setSearchQuery] = useState(searchParams.query || '')
  const [filterLocationId, setFilterLocationId] = useState(searchParams.location_id || '')
  const [filterReason, setFilterReason] = useState(searchParams.reason || '')
  const [filterStatus, setFilterStatus] = useState(searchParams.status || '')

  const [selectedWriteOff, setSelectedWriteOff] = useState<WriteOffRecord | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [printData, setPrintData] = useState<PrintableWaybillData | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Fetch write-off records
  const { data: allWriteOffs = [], isLoading } = useQuery<WriteOffRecord[]>({
    queryKey: ['write-offs', searchQuery, filterLocationId, filterReason],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (searchQuery.trim()) params.query = searchQuery.trim()
      if (filterLocationId) params.location_id = filterLocationId
      if (filterReason) params.reason = filterReason
      const res = await api.get('/api/v1/write_offs', { params })
      return res.data
    },
  })

  const writeOffs = useMemo(() => {
    if (!filterStatus) return allWriteOffs
    return allWriteOffs.filter((w) => w.status === filterStatus)
  }, [allWriteOffs, filterStatus])

  // Fetch locations
  const { data: locations = [] } = useQuery<LocationItem[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
  })

  // Deep-linking via view_id query param
  const viewId = searchParams.view_id
  useEffect(() => {
    if (!viewId) return
    const found = writeOffs.find((w) => w.id === viewId)
    if (found) {
      setSelectedWriteOff(found)
    } else {
      api
        .get(`/api/v1/write_offs/${viewId}`)
        .then((res) => {
          if (res.data) setSelectedWriteOff(res.data)
        })
        .catch(() => {})
    }
  }, [viewId, writeOffs])

  const handleCloseDetailModal = () => {
    setSelectedWriteOff(null)
    if (viewId) {
      navigate({ search: (prev: any) => ({ ...prev, view_id: undefined }) })
    }
  }

  // Cancel / Void mutation (Admin only)
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/api/v1/write_offs/${id}/status`, { status: 'cancelled' })
      return res.data as WriteOffRecord
    },
    onSuccess: (updated) => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['write-offs'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (selectedWriteOff?.id === updated.id) {
        setSelectedWriteOff(updated)
      }
    },
    onError: (err: unknown) => {
      let msg = tr('Не вдалося скасувати акт списання', 'Failed to cancel write-off act')
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setActionError(msg)
    },
  })

  const handlePrintAct = (act: WriteOffRecord) => {
    const isUk = locale !== 'en'
    const items = act.write_off_items.map((i) => ({
      id: i.id,
      name: i.product?.name || tr('Товар', 'Product'),
      category: i.product?.category_name,
      sku: i.product?.sku || '—',
      barcode: i.product?.barcode,
      quantity: i.quantity,
      unitPrice: i.cost_price > 0 ? i.cost_price : i.retail_price,
      lineTotal: i.line_cost_total > 0 ? i.line_cost_total : i.line_retail_total,
    }))

    const printable: PrintableWaybillData = {
      docType: 'write_off',
      referenceNumber: act.reference_number,
      date: new Date(act.created_at).toLocaleDateString('uk-UA'),
      status: act.status,
      statusLabel: act.status === 'completed' ? tr('Завершено', 'Completed') : tr('Скасовано', 'Cancelled'),
      partyFromLabel: tr('Локація / Склад:', 'Location / Warehouse:'),
      partyFromName: act.location?.name || '—',
      partyFromExtra: act.location?.address,
      partyToLabel: tr('Причина списання:', 'Write-Off Reason:'),
      partyToName: getReasonLabel(act.reason, isUk),
      partyToExtra: act.user ? `${tr('Створив:', 'By:')} ${act.user.email}` : undefined,
      notes: act.notes,
      completedAt: act.completed_at ? new Date(act.completed_at).toLocaleString('uk-UA') : null,
      completedAtLabel: tr('Дата списання:', 'Completed:'),
      items,
      totalUnits: act.total_units_count,
      totalAmount: act.total_cost_loss > 0 ? act.total_cost_loss : act.total_retail_loss,
    }

    setPrintData(printable)
    setTimeout(() => {
      window.print()
    }, 100)
  }

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const activeActs = allWriteOffs.filter((w) => w.status === 'completed')
    const totalActs = allWriteOffs.length
    const totalUnits = activeActs.reduce((sum, w) => sum + w.total_units_count, 0)
    const totalCostLoss = activeActs.reduce((sum, w) => sum + w.total_cost_loss, 0)
    const totalRetailLoss = activeActs.reduce((sum, w) => sum + w.total_retail_loss, 0)
    return { totalActs, totalUnits, totalCostLoss, totalRetailLoss }
  }, [allWriteOffs])

  const getReasonBadgeClass = (reason: string) => {
    switch (reason) {
      case 'defect':
        return 'bg-rose-100 text-rose-800 border-rose-200'
      case 'personal_use':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'loss':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'marketing':
        return 'bg-sky-100 text-sky-800 border-sky-200'
      case 'other':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <FileX2 className="w-6 h-6" />
            </div>
            {tr('Списання товарів', 'Inventory Write-Offs')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {tr(
              'Фіксуйте брак, власні потреби, втрати та маркетингові зразки з автоматичним списанням зі складу',
              'Record defects, personal use, losses, and marketing samples with automatic stock deduction'
            )}
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {tr('Новий акт списання', 'New Write-Off Act')}
        </button>
      </div>

      {actionError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {tr('Усього актів', 'Total Acts')}
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{summaryMetrics.totalActs}</div>
          <div className="text-xs text-slate-400 mt-1">{tr('Зареєстровано в системі', 'Recorded in system')}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {tr('Списано одиниць', 'Units Written Off')}
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {summaryMetrics.totalUnits} <span className="text-sm font-semibold text-slate-500">{tr('шт.', 'pcs')}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">{tr('Активні списання', 'Active write-offs')}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {tr('Собівартість втрат', 'Cost Loss')}
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ₴
            {summaryMetrics.totalCostLoss.toLocaleString('uk-UA', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-400 mt-1">{tr('Закупівельна ціна', 'Purchase cost value')}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {tr('Роздрібна вартість', 'Retail Loss')}
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ₴
            {summaryMetrics.totalRetailLoss.toLocaleString('uk-UA', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-400 mt-1">{tr('Втрачений виторг', 'Lost sales potential')}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search query */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('Пошук за номером, товаром, SKU...', 'Search number, product, SKU...')}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
            />
          </div>

          {/* Location filter */}
          <div>
            <select
              value={filterLocationId}
              onChange={(e) => setFilterLocationId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
            >
              <option value="">{tr('Всі локації', 'All Locations')}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reason filter */}
          <div>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
            >
              <option value="">{tr('Всі причини', 'All Reasons')}</option>
              <option value="defect">{tr('Брак / Пошкодження', 'Defect / Damaged')}</option>
              <option value="personal_use">{tr('Власні потреби', 'Personal Use')}</option>
              <option value="loss">{tr('Втрата / Нестача', 'Loss / Shortage')}</option>
              <option value="marketing">{tr('Маркетинг / Зразки', 'Marketing / Samples')}</option>
              <option value="other">{tr('Інше', 'Other')}</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
            >
              <option value="">{tr('Всі статуси', 'All Statuses')}</option>
              <option value="completed">{tr('Завершено (Списано)', 'Completed')}</option>
              <option value="cancelled">{tr('Скасовано', 'Cancelled')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Acts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            {tr('Завантаження актів списання...', 'Loading write-off acts...')}
          </div>
        ) : writeOffs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileX2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {tr('Актів списання не знайдено', 'No write-off acts found')}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {tr('Створіть перший акт або змініть фільтри пошуку.', 'Create a new act or adjust your filter criteria.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">{tr('Акт / Дата', 'Act / Date')}</th>
                  <th className="px-4 py-3.5">{tr('Локація', 'Location')}</th>
                  <th className="px-4 py-3.5">{tr('Причина', 'Reason')}</th>
                  <th className="px-4 py-3.5">{tr('Товари', 'Products')}</th>
                  <th className="px-4 py-3.5 text-right">{tr('К-сть', 'Qty')}</th>
                  <th className="px-4 py-3.5 text-right">{tr('Собівартість', 'Cost')}</th>
                  <th className="px-4 py-3.5 text-center">{tr('Статус', 'Status')}</th>
                  <th className="px-4 py-3.5 text-right">{tr('Дії', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {writeOffs.map((wo) => {
                  const isCompleted = wo.status === 'completed'
                  const isCancelled = wo.status === 'cancelled'

                  return (
                    <tr
                      key={wo.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isCancelled ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono">{wo.reference_number}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(wo.created_at).toLocaleString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {wo.location?.location_type === 'warehouse' ? (
                            <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{wo.location?.name || '—'}</span>
                        </div>
                        {wo.user && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">
                            {wo.user.email}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getReasonBadgeClass(
                            wo.reason
                          )}`}
                        >
                          {getReasonLabel(wo.reason, locale !== 'en')}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 max-w-xs truncate">
                        <div className="text-slate-900 font-medium truncate">
                          {wo.write_off_items.map((i) => `${i.product?.name || 'Товар'} (x${i.quantity})`).join(', ')}
                        </div>
                        {wo.notes && (
                          <div className="text-[11px] text-slate-400 italic mt-0.5 truncate max-w-xs">
                            "{wo.notes}"
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right font-black text-slate-900 text-sm">
                        {wo.total_units_count} <span className="text-[11px] font-medium text-slate-400">{tr('шт.', 'pcs')}</span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                        <div>
                          ₴
                          {wo.total_cost_loss.toLocaleString('uk-UA', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          (Роздріб: ₴{wo.total_retail_loss.toFixed(2)})
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            {tr('Завершено', 'Completed')}
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            <XCircle className="w-3 h-3" />
                            {tr('Скасовано', 'Cancelled')}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setSelectedWriteOff(wo)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title={tr('Деталі акта', 'View Act Details')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintAct(wo)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title={tr('Друкувати акт списання (A4)', 'Print Act (A4)')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportWriteOffToExcel(wo as ExportableWriteOff, locale)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title={tr('Експорт в Excel (.xlsx)', 'Export to Excel')}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          {isAdmin && isCompleted && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    tr(
                                      `Скасувати акт списання № ${wo.reference_number}? Списані товари повернуться на склад.`,
                                      `Cancel write-off act #${wo.reference_number}? Deducted items will be returned to stock.`
                                    )
                                  )
                                ) {
                                  cancelMutation.mutate(wo.id)
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={tr('Скасувати списання та повернути товар на склад', 'Cancel write-off and restore stock')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedWriteOff && (
        <WriteOffDetailModal
          writeOff={selectedWriteOff}
          onClose={handleCloseDetailModal}
          onPrint={() => handlePrintAct(selectedWriteOff)}
          onExportExcel={() => exportWriteOffToExcel(selectedWriteOff as ExportableWriteOff, locale)}
          onCancelAct={() => {
            if (
              confirm(
                tr(
                  `Скасувати акт списання № ${selectedWriteOff.reference_number}? Товари повернуться на залишок.`,
                  `Cancel write-off act #${selectedWriteOff.reference_number}? Items will be restored to stock.`
                )
              )
            ) {
              cancelMutation.mutate(selectedWriteOff.id)
            }
          }}
          isAdmin={isAdmin}
          isCancelling={cancelMutation.isPending}
        />
      )}

      {/* Create Act Modal (Multi-item) */}
      {isCreateModalOpen && (
        <CreateWriteOffActModal
          locations={locations}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['write-offs'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}

      {/* Hidden Print Portal */}
      {printData && <PrintWaybillPortal data={printData} />}
    </div>
  )
}

function WriteOffDetailModal({
  writeOff,
  onClose,
  onPrint,
  onExportExcel,
  onCancelAct,
  isAdmin,
  isCancelling,
}: {
  writeOff: WriteOffRecord
  onClose: () => void
  onPrint: () => void
  onExportExcel: () => void
  onCancelAct: () => void
  isAdmin: boolean
  isCancelling: boolean
}) {
  const { tr, locale } = useI18n()
  const isCompleted = writeOff.status === 'completed'

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-slate-900">
                {tr('Акт списання', 'Write-Off Act')} № {writeOff.reference_number}
              </h3>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isCompleted ? tr('Завершено', 'Completed') : tr('Скасовано', 'Cancelled')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(writeOff.created_at).toLocaleString('uk-UA')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              title={tr('Друкувати A4', 'Print A4')}
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onExportExcel}
              className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
              title={tr('Експорт в Excel', 'Export Excel')}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata info cards */}
        <div className="grid grid-cols-2 gap-3 py-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              {tr('Локація списання', 'Location')}
            </div>
            <div className="font-semibold text-slate-800">{writeOff.location?.name || '—'}</div>
            {writeOff.user && (
              <div className="text-[11px] text-slate-500">
                {tr('Відповідальний:', 'Responsible:')} {writeOff.user.email}
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              {tr('Причина списання', 'Reason')}
            </div>
            <div className="font-semibold text-slate-800">
              {getReasonLabel(writeOff.reason, locale !== 'en')}
            </div>
            {writeOff.notes && (
              <div className="text-[11px] text-slate-500 italic">"{writeOff.notes}"</div>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto min-h-0 border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 sticky top-0 border-b border-slate-100">
              <tr>
                <th className="px-3 py-2.5">№</th>
                <th className="px-3 py-2.5">{tr('Товар', 'Product')}</th>
                <th className="px-3 py-2.5">{tr('Артикул / SKU', 'SKU')}</th>
                <th className="px-3 py-2.5 text-right">{tr('К-сть', 'Qty')}</th>
                <th className="px-3 py-2.5 text-right">{tr('Собівартість', 'Cost')}</th>
                <th className="px-3 py-2.5 text-right">{tr('Сума збитку', 'Line Loss')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {writeOff.write_off_items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-slate-400 font-mono">{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-800">{item.product?.name || '—'}</div>
                    {item.product?.category_name && (
                      <div className="text-[10px] text-slate-400">{item.product.category_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">
                    {item.product?.sku || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                    {item.quantity} {tr('шт.', 'pcs')}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-700">
                    ₴{(item.cost_price > 0 ? item.cost_price : item.retail_price).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                    ₴{(item.line_cost_total > 0 ? item.line_cost_total : item.line_retail_total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
              <tr>
                <td colSpan={3} className="px-3 py-2.5 text-right uppercase tracking-wider text-slate-500">
                  {tr('Разом:', 'Total:')}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-900">
                  {writeOff.total_units_count} {tr('шт.', 'pcs')}
                </td>
                <td></td>
                <td className="px-3 py-2.5 text-right text-rose-600 text-sm">
                  ₴{(writeOff.total_cost_loss > 0 ? writeOff.total_cost_loss : writeOff.total_retail_loss).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-100 mt-4">
          <div>
            {isAdmin && isCompleted && (
              <button
                type="button"
                onClick={onCancelAct}
                disabled={isCancelling}
                className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {isCancelling ? tr('Скасування...', 'Cancelling...') : tr('Скасувати цей акт', 'Cancel This Act')}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {tr('Закрити', 'Close')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface WriteOffActItemDraft {
  product: CatalogProduct
  quantity: number
}

function CreateWriteOffActModal({
  locations,
  onClose,
  onSuccess,
}: {
  locations: LocationItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { tr } = useI18n()
  const [locationId, setLocationId] = useState(locations[0]?.id || '')
  const [reason, setReason] = useState<'defect' | 'personal_use' | 'loss' | 'marketing' | 'other'>('defect')
  const [notes, setNotes] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [items, setItems] = useState<WriteOffActItemDraft[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannerFeedback, setScannerFeedback] = useState<{ text: string; type: 'success' | 'warn' } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Fetch catalog products
  const { data: catalog = [] } = useQuery<CatalogProduct[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/api/v1/products')
      return res.data
    },
  })

  const getProductStock = (productId: string, locId: string) => {
    const prod = catalog.find((p) => p.id === productId)
    if (!prod) return 0
    const stock = prod.stocks.find((s) => s.location_id === locId)
    return stock ? stock.quantity : 0
  }

  // Filter products for autocomplete dropdown
  const matchingProducts = useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase().trim()
    return catalog
      .filter((p) => {
        const matchTitle = p.name.toLowerCase().includes(q)
        const matchSku = p.sku.toLowerCase().includes(q)
        const matchBarcode = p.barcode?.toLowerCase().includes(q)
        return matchTitle || matchSku || matchBarcode
      })
      .slice(0, 8)
  }, [catalog, productSearch])

  // Add product to act
  const addProductToAct = (product: CatalogProduct) => {
    setErrorMsg(null)
    const avail = getProductStock(product.id, locationId)
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: avail > 0 ? Math.min(avail, i.quantity + 1) : i.quantity + 1 }
            : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setProductSearch('')
  }

  // Barcode scan handler
  const handleBarcodeScan = (barcode: string) => {
    const cleanCode = barcode.trim()
    const matched = catalog.find(
      (p) => p.barcode?.trim() === cleanCode || p.sku.toLowerCase() === cleanCode.toLowerCase()
    )

    if (matched) {
      addProductToAct(matched)
      setScannerFeedback({
        text: tr(
          `Додано "${matched.name}" (Залишок: ${getProductStock(matched.id, locationId)})`,
          `Added "${matched.name}" (Stock: ${getProductStock(matched.id, locationId)})`
        ),
        type: 'success',
      })
    } else {
      setScannerFeedback({
        text: tr(`Штрих-код "${cleanCode}" не знайдено`, `Barcode "${cleanCode}" not found`),
        type: 'warn',
      })
    }
    setTimeout(() => setScannerFeedback(null), 3000)
  }

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeProductFromAct(productId)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    )
  }

  const removeProductFromAct = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const totalUnits = useMemo(() => {
    return items.reduce((sum, i) => sum + i.quantity, 0)
  }, [items])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!locationId) {
      setErrorMsg(tr('Оберіть локацію для списання', 'Select a write-off location'))
      return
    }

    if (items.length === 0) {
      setErrorMsg(tr('Додайте хоча б один товар для списання', 'Add at least one product to write off'))
      return
    }

    // Check stock availability
    for (const item of items) {
      const available = getProductStock(item.product.id, locationId)
      if (item.quantity > available) {
        setErrorMsg(
          tr(
            `Кількість (${item.quantity}) для "${item.product.name}" перевищує залишок (${available} шт.)`,
            `Quantity (${item.quantity}) for "${item.product.name}" exceeds available stock (${available} pcs)`
          )
        )
        return
      }
    }

    setIsPending(true)
    setErrorMsg(null)

    try {
      await api.post('/api/v1/write_offs', {
        location_id: locationId,
        reason,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      })
      onSuccess()
    } catch (err: unknown) {
      let msg = tr('Не вдалося створити акт списання', 'Failed to create write-off act')
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setErrorMsg(msg)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <FileX2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {tr('Створити акт списання товарів', 'Create Write-Off Act')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {tr('Зручний пошук товарів за назвою, артикулом або скануванням штрих-коду', 'Fast product search by name, SKU, or camera barcode scan')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {scannerFeedback && (
          <div
            className={`my-2 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
              scannerFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{scannerFeedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 pt-3">
          {/* Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {tr('Локація (Склад / Магазин) *', 'Location (Warehouse / Store) *')}
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.location_type === 'warehouse' ? tr('Склад', 'Warehouse') : tr('Магазин', 'Store')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {tr('Причина списання *', 'Reason *')}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
              >
                <option value="defect">{tr('Брак / Пошкодження', 'Defect / Damaged')}</option>
                <option value="personal_use">{tr('Власні потреби', 'Personal Use')}</option>
                <option value="loss">{tr('Втрата / Нестача', 'Loss / Shortage')}</option>
                <option value="marketing">{tr('Маркетинг / Зразки', 'Marketing / Samples')}</option>
                <option value="other">{tr('Інше', 'Other')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {tr('Номер акта (необов’язково)', 'Act Number (optional)')}
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={tr('Автоматично генерується, якщо пусто', 'Auto-generated if empty')}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {tr('Примітка (необов’язково)', 'Note (optional)')}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr('Деталі списання', 'Write-off details')}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Product Search & Barcode Scan Row (Similar to New Sale Modal) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              {tr('Пошук товару або сканування штрих-коду', 'Search Product or Scan Barcode')}
            </label>
            <div className="flex items-center gap-2 relative">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={tr('Введіть назву, артикул (SKU) або штрих-код...', 'Type name, SKU, or enter barcode...')}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                title={tr('Сканувати штрих-код камерою', 'Scan barcode with camera')}
              >
                <Camera className="w-4 h-4" />
                <span>{tr('Сканер', 'Scanner')}</span>
              </button>

              {/* Autocomplete Dropdown popup */}
              {matchingProducts.length > 0 && (
                <div className="absolute top-full left-0 right-16 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 z-50">
                  {matchingProducts.map((p) => {
                    const avail = getProductStock(p.id, locationId)
                    return (
                      <div
                        key={p.id}
                        onClick={() => addProductToAct(p)}
                        className="p-3 hover:bg-rose-50/60 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="truncate">
                          <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            SKU: <span className="font-mono text-slate-600">{p.sku}</span>
                            {p.barcode ? ` • ${tr('Штрих-код', 'Barcode')}: ${p.barcode}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              avail > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {tr('Залишок:', 'Stock:')} {avail} {tr('шт.', 'pcs')}
                          </span>
                          <button
                            type="button"
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                          >
                            + {tr('Додати', 'Add')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Selected Products Table / List */}
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {tr('Товари у списку списання', 'Items to Write Off')} ({items.length})
              </label>
              {items.length > 0 && (
                <span className="text-xs font-semibold text-slate-500">
                  {tr('Усього одиниць:', 'Total Units:')} <span className="font-black text-slate-900">{totalUnits}</span> {tr('шт.', 'pcs')}
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/40 text-center">
                <Package className="w-8 h-8 text-slate-300 mb-2" />
                <div className="text-xs font-semibold text-slate-600">
                  {tr('Товари ще не додано', 'No items added yet')}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">
                  {tr(
                    'Скористайтеся швидким пошуком або кнопкою сканера вище, щоб додати товари до цього акта.',
                    'Use the search bar or scanner button above to add products to this write-off act.'
                  )}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-[140px] max-h-[220px] border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[10px] font-bold uppercase text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">№</th>
                      <th className="px-3 py-2">{tr('Товар / Артикул', 'Product / SKU')}</th>
                      <th className="px-3 py-2 text-center">{tr('Доступно', 'Available')}</th>
                      <th className="px-3 py-2 text-center w-32">{tr('К-сть для списання', 'Write-Off Qty')}</th>
                      <th className="px-3 py-2 text-right">{tr('Дія', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const avail = getProductStock(item.product.id, locationId)
                      const isOverStock = item.quantity > avail

                      return (
                        <tr key={item.product.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900">{item.product.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.product.sku}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`text-[11px] font-bold ${
                                avail > 0 ? 'text-slate-700' : 'text-red-600'
                              }`}
                            >
                              {avail} {tr('шт.', 'pcs')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={Math.max(1, avail)}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateQuantity(item.product.id, Math.max(1, parseInt(e.target.value, 10) || 1))
                                }
                                className={`w-14 text-center py-1 rounded-lg border text-xs font-bold focus:outline-none ${
                                  isOverStock
                                    ? 'border-red-400 bg-red-50 text-red-700'
                                    : 'border-slate-200 bg-white text-slate-900'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.product.id,
                                    avail > 0 ? Math.min(avail, item.quantity + 1) : item.quantity + 1
                                  )
                                }
                                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            {isOverStock && (
                              <div className="text-[10px] text-red-600 mt-0.5">
                                {tr('Перевищує залишок!', 'Exceeds stock!')}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => removeProductFromAct(item.product.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title={tr('Видалити', 'Remove')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {tr('Скасувати', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending || items.length === 0}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileX2 className="w-4 h-4" />
              {isPending ? tr('Створення...', 'Creating...') : tr('Створити акт списання', 'Create Write-Off Act')}
            </button>
          </div>
        </form>

        {/* Camera Barcode Scanner Modal */}
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={(scanned) => {
            handleBarcodeScan(scanned)
            setIsScannerOpen(false)
          }}
          title={tr('Сканувати штрих-код товару для списання', 'Scan Barcode to Add Product')}
        />
      </div>
    </div>
  )
}
