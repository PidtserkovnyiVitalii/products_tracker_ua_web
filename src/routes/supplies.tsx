import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect, type FormEvent } from 'react'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../i18n/i18n'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import { PrintWaybillPortal, type PrintableWaybillData } from '../components/PrintWaybillPortal'
import { exportSupplyToExcel } from '../utils/waybillExport'
import { generateInternalEan13 } from '../utils/barcode'
import {
  Truck,
  Plus,
  Search,
  MapPin,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ShieldAlert,
  X,
  Edit3,
  Trash2,
  ScanBarcode,
  Sparkles,
  ArrowLeft,
  Eye,
  FileText,
  Layers,
  TrendingUp,
  Printer,
  FileSpreadsheet,
} from 'lucide-react'

export const Route = createFileRoute('/supplies')({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    supplier_id?: string
    location_id?: string
    status?: string
    query?: string
    view_id?: string
  } => ({
    supplier_id: (search.supplier_id as string) || undefined,
    location_id: (search.location_id as string) || undefined,
    status: (search.status as string) || undefined,
    query: (search.query as string) || undefined,
    view_id: (search.view_id as string) || undefined,
  }),
  component: SuppliesPage,
})

/* =========================================================================
   Interfaces & Types
   ========================================================================= */

interface SupplierOption {
  id: string
  name: string
  phone?: string | null
  address?: string | null
}

interface LocationOption {
  id: string
  name: string
  location_type?: string
}

interface CategoryOption {
  id: string
  name: string
}

interface CatalogProduct {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  category_id?: string
  category?: { id: string; name: string }
  total_stock: number
  stocks: { location_id: string; location_name: string; quantity: number }[]
}

interface SupplyItemRecord {
  id: string
  product_id: string
  quantity: number
  cost_price: number
  selling_price: number
  line_cost_total: number
  line_selling_total: number
  product: {
    id: string
    name: string
    sku: string
    barcode?: string
    current_price: number
    category_id?: string
    category_name?: string
  } | null
}

interface SupplyRecord {
  id: string
  reference_number?: string | null
  notes?: string | null
  status: 'pending' | 'received' | 'cancelled'
  supplier_id: string
  supplier: {
    id: string
    name: string
    phone?: string | null
  } | null
  location_id: string
  location: {
    id: string
    name: string
    location_type?: string
  } | null
  total_items_count: number
  total_units_count: number
  total_cost: number
  total_selling_value: number
  received_at?: string | null
  created_at: string
  updated_at: string
  supply_items: SupplyItemRecord[]
}

interface DraftSupplyItem {
  key: string
  isNew: boolean
  product_id?: string
  name: string
  sku: string
  barcode: string
  category_id: string
  cost_price: string
  selling_price: string
  quantity: string
}

/* =========================================================================
   Status Badge Helper
   ========================================================================= */

function StatusBadge({ status }: { status: 'pending' | 'received' | 'cancelled' }) {
  const { tr } = useI18n()
  if (status === 'received') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {tr('Отримано (На складі)', 'Received (In Stock)')}
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3.5 h-3.5" />
        {tr('Скасовано', 'Cancelled')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3.5 h-3.5" />
      {tr('Очікує', 'Pending')}
    </span>
  )
}

/* =========================================================================
   Supply Details Modal
   ========================================================================= */

