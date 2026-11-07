import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../i18n/i18n'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Pencil,
  Trash2,
  Package,
  Store,
  Warehouse,
  ScanBarcode,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  X,
} from 'lucide-react'

export const Route = createFileRoute('/movements')({
  beforeLoad: () => {
    const { token, user } = useAuthStore.getState()
    if (!token) {
      throw redirect({ to: '/login' })
    }
    if (user?.role === 'cashier') {
      throw redirect({ to: '/products' })
    }
  },
  component: MovementsPage,
})

export interface LocationItem {
  id: string
  name: string
  address?: string | null
  location_type: 'store' | 'warehouse'
}

export interface ProductStockItem {
  id: string
  location_id: string
  location_name?: string
  quantity: number
}

export interface CatalogProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  price: number
  category_id: string | null
  category?: { id: string; name: string } | null
  total_stock: number
  stocks: ProductStockItem[]
}

export interface TransferItemRecord {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  line_retail_total: number
  source_stock_available: number
  destination_stock_current: number
  product: {
    id: string
    name: string
    sku: string
    barcode: string | null
    current_price: number
    category_id: string | null
    category_name: string | null
  } | null
}

export interface TransferRecord {
  id: string
  reference_number: string | null
  notes: string | null
  status: 'pending' | 'completed' | 'cancelled'
  source_location_id: string
  source_location: {
    id: string
    name: string
    location_type: 'store' | 'warehouse'
  } | null
  destination_location_id: string
  destination_location: {
    id: string
    name: string
    location_type: 'store' | 'warehouse'
  } | null
  total_items_count: number
  total_units_count: number
  total_retail_value: number
  completed_at: string | null
  created_at: string
  updated_at: string
  transfer_items: TransferItemRecord[]
}

interface DraftMovementItem {
  key: string
  product_id: string
  name: string
  sku: string
  barcode: string
  category_name: string
  unit_price: number
  quantity: string
}

function StatusBadge({ status }: { status: TransferRecord['status'] }) {
  const { tr } = useI18n()
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {tr('Завершено', 'Completed')}
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3.5 h-3.5" />
        {tr('Скасовано', 'Cancelled')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3.5 h-3.5" />
      {tr('Очікує', 'Pending')}
    </span>
  )
}

function MovementsPage() {
  const { tr } = useI18n()
  const queryClient = useQueryClient()

  // View mode: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingTransfer, setEditingTransfer] = useState<TransferRecord | null>(null)
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null)

  // List filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSourceId, setFilterSourceId] = useState('')
  const [filterDestinationId, setFilterDestinationId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)

  const { data: transfers = [], isLoading } = useQuery<TransferRecord[]>({
    queryKey: ['transfers', searchQuery, filterSourceId, filterDestinationId, filterStatus],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (searchQuery.trim()) params.query = searchQuery.trim()
      if (filterSourceId) params.source_location_id = filterSourceId
      if (filterDestinationId) params.destination_location_id = filterDestinationId
      if (filterStatus) params.status = filterStatus
      const res = await api.get('/api/v1/transfers', { params })
      return res.data
    },
  })

  const { data: locations = [] } = useQuery<LocationItem[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TransferRecord['status'] }) => {
      const res = await api.patch(`/api/v1/transfers/${id}/status`, { status })
      return res.data as TransferRecord
    },
    onSuccess: (updated) => {
      setStatusError(null)
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (selectedTransfer?.id === updated.id) {
        setSelectedTransfer(updated)
      }
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.errors || tr('Не вдалося оновити статус переміщення', 'Failed to update movement status')
      setStatusError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    },
  })

  const stats = useMemo(() => {
    const totalCount = transfers.length
    const completedCount = transfers.filter((t) => t.status === 'completed').length
    const pendingCount = transfers.filter((t) => t.status === 'pending').length
    const totalUnitsMoved = transfers
      .filter((t) => t.status === 'completed')
      .reduce((acc, t) => acc + t.total_units_count, 0)
    return { totalCount, completedCount, pendingCount, totalUnitsMoved }
  }, [transfers])

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MovementWorkspace
          locations={locations}
          initialTransfer={viewMode === 'edit' ? editingTransfer : null}
          onCancel={() => {
            setViewMode('list')
            setEditingTransfer(null)
          }}
          onSaved={() => {
            setViewMode('list')
            setEditingTransfer(null)
            queryClient.invalidateQueries({ queryKey: ['transfers'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
          }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-blue-600" />
            {tr('Переміщення товарів', 'Product Movements')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {tr(
              'Переміщуйте запаси між магазинами та складами з перевіркою залишків у реальному часі',
              'Move inventory between stores and warehouses with real-time stock verification'
            )}
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTransfer(null)
            setViewMode('create')
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {tr('Нове переміщення', 'New Movement')}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-medium text-slate-500">{tr('Усього переміщень', 'Total Movements')}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.totalCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-medium text-slate-500">
            {tr('Завершені переміщення', 'Completed Transfers')}
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.completedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-medium text-slate-500">
            {tr('Очікують виконання', 'Pending Transfers')}
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-medium text-slate-500">
            {tr('Переміщено одиниць', 'Total Units Moved')}
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {stats.totalUnitsMoved} {tr('шт.', 'pcs')}
          </div>
        </div>
      </div>

      {statusError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-red-700 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{statusError}</span>
          </div>
          <button onClick={() => setStatusError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr(
              'Пошук за номером, назвою локації або примітками...',
              'Search by reference #, location name, or notes...'
            )}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterSourceId}
          onChange={(e) => setFilterSourceId(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{tr('Звідки: Усі локації', 'From: All Locations')}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {tr('Звідки', 'From')}: {loc.name}
            </option>
          ))}
        </select>

        <select
          value={filterDestinationId}
          onChange={(e) => setFilterDestinationId(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{tr('Куди: Усі локації', 'To: All Locations')}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {tr('Куди', 'To')}: {loc.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{tr('Усі статуси', 'All Statuses')}</option>
          <option value="pending">{tr('Очікує', 'Pending')}</option>
          <option value="completed">{tr('Завершено', 'Completed')}</option>
          <option value="cancelled">{tr('Скасовано', 'Cancelled')}</option>
        </select>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {tr('Завантаження переміщень товарів...', 'Loading product movements...')}
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div className="text-base font-semibold text-slate-800">
              {tr('Переміщень товарів не знайдено', 'No product movements found')}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {tr(
                'Створіть переміщення для передачі товарів між магазинами та складами.',
                'Create a movement to transfer stock between your stores and warehouses.'
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">{tr('Номер / Дата', 'Reference / Date')}</th>
                  <th className="py-3.5 px-4">{tr('Звідки → Куди', 'Source → Destination')}</th>
                  <th className="py-3.5 px-4">{tr('Позиції / Одиниці', 'Items / Units')}</th>
                  <th className="py-3.5 px-4">{tr('Роздрібна сума', 'Retail Value')}</th>
                  <th className="py-3.5 px-4">{tr('Статус', 'Status')}</th>
                  <th className="py-3.5 px-4 text-right">{tr('Дії', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-sm">
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {transfer.reference_number || `MOV-${transfer.id.slice(0, 6).toUpperCase()}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(transfer.created_at).toLocaleDateString('nl-NL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </div>
                      {transfer.notes && (
                        <div className="text-xs text-slate-400 line-clamp-1 max-w-xs mt-0.5">
                          {transfer.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium">
                          {transfer.source_location?.location_type === 'warehouse' ? (
                            <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{transfer.source_location?.name || '—'}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 text-xs font-medium border border-blue-100">
                          {transfer.destination_location?.location_type === 'warehouse' ? (
                            <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{transfer.destination_location?.name || '—'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {transfer.total_items_count} {tr('товарів', 'products')}
                      </div>
                      <div className="text-xs text-slate-500">
                        {transfer.total_units_count} {tr('шт.', 'units')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        ₴{transfer.total_retail_value.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <StatusBadge status={transfer.status} />
                        <select
                          aria-label={tr(
                            `Змінити статус для ${transfer.reference_number || transfer.id}`,
                            `Change status for ${transfer.reference_number || transfer.id}`
                          )}
                          value={transfer.status}
                          disabled={statusMutation.isPending}
                          onChange={(e) =>
                            statusMutation.mutate({
                              id: transfer.id,
                              status: e.target.value as TransferRecord['status'],
                            })
                          }
                          className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-2 py-1 font-medium border border-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="pending">{tr('Статус: Очікує', 'Set Pending')}</option>
                          <option value="completed">
                            {tr('Статус: Завершено (Перемістити)', 'Set Completed (Move Stock)')}
                          </option>
                          <option value="cancelled">{tr('Статус: Скасовано', 'Set Cancelled')}</option>
                        </select>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setSelectedTransfer(transfer)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                          title={tr('Переглянути деталі переміщення', 'View Movement Details')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {transfer.status === 'pending' && (
                          <button
                            onClick={() => {
                              setEditingTransfer(transfer)
                              setViewMode('edit')
                            }}
                            className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                            title={tr('Редагувати переміщення', 'Edit Pending Movement')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedTransfer && (
        <MovementDetailsModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
          onStatusChange={(newStatus) =>
            statusMutation.mutate({ id: selectedTransfer.id, status: newStatus })
          }
          isUpdatingStatus={statusMutation.isPending}
        />
      )}
    </div>
  )
}

function MovementDetailsModal({
  transfer,
  onClose,
  onStatusChange,
  isUpdatingStatus,
}: {
  transfer: TransferRecord
  onClose: () => void
  onStatusChange: (status: TransferRecord['status']) => void
  isUpdatingStatus: boolean
}) {
  const { tr } = useI18n()
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                {transfer.reference_number || `${tr('Переміщення', 'Movement')} #${transfer.id.slice(0, 8)}`}
              </h2>
              <StatusBadge status={transfer.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr('Створено', 'Created')}{' '}
              {new Date(transfer.created_at).toLocaleString('nl-NL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {transfer.completed_at &&
                ` • ${tr('Завершено', 'Completed')} ${new Date(transfer.completed_at).toLocaleString('nl-NL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">
                {tr('З локації-джерела', 'From Source Location')}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {transfer.source_location?.name}
              </div>
              <div className="text-xs text-slate-500">
                {transfer.source_location?.location_type === 'warehouse'
                  ? tr('Склад', 'Warehouse')
                  : tr('Магазин', 'Store')}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">
                {tr('До локації призначення', 'To Destination Location')}
              </div>
              <div className="text-sm font-semibold text-blue-900 mt-0.5">
                {transfer.destination_location?.name}
              </div>
              <div className="text-xs text-slate-500">
                {transfer.destination_location?.location_type === 'warehouse'
                  ? tr('Склад', 'Warehouse')
                  : tr('Магазин', 'Store')}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">
                {tr('Швидка зміна статусу', 'Quick Status Update')}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={transfer.status}
                  disabled={isUpdatingStatus}
                  onChange={(e) => onStatusChange(e.target.value as TransferRecord['status'])}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="pending">
                    {tr('Очікує (Залишки не переміщено)', 'Pending (Stock Not Moved)')}
                  </option>
                  <option value="completed">
                    {tr('Завершено (Залишки переміщено)', 'Completed (Stock Moved)')}
                  </option>
                  <option value="cancelled">{tr('Скасовано', 'Cancelled')}</option>
                </select>
              </div>
            </div>
          </div>

          {transfer.notes && (
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">{tr('Примітки: ', 'Notes: ')}</span>
              {transfer.notes}
            </div>
          )}

          {/* Items Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {tr('Переміщені товари', 'Moved Products')} ({transfer.transfer_items.length})
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="py-2.5 px-3">{tr('Товар', 'Product')}</th>
                    <th className="py-2.5 px-3">{tr('SKU / Штрихкод', 'SKU / Barcode')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('К-сть', 'Qty Moved')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Роздрібна ціна', 'Retail Price')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Сума рядка', 'Line Value')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {transfer.transfer_items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {item.product?.name || tr('Невідомий товар', 'Unknown Product')}
                        {item.product?.category_name && (
                          <div className="text-[11px] text-slate-400 font-normal">
                            {item.product.category_name}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 font-mono">
                        <div>{item.product?.sku}</div>
                        {item.product?.barcode && (
                          <div className="text-[11px] text-slate-400">{item.product.barcode}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {item.quantity} {tr('шт.', 'pcs')}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        ₴{item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        ₴{item.line_retail_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {tr('Усього одиниць:', 'Total Units:')}{' '}
            <span className="font-bold text-slate-800">
              {transfer.total_units_count} {tr('шт.', 'pcs')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              {tr('Загальна роздрібна сума:', 'Total Retail Value:')}{' '}
              <span className="font-bold text-slate-900">₴{transfer.total_retail_value.toFixed(2)}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {tr('Закрити', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MovementWorkspace({
  locations,
  initialTransfer,
  onCancel,
  onSaved,
}: {
  locations: LocationItem[]
  initialTransfer: TransferRecord | null
  onCancel: () => void
  onSaved: () => void
}) {
  const { tr } = useI18n()
  const isEditing = !!initialTransfer

  const [sourceLocationId, setSourceLocationId] = useState(
    initialTransfer?.source_location_id || locations[0]?.id || ''
  )
  const [destinationLocationId, setDestinationLocationId] = useState(
    initialTransfer?.destination_location_id || locations[1]?.id || locations[0]?.id || ''
  )
  const [status, setStatus] = useState<'pending' | 'completed'>(
    initialTransfer?.status === 'completed' ? 'completed' : 'pending'
  )
  const [referenceNumber, setReferenceNumber] = useState(
    initialTransfer?.reference_number || `MOV-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`
  )
  const [notes, setNotes] = useState(initialTransfer?.notes || '')
  const [productSearch, setProductSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  useEffect(() => {
    if (!sourceLocationId && locations.length > 0) {
      setSourceLocationId(locations[0].id)
    }
    if (!destinationLocationId && locations.length > 1) {
      setDestinationLocationId(locations[1].id)
    }
  }, [locations, sourceLocationId, destinationLocationId])

  const { data: catalogProducts = [] } = useQuery<CatalogProduct[]>({
    queryKey: ['products', 'catalog-all-for-movements'],
    queryFn: async () => {
      const res = await api.get('/api/v1/products')
      return res.data
    },
  })

  // Helper to get stock at a specific location for a product
  const getProductStockAt = (productId: string, locId: string): number => {
    const prod = catalogProducts.find((p) => p.id === productId)
    if (!prod || !prod.stocks) return 0
    const entry = prod.stocks.find((s) => s.location_id === locId)
    return entry ? entry.quantity : 0
  }

  const [items, setItems] = useState<DraftMovementItem[]>(() => {
    if (initialTransfer && initialTransfer.transfer_items.length > 0) {
      return initialTransfer.transfer_items.map((ti) => ({
        key: ti.id,
        product_id: ti.product_id,
        name: ti.product?.name || '',
        sku: ti.product?.sku || '',
        barcode: ti.product?.barcode || '',
        category_name: ti.product?.category_name || '',
        unit_price: ti.unit_price,
        quantity: String(ti.quantity),
      }))
    }
    return []
  })

  // Only products with stock > 0 at the selected Source Location are searchable
  const productsAvailableAtSource = useMemo(() => {
    if (!sourceLocationId) return []
    return catalogProducts.filter((p) => {
      const stockEntry = p.stocks?.find((s) => s.location_id === sourceLocationId)
      return (stockEntry?.quantity || 0) > 0
    })
  }, [catalogProducts, sourceLocationId])

  const filteredSourceProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return []
    return productsAvailableAtSource
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 12)
  }, [productsAvailableAtSource, productSearch])

  const addProductToMove = (product: CatalogProduct) => {
    const availableAtSource = getProductStockAt(product.id, sourceLocationId)
    if (availableAtSource <= 0) {
      setErrorMsg(
        tr(
          `Товар "${product.name}" має 0 залишку на вибраній локації-джерелі.`,
          `"${product.name}" has 0 stock at the selected source location.`
        )
      )
      return
    }

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.product_id === product.id)
      if (existingIdx !== -1) {
        const updated = [...prev]
        const currentQty = parseInt(updated[existingIdx].quantity, 10) || 1
        const nextQty = Math.min(availableAtSource, currentQty + 1)
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: String(nextQty),
        }
        return updated
      }

      return [
        ...prev,
        {
          key: `move-${product.id}-${Date.now()}`,
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode || '',
          category_name: product.category?.name || tr('Без категорії', 'Uncategorized'),
          unit_price: product.price,
          quantity: '1',
        },
      ]
    })
    setProductSearch('')
    setErrorMsg(null)
  }

  const updateItemQuantity = (key: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity: value } : item))
    )
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  const swapLocations = () => {
    const prevSource = sourceLocationId
    setSourceLocationId(destinationLocationId)
    setDestinationLocationId(prevSource)
  }

  const summary = useMemo(() => {
    let totalUnits = 0
    let totalRetail = 0

    for (const item of items) {
      const qty = Math.max(0, parseInt(item.quantity, 10) || 0)
      totalUnits += qty
      totalRetail += qty * item.unit_price
    }

    return {
      totalItems: items.length,
      totalUnits,
      totalRetail,
    }
  }, [items])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!sourceLocationId)
        throw new Error(tr('Будь ласка, виберіть локацію-джерело', 'Please select a source location'))
      if (!destinationLocationId)
        throw new Error(tr('Будь ласка, виберіть локацію призначення', 'Please select a destination location'))
      if (sourceLocationId === destinationLocationId) {
        throw new Error(
          tr('Локація-джерело та локація призначення повинні відрізнятися', 'Source and destination locations must be different')
        )
      }
      if (items.length === 0) {
        throw new Error(
          tr('Будь ласка, додайте принаймні один товар для переміщення', 'Please add at least one product to move')
        )
      }

      for (const item of items) {
        const qty = parseInt(item.quantity, 10)
        if (!qty || qty <= 0) {
          throw new Error(
            tr(`Кількість для "${item.name}" має бути не менше 1`, `Quantity for "${item.name}" must be at least 1`)
          )
        }
        const avail = getProductStockAt(item.product_id, sourceLocationId)
        if (qty > avail) {
          throw new Error(
            tr(
              `Недостатній залишок для "${item.name}" на локації-джерелі: запитано ${qty}, доступно ${avail}`,
              `Insufficient stock for "${item.name}" at source location: requested ${qty}, available ${avail}`
            )
          )
        }
      }

      const payload = {
        transfer: {
          source_location_id: sourceLocationId,
          destination_location_id: destinationLocationId,
          status,
          reference_number: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: parseInt(item.quantity, 10) || 1,
          })),
        },
      }

      if (isEditing && initialTransfer) {
        const res = await api.put(`/api/v1/transfers/${initialTransfer.id}`, payload)
        return res.data
      } else {
        const res = await api.post('/api/v1/transfers', payload)
        return res.data
      }
    },
    onSuccess: () => {
      onSaved()
    },
    onError: (err: any) => {
      const apiErr = err.response?.data?.errors
      setErrorMsg(
        apiErr || err.message || tr('Не вдалося зберегти переміщення товарів', 'Failed to save product movement')
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    saveMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEditing
                ? tr('Редагувати переміщення', 'Edit Pending Movement')
                : tr('Створити переміщення товарів', 'Create Product Movement')}
            </h2>
            <p className="text-xs text-slate-500">
              {tr(
                'Виберіть локацію-джерело та призначення, знайдіть наявні товари та вкажіть кількість для переміщення',
                'Select source and destination locations, search products stocked at source, and specify quantities to move'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            {tr('Скасувати', 'Cancel')}
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {saveMutation.isPending
              ? tr('Збереження...', 'Saving Movement...')
              : isEditing
                ? tr('Зберегти зміни', 'Save Movement Changes')
                : status === 'completed'
                  ? tr('Створити та завершити переміщення', 'Create & Complete Movement')
                  : tr('Створити переміщення (Очікує)', 'Create Pending Movement')}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-red-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Movement Header Configuration */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-end">
          {/* Source Location */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {tr('З локації-джерела *', 'From Source Location *')}
            </label>
            <select
              value={sourceLocationId}
              onChange={(e) => setSourceLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              required
            >
              <option value="" disabled>
                {tr('Виберіть джерело...', 'Select Source...')}
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.location_type === 'warehouse' ? tr('Склад', 'Warehouse') : tr('Магазин', 'Store')})
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="lg:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={swapLocations}
              title={tr('Поміняти місцями джерело та призначення', 'Swap Source and Destination Locations')}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Destination Location */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {tr('До локації призначення *', 'To Destination Location *')}
            </label>
            <select
              value={destinationLocationId}
              onChange={(e) => setDestinationLocationId(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                sourceLocationId && sourceLocationId === destinationLocationId
                  ? 'border-red-400 bg-red-50/30'
                  : 'border-slate-200'
              }`}
              required
            >
              <option value="" disabled>
                {tr('Виберіть призначення...', 'Select Destination...')}
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.location_type === 'warehouse' ? tr('Склад', 'Warehouse') : tr('Магазин', 'Store')})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {tr('Статус переміщення *', 'Movement Status *')}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'pending' | 'completed')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="pending">{tr('Очікує (План)', 'Pending (Reserve / Plan)')}</option>
              <option value="completed">{tr('Завершено (Перемістити одразу)', 'Completed (Move Now)')}</option>
            </select>
          </div>

          {/* Reference # */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {tr('Номер документа', 'Reference #')}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. MOV-2026-105"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {sourceLocationId && sourceLocationId === destinationLocationId && (
          <div className="text-xs font-semibold text-red-600">
            {tr(
              'Локація-джерело та локація призначення повинні відрізнятися.',
              'Source and destination locations must be different.'
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            {tr('Примітки до переміщення (необов’язково)', 'Movement Notes (Optional)')}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr(
              'Причина переміщення, дані кур’єра, поповнення вітрини...',
              'Reason for transfer, courier info, store restock notes...'
            )}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Search Products Available at Source Location */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              {tr(
                'Пошук та додавання товарів із залишків локації-джерела',
                'Search & Add Products from Source Location Stock'
              )}
            </label>
            <span className="text-xs text-slate-500">
              {productsAvailableAtSource.length}{' '}
              {tr('товарів у наявності на джерелі', 'products in stock at source')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={tr(
                  'Пошук товарів у наявності за назвою, SKU або штрихкодом...',
                  'Search products stocked at source by name, SKU, or barcode...'
                )}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4 text-blue-600" />
              <span>{tr('Сканувати', 'Scan')}</span>
            </button>
          </div>
        </div>

        {/* Search Results (shown only when searching) */}
        {productSearch.trim() && (
          <div className="pt-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase mb-2">
              {tr(
                'Знайдені товари в наявності на джерелі (Натисніть, щоб додати)',
                'Matching Stocked Products at Source (Click to add)'
              )}
            </div>
            {filteredSourceProducts.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                {tr(
                  `Немає товарів із доступним залишком на вибраній локації-джерелі за запитом "${productSearch.trim()}".`,
                  `No products with available stock at the selected source location match "${productSearch.trim()}".`
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredSourceProducts.map((prod) => {
                  const isAdded = items.some((i) => i.product_id === prod.id)
                  const sourceQty = getProductStockAt(prod.id, sourceLocationId)
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => addProductToMove(prod)}
                      className={`text-left px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-2.5 cursor-pointer ${
                        isAdded
                          ? 'border-blue-300 bg-blue-50/70 text-blue-900'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <div>
                        <div className="font-semibold line-clamp-1">{prod.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {prod.sku} • {tr('В наявності:', 'In Stock:')}{' '}
                          <strong className="text-emerald-700">
                            {sourceQty} {tr('шт.', 'pcs')}
                          </strong>{' '}
                          • ₴{prod.price.toFixed(2)}
                        </div>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-slate-400 ml-1" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Products to Move List */}
      <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {tr('Товари до переміщення', 'Products to Move')} ({items.length})
              </h3>
              <p className="text-xs text-slate-500">
                {tr(
                  'Кількість не може перевищувати доступний залишок на вибраній локації-джерелі',
                  'Quantities cannot exceed available stock at the selected source location'
                )}
              </p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 bg-white border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
            {tr(
              'До цього переміщення ще не додано жодного товару. Знайдіть або відскануйте товар вище.',
              'No products added to this movement yet. Search or scan a product stocked at the source location above.'
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const availableAtSource = getProductStockAt(item.product_id, sourceLocationId)
              const currentAtDest = getProductStockAt(item.product_id, destinationLocationId)
              const qtyNum = parseInt(item.quantity, 10) || 0
              const isOverStock = qtyNum > availableAtSource

              return (
                <div
                  key={item.key}
                  className={`p-4 bg-white border rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isOverStock ? 'border-red-300 bg-red-50/20' : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Read-only Product Info */}
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{item.name}</span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 text-slate-600">
                        {item.category_name || tr('Без категорії', 'Uncategorized')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>SKU: {item.sku}</span>
                      {item.barcode && (
                        <span>
                          • {tr('Штрихкод', 'Barcode')}: {item.barcode}
                        </span>
                      )}
                      <span>
                        • {tr('Роздрібна ціна', 'Retail Price')}: ₴{item.unit_price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          isOverStock
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {tr('Доступно на джерелі', 'Available at Source')}: {availableAtSource}{' '}
                        {tr('шт.', 'pcs')}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {tr('Зараз на призначенні', 'Current at Destination')}: {currentAtDest}{' '}
                        {tr('шт.', 'pcs')}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Input & Line Summary */}
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        {tr(`К-сть (Макс ${availableAtSource}) *`, `Move Qty (Max ${availableAtSource}) *`)}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, availableAtSource)}
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.key, e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 ${
                          isOverStock
                            ? 'border-red-400 text-red-700 focus:ring-red-500'
                            : 'border-slate-200 text-slate-900 focus:ring-blue-500'
                        }`}
                        required
                      />
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {tr('Сума рядка', 'Line Value')}
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        ₴{(qtyNum * item.unit_price).toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title={tr('Прибрати товар із переміщення', 'Remove Product from Movement')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Sticky Summary Bar */}
      <div className="sticky bottom-4 z-30 bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {tr('Товарів', 'Products')}
            </div>
            <div className="text-lg font-bold">{summary.totalItems}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {tr('Усього одиниць до переміщення', 'Total Units to Move')}
            </div>
            <div className="text-lg font-bold text-blue-400">
              {summary.totalUnits} {tr('шт.', 'pcs')}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {tr('Загальна роздрібна сума', 'Total Retail Value')}
            </div>
            <div className="text-lg font-bold text-emerald-400">
              ₴{summary.totalRetail.toFixed(2)}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
        >
          {saveMutation.isPending
            ? tr('Збереження...', 'Saving...')
            : isEditing
              ? tr('Зберегти зміни', 'Save Movement Changes')
              : status === 'completed'
                ? tr('Завершити та перемістити залишки', 'Complete & Move Stock Now')
                : tr('Зберегти як очікуюче переміщення', 'Save as Pending Movement')}
        </button>
      </div>

      {/* Camera Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={(code) => {
            const matched = productsAvailableAtSource.find((p) => p.barcode === code)
            if (matched) {
              addProductToMove(matched)
            } else {
              setProductSearch(code)
            }
            setIsScannerOpen(false)
          }}
        />
      )}
    </form>
  )
}