function SupplyDetailsModal({
  supply,
  onClose,
  onStatusChange,
  onEdit,
  isStatusUpdating,
}: {
  supply: SupplyRecord
  onClose: () => void
  onStatusChange: (supplyId: string, status: 'pending' | 'received' | 'cancelled') => void
  onEdit: (supply: SupplyRecord) => void
  isStatusUpdating: boolean
}) {
  const { tr, locale } = useI18n()
  const expectedProfit = supply.total_selling_value - supply.total_cost

  const statusLabel = (st: 'pending' | 'received' | 'cancelled') => {
    if (st === 'received') return tr('Отримано', 'Received')
    if (st === 'cancelled') return tr('Скасовано', 'Cancelled')
    return tr('Очікує', 'Pending')
  }

  const printableData: PrintableWaybillData = useMemo(() => {
    return {
      docType: 'supply',
      referenceNumber: supply.reference_number || supply.id.slice(0, 8).toUpperCase(),
      date: new Date(supply.created_at).toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: supply.status,
      statusLabel: statusLabel(supply.status),
      partyFromLabel: tr('Постачальник (Відправник):', 'Supplier (Sender):'),
      partyFromName: supply.supplier?.name || tr('Невідомий постачальник', 'Unknown Supplier'),
      partyFromExtra: supply.supplier?.phone ? `${tr('Тел:', 'Phone:')} ${supply.supplier.phone}` : null,
      partyToLabel: tr('Локація призначення (Одержувач):', 'Destination Location (Receiver):'),
      partyToName: supply.location?.name || tr('Невідома локація', 'Unknown Location'),
      notes: supply.notes,
      completedAt: supply.received_at
        ? new Date(supply.received_at).toLocaleString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
      completedAtLabel: tr('Отримано на склад:', 'Received into stock:'),
      items: supply.supply_items.map((item) => ({
        id: item.id,
        name: item.product?.name || tr('Невідомий товар', 'Unknown Product'),
        category: item.product?.category_name,
        sku: item.product?.sku || '-',
        barcode: item.product?.barcode,
        quantity: item.quantity,
        unitPrice: item.cost_price,
        lineTotal: item.line_cost_total,
      })),
      totalUnits: supply.total_units_count,
      totalAmount: supply.total_cost,
    }
  }, [supply, tr])

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900">
                  {supply.reference_number || `${tr('Поставка', 'Supply')} #${supply.id.slice(0, 8).toUpperCase()}`}
                </h2>
                <StatusBadge status={supply.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {tr('Постачальник:', 'Supplier:')}{' '}
                <strong className="text-slate-700">{supply.supplier?.name}</strong> •{' '}
                {tr('Призначення:', 'Destination:')}{' '}
                <strong className="text-slate-700">{supply.location?.name}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shadow-xs"
                title={tr('Друк накладної (A4)', 'Print Waybill (A4)')}
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">{tr('Друк', 'Print')}</span>
              </button>
              <button
                type="button"
                onClick={() => exportSupplyToExcel(supply, locale)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer shadow-xs"
                title={tr('Експорт в Excel (.xlsx)', 'Export to Excel (.xlsx)')}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              {supply.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => onEdit(supply)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tr('Редагувати', 'Edit')}</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="text-[11px] font-semibold uppercase text-slate-400">
                {tr('Усього одиниць', 'Total Units')}
              </div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {supply.total_units_count} {tr('шт.', 'pcs')} ({supply.total_items_count} SKUs)
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="text-[11px] font-semibold uppercase text-slate-400">
                {tr('Закупівельна сума', 'Total Supplier Cost')}
              </div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                ₴{supply.total_cost.toFixed(2)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/60">
              <div className="text-[11px] font-semibold uppercase text-blue-600">
                {tr('Роздрібна оцінка', 'Retail Value Snapshot')}
              </div>
              <div className="text-lg font-bold text-blue-900 mt-0.5">
                ₴{supply.total_selling_value.toFixed(2)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
              <div className="text-[11px] font-semibold uppercase text-emerald-600">
                {tr('Очікувана маржа', 'Expected Margin')}
              </div>
              <div className="text-lg font-bold text-emerald-800 mt-0.5">
                +₴{expectedProfit.toFixed(2)}
              </div>
            </div>
          </div>

          {supply.notes && (
            <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-xl text-xs text-slate-700 flex items-start gap-2">
              <FileText className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">
                  {tr('Примітки до поставки: ', 'Supply Notes: ')}
                </span>
                {supply.notes}
              </div>
            </div>
          )}

          {/* Status Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-800">
                {tr('Статус поставки та контроль залишків', 'Supply Status & Stock Control')}
              </div>
              <p className="text-[11px] text-slate-500">
                {tr(
                  `Залишки зараховуються на локацію "${supply.location?.name}" лише коли статус "Отримано".`,
                  `Stock is only counted at "${supply.location?.name}" while status is "Received".`
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['pending', 'received', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={isStatusUpdating || supply.status === st}
                  onClick={() => onStatusChange(supply.id, st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                    supply.status === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {statusLabel(st)}
                </button>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {tr('Позиції поставки та зафіксовані ціни', 'Supplied Product Items & Price Snapshots')}
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-4">{tr('Товар', 'Product')}</th>
                    <th className="py-2.5 px-3">{tr('SKU / Штрихкод', 'SKU / Barcode')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('К-сть', 'Qty')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Закупівля', 'Cost Snapshot')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Роздріб', 'Retail Snapshot')}</th>
                    <th className="py-2.5 px-4 text-right">{tr('Сума закупівлі', 'Line Cost')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {supply.supply_items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {item.product?.name || tr('Невідомий товар', 'Unknown Product')}
                        </div>
                        {item.product?.category_name && (
                          <div className="text-[11px] text-slate-400">{item.product.category_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        <div>{item.product?.sku}</div>
                        {item.product?.barcode && (
                          <div className="text-slate-400">{item.product.barcode}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-3 px-3 text-right text-slate-700">
                        ₴{item.cost_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-blue-700">
                        ₴{item.selling_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₴{item.line_cost_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Clean printable waybill portal rendered to document.body */}
    <PrintWaybillPortal data={printableData} />
  </>
)
}

/* =========================================================================
   Create / Edit Supply Form Workspace
   ========================================================================= */

function SupplyWorkspace({
  initialSupply,
  suppliers,
  locations,
  categories,
  catalogProducts,
  onCancel,
  onSaved,
}: {
  initialSupply?: SupplyRecord | null
  suppliers: SupplierOption[]
  locations: LocationOption[]
  categories: CategoryOption[]
  catalogProducts: CatalogProduct[]
  onCancel: () => void
  onSaved: (msg: string) => void
}) {
  const { tr } = useI18n()
  const queryClient = useQueryClient()
  const isEditing = !!initialSupply

  const [supplierId, setSupplierId] = useState(
    initialSupply?.supplier_id || suppliers[0]?.id || ''
  )
  const [locationId, setLocationId] = useState(
    initialSupply?.location_id || locations[0]?.id || ''
  )
  const [status, setStatus] = useState<'pending' | 'received'>(
    initialSupply?.status === 'received' ? 'received' : 'pending'
  )
  const [referenceNumber, setReferenceNumber] = useState(initialSupply?.reference_number || '')
  const [notes, setNotes] = useState(initialSupply?.notes || '')

  // Search bar for adding existing catalog products
  const [productSearch, setProductSearch] = useState('')
  const [scannerTargetKey, setScannerTargetKey] = useState<string | 'search' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [items, setItems] = useState<DraftSupplyItem[]>(() => {
    if (initialSupply && initialSupply.supply_items.length > 0) {
      return initialSupply.supply_items.map((si) => ({
        key: si.id,
        isNew: false,
        product_id: si.product_id,
        name: si.product?.name || '',
        sku: si.product?.sku || '',
        barcode: si.product?.barcode || '',
        category_id: si.product?.category_id || '',
        cost_price: String(si.cost_price),
        selling_price: String(si.selling_price),
        quantity: String(si.quantity),
      }))
    }
    return []
  })

  const filteredCatalog = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return []
    return catalogProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 10)
  }, [catalogProducts, productSearch])

  const addExistingProduct = (product: CatalogProduct) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => !i.isNew && i.product_id === product.id)
      if (existingIdx !== -1) {
        const updated = [...prev]
        const currentQty = parseInt(updated[existingIdx].quantity, 10) || 1
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: String(currentQty + 1),
        }
        return updated
      }

      return [
        ...prev,
        {
          key: `existing-${product.id}-${Date.now()}`,
          isNew: false,
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode || '',
          category_id: product.category_id || '',
          cost_price: (product.price * 0.7).toFixed(2),
          selling_price: product.price.toFixed(2),
          quantity: '10',
        },
      ]
    })
    setProductSearch('')
  }

  const addNewProductRow = () => {
    const randCode = Math.floor(1000 + Math.random() * 9000)
    setItems((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random()}`,
        isNew: true,
        name: '',
        sku: `SKU-NEW-${randCode}`,
        barcode: generateInternalEan13(),
        category_id: categories[0]?.id || '',
        cost_price: '100.00',
        selling_price: '150.00',
        quantity: '10',
      },
    ])
  }

  const updateItemField = (key: string, field: keyof DraftSupplyItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    )
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  const newItems = items.filter((i) => i.isNew)
  const existingItems = items.filter((i) => !i.isNew)

  const summary = useMemo(() => {
    let totalUnits = 0
    let totalCost = 0
    let totalRetail = 0

    for (const item of items) {
      const qty = Math.max(0, parseInt(item.quantity, 10) || 0)
      const cost = Math.max(0, parseFloat(item.cost_price) || 0)
      const retail = Math.max(0, parseFloat(item.selling_price) || 0)
      totalUnits += qty
      totalCost += qty * cost
      totalRetail += qty * retail
    }

    return {
      totalUnits,
      totalCost,
      totalRetail,
      margin: totalRetail - totalCost,
    }
  }, [items])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        supplier_id: supplierId,
        location_id: locationId,
        status,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          product_id: item.isNew ? undefined : item.product_id,
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          cost_price: Math.max(0, parseFloat(item.cost_price) || 0),
          selling_price: Math.max(0, parseFloat(item.selling_price) || 0),
          product: {
            name: item.name.trim(),
            sku: item.sku.trim(),
            barcode: item.barcode.trim() || undefined,
            category_id: item.category_id || undefined,
            price: Math.max(0, parseFloat(item.selling_price) || 0),
          },
        })),
      }

      if (isEditing && initialSupply) {
        const res = await api.put(`/api/v1/supplies/${initialSupply.id}`, { supply: payload })
        return res.data
      } else {
        const res = await api.post('/api/v1/supplies', { supply: payload })
        return res.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      onSaved(
        isEditing
          ? tr('Поставку та дані товарів успішно оновлено!', 'Supply and product details updated successfully!')
          : status === 'received'
            ? tr('Поставку створено та залишки додано на локацію!', 'Supply created and stock added to location!')
            : tr('Очікуючу поставку створено та ціни зафіксовано!', 'Pending supply created and product price snapshots recorded!')
      )
    },
    onError: (err: unknown) => {
      let msg = tr('Не вдалося зберегти поставку', 'Failed to save supply')
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg =
          typeof err.response.data.errors === 'string'
            ? err.response.data.errors
            : JSON.stringify(err.response.data.errors)
      }
      setErrorMsg(msg)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!supplierId) {
      setErrorMsg(tr('Будь ласка, виберіть постачальника.', 'Please select a supplier.'))
      return
    }
    if (!locationId) {
      setErrorMsg(tr('Будь ласка, виберіть магазин або склад призначення.', 'Please select a destination store or warehouse.'))
      return
    }
    if (items.length === 0) {
      setErrorMsg(
        tr('Будь ласка, додайте принаймні один новий або існуючий товар до поставки.', 'Please add at least one new or existing product to the supply.')
      )
      return
    }

    for (const item of items) {
      if (!item.name.trim() || !item.sku.trim()) {
        setErrorMsg(tr('Кожен товар у поставці повинен мати Назву та SKU.', 'Every product in the supply must have a Name and SKU.'))
        return
      }
    }

    saveMutation.mutate()
  }

  const renderEditableProductRow = (item: DraftSupplyItem) => {
    const costNum = parseFloat(item.cost_price) || 0
    const sellNum = parseFloat(item.selling_price) || 0
    const qtyNum = parseInt(item.quantity, 10) || 0
    const unitMargin = sellNum - costNum

    return (
      <div
        key={item.key}
        className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3 hover:border-slate-300 transition-colors"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
          {/* Product Name */}
          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {tr('Назва товару *', 'Product Name *')}
            </label>
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateItemField(item.key, 'name', e.target.value)}
              placeholder="e.g. Конструктор LEGO City"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* SKU */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              SKU *
            </label>
            <input
              type="text"
              value={item.sku}
              onChange={(e) => updateItemField(item.key, 'sku', e.target.value.toUpperCase())}
              placeholder="SKU-CODE"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Barcode + Generator + Scanner */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {tr('Штрихкод (EAN-13 / Code128)', 'Barcode (EAN-13 / Code128)')}
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={item.barcode}
                onChange={(e) => updateItemField(item.key, 'barcode', e.target.value)}
                placeholder={tr('Скануйте або згенеруйте', 'Scan or generate')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => updateItemField(item.key, 'barcode', generateInternalEan13())}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title={tr('Згенерувати внутрішній штрихкод EAN-13', 'Generate Internal EAN-13 Barcode')}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setScannerTargetKey(item.key)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title={tr('Сканувати штрихкод камерою', 'Scan Barcode with Camera')}
              >
                <ScanBarcode className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {tr('Категорія', 'Category')}
            </label>
            <select
              value={item.category_id}
              onChange={(e) => updateItemField(item.key, 'category_id', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{tr('Без категорії', 'Uncategorized')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row: Pricing & Quantity */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-32">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {tr('Закупівля (₴) *', 'Cost Price (₴) *')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.cost_price}
                onChange={(e) => updateItemField(item.key, 'cost_price', e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="w-36">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
                {tr('Роздріб (₴) *', 'Selling Price (₴) *')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.selling_price}
                onChange={(e) => updateItemField(item.key, 'selling_price', e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/40 text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="w-24">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {tr('Кількість *', 'Quantity *')}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(e) => updateItemField(item.key, 'quantity', e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {tr('Сума закупівлі / Маржа', 'Line Cost / Unit Margin')}
              </div>
              <div className="text-xs font-bold text-slate-800">
                ₴{(costNum * qtyNum).toFixed(2)}{' '}
                <span
                  className={`ml-1.5 text-[11px] font-semibold ${
                    unitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  ({unitMargin >= 0 ? '+' : ''}₴{unitMargin.toFixed(2)}/{tr('од.', 'unit')})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.key)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              title={tr('Прибрати товар із поставки', 'Remove Item from Supply')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
                ? tr('Редагувати поставку', 'Edit Pending Supply')
                : tr('Створити нову поставку', 'Create New Supply')}
            </h2>
            <p className="text-xs text-slate-500">
              {tr(
                'Виберіть магазин/склад призначення, відредагуйте деталі товарів та зафіксуйте ціни',
                'Select destination store/warehouse, edit product details inline, and snapshot prices'
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
              ? tr('Збереження...', 'Saving Supply...')
              : isEditing
                ? tr('Зберегти зміни', 'Save Supply Changes')
                : status === 'received'
                  ? tr('Створити та прийняти на склад', 'Create & Receive into Stock')
                  : tr('Створити очікуючу поставку', 'Create Pending Supply')}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-red-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Supply Header Configuration */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            {tr('Постачальник *', 'Supplier *')}
          </label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="" disabled>
              {tr('Виберіть постачальника...', 'Select Supplier...')}
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            {tr('Магазин / Склад призначення *', 'Destination Store / Warehouse *')}
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="" disabled>
              {tr('Виберіть локацію...', 'Select Location...')}
            </option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.location_type === 'warehouse' ? tr('Склад', 'Warehouse') : tr('Магазин', 'Store')})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            {tr('Статус поставки *', 'Supply Status *')}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'pending' | 'received')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
          >
            <option value="pending">
              {tr('Очікує (Ще не додавати до залишків)', 'Pending (Do not add to stock yet)')}
            </option>
            <option value="received">
              {tr('Отримано (Додати до залишків одразу)', 'Received (Add to stock immediately)')}
            </option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            {tr('Номер накладної / Документа', 'Reference / Invoice #')}
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. SUP-2026-105"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            {tr('Примітки до поставки (необов’язково)', 'Supply Notes (Optional)')}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr(
              'Коментарі до доставки, деталі партії, нотатки до накладної...',
              'Delivery comments, batch details, invoice notes...'
            )}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Add Products Toolbar: Search Existing OR Create New */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {tr(
                'Пошук та додавання існуючого товару з каталогу',
                'Search & Add Existing Product from Catalog'
              )}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={tr(
                    'Пошук існуючих товарів за назвою, SKU або штрихкодом...',
                    'Search existing products by name, SKU, or barcode...'
                  )}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setScannerTargetKey('search')}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <ScanBarcode className="w-4 h-4 text-blue-600" />
                <span>{tr('Сканувати', 'Scan')}</span>
              </button>
            </div>
          </div>

          <div className="md:pt-5">
            <button
              type="button"
              onClick={addNewProductRow}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {tr('Додати новий товар', 'Add New Product Row')}
            </button>
          </div>
        </div>

        {/* Matching Catalog Picker Results (only when searching) */}
        {productSearch.trim() && (
          <div className="pt-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase mb-2">
              {tr('Знайдені товари в каталозі (Натисніть, щоб додати)', 'Matching Catalog Products (Click to add)')}
            </div>
            {filteredCatalog.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                {tr(
                  `Існуючих товарів за запитом "${productSearch.trim()}" не знайдено.`,
                  `No existing products match "${productSearch.trim()}".`
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredCatalog.map((prod) => {
                  const isAdded = existingItems.some((i) => i.product_id === prod.id)
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => addExistingProduct(prod)}
                      className={`text-left px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-2 cursor-pointer ${
                        isAdded
                          ? 'border-blue-300 bg-blue-50/70 text-blue-900'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <div>
                        <div className="font-semibold line-clamp-1">{prod.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {prod.sku} • {tr('Роздріб:', 'Retail:')} ₴{prod.price.toFixed(2)}
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

      {/* Separated Section 1: New Products */}
      <div className="bg-indigo-50/40 border border-indigo-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {tr('Нові товари для створення', 'New Products to Create')} ({newItems.length})
              </h3>
              <p className="text-xs text-slate-500">
                {tr(
                  'Ці товари будуть автоматично зареєстровані у вашому каталозі під час збереження поставки',
                  'These products will be automatically registered in your catalog when this supply is saved'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={addNewProductRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {tr('Додати новий товар', 'Add New Product')}
          </button>
        </div>

        {newItems.length === 0 ? (
          <div className="text-center py-8 bg-white/80 border border-dashed border-indigo-200 rounded-xl text-xs text-slate-500">
            {tr(
              'У цій поставці ще немає нових товарів. Натисніть "Додати новий товар" вище, якщо ви отримуєте нові позиції.',
              'No new products in this supply yet. Click "Add New Product" above if you are receiving brand-new catalog items.'
            )}
          </div>
        ) : (
          <div className="space-y-3">{newItems.map((item) => renderEditableProductRow(item))}</div>
        )}
      </div>

      {/* Separated Section 2: Existing Products */}
      <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {tr('Існуючі товари з каталогу', 'Existing Catalog Products')} ({existingItems.length})
              </h3>
              <p className="text-xs text-slate-500">
                {tr(
                  'Ви можете редагувати SKU, штрихкод, назву або роздрібну ціну нижче — зміни оновлять каталог і зафіксують ціну поставки',
                  "You can edit SKU, barcode, name, or selling price directly below — changes update the product catalog and snapshot this supply's price"
                )}
              </p>
            </div>
          </div>
        </div>

        {existingItems.length === 0 ? (
          <div className="text-center py-8 bg-white border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
            {tr(
              'Існуючі товари не вибрано. Знайдіть або відскануйте товар у рядку пошуку вище.',
              'No existing products selected. Search or click any product in the catalog bar above to add it.'
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {existingItems.map((item) => renderEditableProductRow(item))}
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="sticky bottom-4 z-30 bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {tr('Позиції / Одиниці', 'Total Items / Units')}
            </div>
            <div className="text-lg font-bold">
              {items.length} SKUs ({summary.totalUnits} {tr('шт.', 'units')})
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {tr('Сума закупівлі', 'Total Supplier Cost')}
            </div>
            <div className="text-lg font-bold text-amber-300">
              ₴{summary.totalCost.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {tr('Роздрібна вартість', 'Total Retail Value')}
            </div>
            <div className="text-lg font-bold text-blue-300">
              ₴{summary.totalRetail.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {tr('Очікуваний прибуток', 'Expected Profit Margin')}
            </div>
            <div className="text-lg font-bold text-emerald-400">
              +₴{summary.margin.toFixed(2)}
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
              ? tr('Зберегти зміни', 'Save Supply Changes')
              : status === 'received'
                ? tr('Підтвердити та прийняти поставку', 'Confirm & Receive Supply')
                : tr('Зберегти очікуючу поставку', 'Save Pending Supply')}
        </button>
      </div>

      {scannerTargetKey && (
        <BarcodeScannerModal
          isOpen={!!scannerTargetKey}
          onClose={() => setScannerTargetKey(null)}
          onScan={(decodedText) => {
            if (scannerTargetKey === 'search') {
              const found = catalogProducts.find((p) => p.barcode === decodedText)
              if (found) {
                addExistingProduct(found)
              } else {
                setProductSearch(decodedText)
              }
            } else {
              updateItemField(scannerTargetKey, 'barcode', decodedText)
            }
            setScannerTargetKey(null)
          }}
        />
      )}
    </form>
  )
}

/* =========================================================================
   Main Supplies Page Component
   ========================================================================= */

function SuppliesPage() {
  const { tr } = useI18n()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const searchParams = Route.useSearch()
  const navigate = useNavigate({ from: '/supplies' })
  const queryClient = useQueryClient()

  const canManage = user?.role === 'admin' || user?.role === 'stockkeeper'

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingSupply, setEditingSupply] = useState<SupplyRecord | null>(null)
  const [viewingSupply, setViewingSupply] = useState<SupplyRecord | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/api/v1/suppliers')
      return res.data
    },
    enabled: !!token && canManage,
  })

  const { data: locations = [] } = useQuery<LocationOption[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
    enabled: !!token && canManage,
  })

  const { data: categories = [] } = useQuery<CategoryOption[]>({
    queryKey: ['categories', 'flat'],
    queryFn: async () => {
      const res = await api.get('/api/v1/categories')
      return res.data
    },
    enabled: !!token && canManage,
  })

  const { data: catalogProducts = [] } = useQuery<CatalogProduct[]>({
    queryKey: ['products', 'all-for-supply'],
    queryFn: async () => {
      const res = await api.get('/api/v1/products')
      return res.data
    },
    enabled: !!token && canManage,
  })

  const {
    data: supplies = [],
    isLoading,
    error,
  } = useQuery<SupplyRecord[]>({
    queryKey: ['supplies', searchParams],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchParams.supplier_id) params.set('supplier_id', searchParams.supplier_id)
      if (searchParams.location_id) params.set('location_id', searchParams.location_id)
      if (searchParams.status) params.set('status', searchParams.status)
      if (searchParams.query) params.set('query', searchParams.query)
      const res = await api.get(`/api/v1/supplies?${params.toString()}`)
      return res.data
    },
    enabled: !!token && canManage,
  })

  const viewId = searchParams.view_id

  useEffect(() => {
    if (!viewId) return
    const found = supplies.find((s) => s.id === viewId)
    if (found) {
      setViewingSupply(found)
    } else {
      api
        .get(`/api/v1/supplies/${viewId}`)
        .then((res) => {
          if (res.data) setViewingSupply(res.data)
        })
        .catch(() => {})
    }
  }, [viewId, supplies])

  const handleCloseViewModal = () => {
    setViewingSupply(null)
    if (viewId) {
      navigate({
        search: (prev) => ({
          ...prev,
          view_id: undefined,
        }),
      })
    }
  }

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: 'pending' | 'received' | 'cancelled'
    }) => {
      const res = await api.patch(`/api/v1/supplies/${id}/status`, { status })
      return res.data as SupplyRecord
    },
    onSuccess: (updatedSupply) => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (viewingSupply && viewingSupply.id === updatedSupply.id) {
        setViewingSupply(updatedSupply)
      }
      setStatusError(null)
      setSuccessMsg(
        tr(
          `Статус поставки оновлено на "${updatedSupply.status.toUpperCase()}".`,
          `Supply status updated to "${updatedSupply.status.toUpperCase()}".`
        )
      )
      setTimeout(() => setSuccessMsg(null), 3500)
    },
    onError: (err: unknown) => {
      let msg = tr('Не вдалося змінити статус поставки.', 'Failed to change supply status.')
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg =
          typeof err.response.data.errors === 'string'
            ? err.response.data.errors
            : JSON.stringify(err.response.data.errors)
      }
      setStatusError(msg)
    },
  })

  if (!canManage) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 inline-block text-amber-600 mb-4">
          <ShieldAlert className="w-10 h-10 mx-auto" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {tr('Доступ обмежено', 'Access Restricted')}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {tr(
            'Управління поставками доступне лише комірникам та адміністраторам.',
            'Supplies management is reserved for Stockkeepers and Administrators.'
          )}
        </p>
        <Link
          to="/products"
          className="px-5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-blue-700 transition-colors inline-block"
        >
          {tr('Повернутися до каталогу товарів', 'Return to Products Catalog')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {mode === 'create' || mode === 'edit' ? (
        <SupplyWorkspace
          initialSupply={mode === 'edit' ? editingSupply : null}
          suppliers={suppliers}
          locations={locations}
          categories={categories}
          catalogProducts={catalogProducts}
          onCancel={() => {
            setMode('list')
            setEditingSupply(null)
          }}
          onSaved={(msg) => {
            setMode('list')
            setEditingSupply(null)
            setSuccessMsg(msg)
            setTimeout(() => setSuccessMsg(null), 4000)
          }}
        />
      ) : (
        <>
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {tr('Поставки та Надходження', 'Supplies & Shipments')}
                </h1>
                <p className="text-xs text-slate-500">
                  {tr(
                    'Приймайте товари у магазини та склади, керуйте очікуючими поставками та відстежуйте історію цін',
                    'Receive inventory into stores, manage pending shipments, and track product price history'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                to="/management"
                search={{ tab: 'suppliers' }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                {tr('Керувати постачальниками', 'Manage Suppliers')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEditingSupply(null)
                  setMode('create')
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {tr('Нова поставка', 'New Supply')}
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {statusError && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-red-700 text-xs font-medium">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{statusError}</span>
              </div>
              <button
                onClick={() => setStatusError(null)}
                className="p-1 hover:bg-red-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchParams.query || ''}
                onChange={(e) =>
                  navigate({
                    search: (prev) => ({ ...prev, query: e.target.value || undefined }),
                  })
                }
                placeholder={tr(
                  'Пошук за номером, постачальником, примітками...',
                  'Search reference, supplier, notes...'
                )}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={searchParams.supplier_id || ''}
              onChange={(e) =>
                navigate({
                  search: (prev) => ({ ...prev, supplier_id: e.target.value || undefined }),
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{tr('Усі постачальники', 'All Suppliers')}</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>

            <select
              value={searchParams.location_id || ''}
              onChange={(e) =>
                navigate({
                  search: (prev) => ({ ...prev, location_id: e.target.value || undefined }),
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{tr('Усі локації призначення', 'All Destination Locations')}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>

            <select
              value={searchParams.status || ''}
              onChange={(e) =>
                navigate({
                  search: (prev) => ({ ...prev, status: e.target.value || undefined }),
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{tr('Усі статуси', 'All Statuses')}</option>
              <option value="pending">{tr('Очікує', 'Pending')}</option>
              <option value="received">{tr('Отримано (На складі)', 'Received (In Stock)')}</option>
              <option value="cancelled">{tr('Скасовано', 'Cancelled')}</option>
            </select>
          </div>

          {/* Supplies List */}
          {isLoading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {tr('Завантаження поставок...', 'Loading supplies...')}
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">
              {tr('Не вдалося завантажити список поставок.', 'Failed to load supplies list.')}
            </div>
          ) : supplies.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-semibold text-slate-700 text-sm">
                {tr('Поставок не знайдено', 'No supplies found')}
              </h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                {tr(
                  'Створіть нову поставку для прийому товарів або реєстрації вхідних партій.',
                  'Create a new supply to receive inventory or register incoming shipments.'
                )}
              </p>
              <button
                type="button"
                onClick={() => setMode('create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-blue-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {tr('Створити першу поставку', 'Create First Supply')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {supplies.map((supply) => (
                <div
                  key={supply.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-base">
                          {supply.reference_number || `SUP-${supply.id.slice(0, 6).toUpperCase()}`}
                        </span>
                        <StatusBadge status={supply.status} />
                        <span className="text-xs text-slate-400">
                          {tr('Створено', 'Created')}{' '}
                          {new Date(supply.created_at).toLocaleDateString('nl-NL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                        {supply.received_at && (
                          <span className="text-xs text-emerald-600 font-medium">
                            • {tr('Отримано', 'Received')}{' '}
                            {new Date(supply.received_at).toLocaleDateString('nl-NL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Truck className="w-3.5 h-3.5 text-indigo-600" />
                          {supply.supplier?.name || tr('Невідомий постачальник', 'Unknown Supplier')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          {supply.location?.name || tr('Невідома локація', 'Unknown Location')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-blue-600" />
                          {supply.total_items_count} SKUs ({supply.total_units_count} {tr('шт.', 'units')})
                        </span>
                      </div>

                      {supply.notes && (
                        <p className="text-xs text-slate-500 italic">{supply.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-semibold text-slate-400">
                            {tr('Сума закупівлі', 'Total Cost')}
                          </div>
                          <div className="text-sm font-bold text-slate-900">
                            ₴{supply.total_cost.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-semibold text-blue-500 flex items-center justify-end gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {tr('Роздрібна сума', 'Retail Value')}
                          </div>
                          <div className="text-sm font-bold text-blue-700">
                            ₴{supply.total_selling_value.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Quick Status Selector */}
                      <div className="flex items-center gap-2">
                        <select
                          value={supply.status}
                          disabled={statusMutation.isPending}
                          onChange={(e) =>
                            statusMutation.mutate({
                              id: supply.id,
                              status: e.target.value as 'pending' | 'received' | 'cancelled',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          title={tr('Змінити статус поставки', 'Change Supply Status')}
                        >
                          <option value="pending">{tr('Статус: Очікує', 'Status: Pending')}</option>
                          <option value="received">{tr('Статус: Отримано', 'Status: Received')}</option>
                          <option value="cancelled">{tr('Статус: Скасовано', 'Status: Cancelled')}</option>
                        </select>

                        {supply.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSupply(supply)
                              setMode('edit')
                            }}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                            title={tr('Редагувати поставку', 'Edit Pending Supply')}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setViewingSupply(supply)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {tr('Деталі', 'Details')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewingSupply && (
            <SupplyDetailsModal
              supply={viewingSupply}
              onClose={handleCloseViewModal}
              isStatusUpdating={statusMutation.isPending}
              onStatusChange={(supplyId, newStatus) =>
                statusMutation.mutate({ id: supplyId, status: newStatus })
              }
              onEdit={(sup) => {
                handleCloseViewModal()
                setEditingSupply(sup)
                setMode('edit')
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
