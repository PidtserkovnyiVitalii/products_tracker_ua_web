import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { api } from '../api/api'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  RotateCcw,
  Printer,
  ShoppingBag,
  Trash2,
  TrendingUp,
  MapPin,
  Clock,
  User as UserIcon,
  Camera,
  Percent,
  FileText,
  Tag,
} from 'lucide-react'

export const Route = createFileRoute('/sales')({
  component: SalesPage,
})

interface SaleItemRecord {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  product_barcode?: string
  quantity: number
  price_at_sale: number
  line_total: number
}

interface SaleRecord {
  id: string
  created_at: string
  status: 'completed' | 'refunded'
  payment_method: 'cash' | 'card'
  discount_percentage: number
  customer_notes?: string | null
  subtotal: number
  total_price: number
  fiscal_code?: string | null
  fiscalization_status?: string | null
  location: {
    id: string
    name: string
  }
  user: {
    id: string
    email: string
    role: string
  }
  sale_items: SaleItemRecord[]
}

interface LocationOption {
  id: string
  name: string
}

interface StockRecord {
  location_id: string
  location_name: string
  quantity: number
}

interface ProductOption {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  stocks: StockRecord[]
}

interface CartItem {
  product: ProductOption
  quantity: number
  price: number
}

function SalesPage() {
  const queryClient = useQueryClient()

  // Filters & Search
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false)
  const [viewingSale, setViewingSale] = useState<SaleRecord | null>(null)
  const [refundConfirmSale, setRefundConfirmSale] = useState<SaleRecord | null>(null)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Fetch Sales
  const { data: sales = [], isLoading: isLoadingSales } = useQuery<SaleRecord[]>({
    queryKey: ['sales', selectedLocation, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedLocation) params.append('location_id', selectedLocation)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      const res = await api.get(`/api/v1/sales?${params.toString()}`)
      return res.data
    },
  })

  // Fetch Locations
  const { data: locations = [] } = useQuery<LocationOption[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
  })

  // Fetch Products
  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/api/v1/products')
      return res.data
    },
  })

  // Refund Mutation
  const refundMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const res = await api.post(`/api/v1/sales/${saleId}/refund`)
      return res.data
    },
    onSuccess: (updatedSale: SaleRecord) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      showToast(`Sale #${updatedSale.id.slice(0, 8)} successfully refunded! Stock has been restored.`)
      setRefundConfirmSale(null)
      if (viewingSale?.id === updatedSale.id) {
        setViewingSale(updatedSale)
      }
    },
    onError: (err: unknown) => {
      let msg = 'Failed to process refund'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = Array.isArray(err.response.data.errors)
          ? err.response.data.errors.join(', ')
          : String(err.response.data.errors)
      }
      showToast(msg, 'error')
    },
  })

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const matchId = sale.id.toLowerCase().includes(q)
      const matchUser = sale.user.email.toLowerCase().includes(q)
      const matchNotes = sale.customer_notes?.toLowerCase().includes(q)
      const matchItem = sale.sale_items.some(
        (i) => i.product_name.toLowerCase().includes(q) || i.product_sku.toLowerCase().includes(q)
      )
      return matchId || matchUser || matchNotes || matchItem
    })
  }, [sales, searchQuery])

  // Summary Metrics
  const metrics = useMemo(() => {
    const completed = sales.filter((s) => s.status === 'completed')
    const refunded = sales.filter((s) => s.status === 'refunded')
    const totalRevenue = completed.reduce((sum, s) => sum + s.total_price, 0)
    return {
      totalSales: sales.length,
      completedCount: completed.length,
      refundedCount: refunded.length,
      totalRevenue,
    }
  }, [sales])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all transform animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header with Title and "New Sale" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Receipt className="w-6 h-6" />
            </div>
            Customer Sales & Orders
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Register in-store sales, auto-decrement inventory stock, and manage receipts
          </p>
        </div>

        <button
          onClick={() => setIsNewSaleOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Sale
        </button>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.totalSales}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Revenue</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">₴{metrics.totalRevenue.toFixed(2)}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Sales</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.completedCount}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refunded Orders</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.refundedCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Sales
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('refunded')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'refunded' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Refunded
          </button>
        </div>

        {/* Location Dropdown & Search Input */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID, user, note, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoadingSales ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading sales records...</div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No sales found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'Try adjusting your search criteria' : 'Click "New Sale" to register your first transaction'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Total (₴)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{sale.id.slice(0, 8)}
                      {sale.customer_notes && (
                        <span
                          className="ml-1.5 inline-block text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-sans font-medium"
                          title={sale.customer_notes}
                        >
                          Note
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(sale.created_at).toLocaleString('uk-UA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {sale.location.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{sale.user.email}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-semibold">
                      {sale.sale_items.reduce((sum, item) => sum + item.quantity, 0)} pcs
                      <span className="text-slate-400 font-normal ml-1">({sale.sale_items.length} types)</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium capitalize text-[11px] ${
                          sale.payment_method === 'card'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {sale.payment_method === 'card' ? (
                          <CreditCard className="w-3 h-3" />
                        ) : (
                          <Banknote className="w-3 h-3" />
                        )}
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">₴{sale.total_price.toFixed(2)}</div>
                      {sale.discount_percentage > 0 && (
                        <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" /> -{sale.discount_percentage}%
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                          sale.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {sale.status === 'completed' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <RotateCcw className="w-3 h-3 text-slate-500" />
                        )}
                        {sale.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingSale(sale)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Receipt
                        </button>
                        {sale.status === 'completed' && (
                          <button
                            onClick={() => setRefundConfirmSale(sale)}
                            className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Refund sale and restore inventory stock"
                          >
                            Refund
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

      {/* New Sale Modal (POS Flow) */}
      {isNewSaleOpen && (
        <NewSaleModal
          locations={locations}
          products={products}
          onClose={() => setIsNewSaleOpen(false)}
          onSuccess={(newSale) => {
            queryClient.invalidateQueries({ queryKey: ['sales'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setIsNewSaleOpen(false)
            showToast(`Sale #${newSale.id.slice(0, 8)} successfully completed!`)
            setViewingSale(newSale)
          }}
        />
      )}

      {/* Receipt Details & Dedicated Print Modal */}
      {viewingSale && (
        <ReceiptModal
          sale={viewingSale}
          onClose={() => setViewingSale(null)}
          onRefundClick={() => {
            setRefundConfirmSale(viewingSale)
          }}
        />
      )}

      {/* Refund Confirmation Modal */}
      {refundConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Refund Sale #{refundConfirmSale.id.slice(0, 8)}?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total amount: <strong>₴{refundConfirmSale.total_price.toFixed(2)}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              This action will mark the transaction as <strong>Refunded</strong> and automatically return all items back
              into inventory stock at <strong>{refundConfirmSale.location.name}</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundConfirmSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refundMutation.isPending}
                onClick={() => refundMutation.mutate(refundConfirmSale.id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {refundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * New Sale Modal / POS Flow Component
 */
function NewSaleModal({
  locations,
  products,
  onClose,
  onSuccess,
}: {
  locations: LocationOption[]
  products: ProductOption[]
  onClose: () => void
  onSuccess: (sale: SaleRecord) => void
}) {
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || '')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  const [customerNotes, setCustomerNotes] = useState<string>('')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Camera Barcode Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannerFeedback, setScannerFeedback] = useState<{ text: string; type: 'success' | 'warn' } | null>(null)

  // Get available stock for a product at chosen location
  const getAvailableStock = (product: ProductOption, locId: string) => {
    const stockRec = product.stocks?.find((s) => s.location_id === locId)
    return stockRec ? stockRec.quantity : 0
  }

  // Filter products for autocomplete
  const matchingProducts = useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products
      .filter((p) => {
        const matchTitle = p.name.toLowerCase().includes(q)
        const matchSku = p.sku.toLowerCase().includes(q)
        const matchBarcode = p.barcode?.toLowerCase().includes(q)
        return matchTitle || matchSku || matchBarcode
      })
      .slice(0, 8)
  }, [products, productSearch])

  // Add product to cart
  const addToCart = (product: ProductOption) => {
    setErrorBanner(null)
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product, quantity: 1, price: product.price }]
    })
    setProductSearch('')
  }

  // Continuous Camera Barcode Scan Handler
  const handleBarcodeScan = (barcode: string) => {
    const cleanCode = barcode.trim()
    const matched = products.find(
      (p) => p.barcode?.trim() === cleanCode || p.sku.toLowerCase() === cleanCode.toLowerCase()
    )

    if (matched) {
      addToCart(matched)
      setScannerFeedback({ text: `Added "${matched.name}" (Stock: ${getAvailableStock(matched, locationId)})`, type: 'success' })
    } else {
      setScannerFeedback({ text: `Barcode "${cleanCode}" not found in catalog`, type: 'warn' })
    }

    setTimeout(() => setScannerFeedback(null), 3000)
  }

  // Update quantity
  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId)
      return
    }
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item)))
  }

  // Update price (override discount per item)
  const updatePrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, price: Math.max(0, price) } : item))
    )
  }

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.price, 0)
  }, [cart])

  const discountAmount = useMemo(() => {
    const factor = Math.min(100, Math.max(0, discountPercentage)) / 100
    return subtotal * factor
  }, [subtotal, discountPercentage])

  const totalPayable = useMemo(() => {
    return Math.max(0, subtotal - discountAmount)
  }, [subtotal, discountAmount])

  // Check if any cart item exceeds available stock
  const stockErrors = useMemo(() => {
    const errors: string[] = []
    cart.forEach((item) => {
      const available = getAvailableStock(item.product, locationId)
      if (item.quantity > available) {
        errors.push(`${item.product.name}: requested ${item.quantity}, available ${available}`)
      }
    })
    return errors
  }, [cart, locationId])

  // Submit Sale
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!locationId) {
      setErrorBanner('Please select a store location')
      return
    }
    if (cart.length === 0) {
      setErrorBanner('Cart is empty. Please add products to complete the sale.')
      return
    }
    if (stockErrors.length > 0) {
      setErrorBanner(`Cannot proceed: ${stockErrors.join('; ')}`)
      return
    }

    setIsSubmitting(true)
    setErrorBanner(null)

    try {
      const payload = {
        sale: {
          location_id: locationId,
          payment_method: paymentMethod,
          discount_percentage: discountPercentage,
          customer_notes: customerNotes.trim() || null,
          sale_items_attributes: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_sale: item.price,
          })),
        },
      }

      const res = await api.post('/api/v1/sales', payload)
      onSuccess(res.data)
    } catch (err: unknown) {
      let msg = 'Failed to create sale'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = Array.isArray(err.response.data.errors)
          ? err.response.data.errors.join(', ')
          : String(err.response.data.errors)
      }
      setErrorBanner(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">New Sale / Register Order</h2>
              <p className="text-xs text-slate-500">Pick location, scan/add products, and collect payment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorBanner && (
            <div className="p-3 bg-red-50 text-red-800 text-xs font-medium rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Scanner Feedback Banner */}
          {scannerFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border animate-in fade-in ${
                scannerFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {scannerFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{scannerFeedback.text}</span>
            </div>
          )}

          {/* Location & Payment Method Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                required
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-purple-50 text-purple-700 border-purple-300 ring-2 ring-purple-500/20'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Card
                </button>
              </div>
            </div>
          </div>

          {/* Product Search & Camera Scanner Trigger */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Search Product or Scan Barcode</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Type name, SKU, or enter barcode..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                title="Scan physical barcodes continuously with camera"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Camera</span>
              </button>
            </div>

            {/* Dropdown Results */}
            {matchingProducts.length > 0 && (
              <div className="relative z-10">
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {matchingProducts.map((p) => {
                    const avail = getAvailableStock(p, locationId)
                    return (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="p-2.5 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-400">
                            SKU: {p.sku} {p.barcode ? `• Barcode: ${p.barcode}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              avail > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            Stock: {avail}
                          </span>
                          <span className="font-bold text-slate-900">₴{p.price.toFixed(2)}</span>
                          <button
                            type="button"
                            className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-medium hover:bg-blue-700"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Cart Items ({cart.length})</span>
              <span>Subtotal: ₴{subtotal.toFixed(2)}</span>
            </div>

            {cart.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No items added yet. Search or use the camera scanner above to add products.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {cart.map((item) => {
                  const available = getAvailableStock(item.product, locationId)
                  const isExceeded = item.quantity > available

                  return (
                    <div
                      key={item.product.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isExceeded ? 'bg-red-50/50' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          {item.product.name}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              available >= item.quantity
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            Stock: {available}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">SKU: {item.product.sku}</div>
                        {isExceeded && (
                          <div className="text-[11px] text-red-600 font-medium mt-0.5">
                            Exceeds available stock ({available})
                          </div>
                        )}
                      </div>

                      {/* Controls: Qty, Unit Price, Line Total, Delete */}
                      <div className="flex items-center gap-3">
                        {/* Quantity controls */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="px-2 py-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                            className="w-12 text-center text-xs font-semibold focus:outline-hidden py-1"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="px-2 py-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Price override */}
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">@ ₴</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg text-right font-medium focus:outline-hidden"
                            title="Price per unit (can be adjusted for discounts)"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-20 text-right font-bold text-slate-900">
                          ₴{(item.quantity * item.price).toFixed(2)}
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
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

          {/* Discount & Customer Notes Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {/* Order Percentage Discount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                Order Discount (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-20 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-center"
                />
                <div className="flex items-center gap-1">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercentage(pct)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        discountPercentage === pct
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Customer Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Customer Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. VIP Customer, Phone +38050..., special delivery"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Grand Total Breakdown & Footer */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Subtotal: ₴{subtotal.toFixed(2)}</span>
                {discountPercentage > 0 && (
                  <span className="text-emerald-400 font-semibold">
                    Discount ({discountPercentage}%): -₴{discountAmount.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="text-2xl font-black text-white">
                Total Payable: <span className="text-emerald-400">₴{totalPayable.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || cart.length === 0 || stockErrors.length > 0}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Continuous Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          continuous={true}
          title="Scan Product Barcodes (Continuous)"
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScan}
        />
      )}
    </div>
  )
}

/**
 * Receipt Details & Dedicated Printing Modal (80mm Thermal Slip & A4 Invoice)
 */
function ReceiptModal({
  sale,
  onClose,
  onRefundClick,
}: {
  sale: SaleRecord
  onClose: () => void
  onRefundClick: () => void
}) {
  const [printFormat, setPrintFormat] = useState<'thermal80' | 'a4'>('thermal80')

  const handlePrint = () => {
    window.print()
  }

  const discountAmount = useMemo(() => {
    if (!sale.discount_percentage || sale.discount_percentage <= 0) return 0
    return sale.subtotal * (sale.discount_percentage / 100)
  }, [sale])

  return (
    <>
      {/* Screen Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 text-center border-b border-dashed border-slate-200 bg-slate-50/50 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Receipt className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Products Tracker UA</h2>
            <p className="text-xs text-slate-500 font-mono">Sale #{sale.id.slice(0, 8)}</p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                  sale.status === 'completed'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-slate-700 bg-slate-100 border-slate-200'
                }`}
              >
                {sale.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                )}
                {sale.status}
              </span>

              {sale.discount_percentage > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200">
                  <Tag className="w-3 h-3" /> -{sale.discount_percentage}% Discount
                </span>
              )}
            </div>
          </div>

          {/* Receipt Metadata */}
          <div className="px-6 py-4 text-xs space-y-2 border-b border-dashed border-slate-200 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Date & Time:
              </span>
              <span className="font-medium text-slate-900">
                {new Date(sale.created_at).toLocaleString('uk-UA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Store Location:
              </span>
              <span className="font-semibold text-slate-900">{sale.location.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5" /> Cashier:
              </span>
              <span className="text-slate-900 font-medium">{sale.user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                {sale.payment_method === 'card' ? (
                  <CreditCard className="w-3.5 h-3.5" />
                ) : (
                  <Banknote className="w-3.5 h-3.5" />
                )}{' '}
                Payment Method:
              </span>
              <span className="font-semibold text-slate-900 uppercase">{sale.payment_method}</span>
            </div>
            {sale.customer_notes && (
              <div className="pt-2 border-t border-slate-100 flex items-start gap-1 text-slate-700">
                <FileText className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <span className="italic">Note: {sale.customer_notes}</span>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="px-6 py-4 flex-1 overflow-y-auto max-h-56 text-xs">
            <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-2">Purchased Items</div>
            <div className="divide-y divide-slate-100">
              {sale.sale_items.map((item) => (
                <div key={item.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{item.product_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      SKU: {item.product_sku} • {item.quantity} × ₴{item.price_at_sale.toFixed(2)}
                    </div>
                  </div>
                  <div className="font-bold text-slate-900">₴{item.line_total.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Print Format Selector & Actions */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
            {/* Totals Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>₴{sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount_percentage > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount ({sale.discount_percentage}%)</span>
                  <span>-₴{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-xl">₴{sale.total_price.toFixed(2)}</span>
              </div>
            </div>

            {/* Format toggle: 80mm vs A4 */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-600">Print Format:</span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setPrintFormat('thermal80')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    printFormat === 'thermal80'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  80mm Thermal Roll
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('a4')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    printFormat === 'a4'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A4 Invoice
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>

              <div className="flex items-center gap-2">
                {sale.status === 'completed' && (
                  <button
                    type="button"
                    onClick={onRefundClick}
                    className="px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Refund Order
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Clean Print Portal Component */}
      <DedicatedPrintReceipt
        sale={sale}
        format={printFormat}
        discountAmount={discountAmount}
      />
    </>
  )
}

/**
 * Dedicated Print Component rendered via Portal to document.body
 * Hides all web layout and prints only the clean paper receipt
 */
function DedicatedPrintReceipt({
  sale,
  format,
  discountAmount,
}: {
  sale: SaleRecord
  format: 'thermal80' | 'a4'
  discountAmount: number
}) {
  const portalNode = typeof document !== 'undefined' ? document.body : null
  if (!portalNode) return null

  return createPortal(
    <div id="receipt-print-portal" className="hidden">
      <style>{`
        @media screen {
          #receipt-print-portal {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #root {
            display: none !important;
          }
          #receipt-print-portal,
          #receipt-print-portal * {
            visibility: visible !important;
          }
          #receipt-print-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          ${
            format === 'thermal80'
              ? `@page { size: 80mm auto; margin: 0; }`
              : `@page { size: A4 portrait; margin: 15mm; }`
          }
        }
      `}</style>

      {format === 'thermal80' ? (
        /* 80mm POS Thermal Slip Layout */
        <div
          style={{
            width: '74mm',
            margin: '0 auto',
            padding: '5mm 3mm',
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: '1.3',
            color: '#000',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>PRODUCTS TRACKER UA</div>
            <div style={{ fontSize: '10px' }}>{sale.location.name}</div>
            <div style={{ fontSize: '10px', marginTop: '2px' }}>
              {new Date(sale.created_at).toLocaleString('uk-UA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div style={{ fontSize: '10px' }}>Receipt #: {sale.id.slice(0, 8).toUpperCase()}</div>
            <div style={{ fontSize: '10px' }}>Cashier: {sale.user.email}</div>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Table of items */}
          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                <th style={{ paddingBottom: '3px' }}>Item / SKU</th>
                <th style={{ textAlign: 'center', paddingBottom: '3px' }}>Qty</th>
                <th style={{ textAlign: 'right', paddingBottom: '3px' }}>Price</th>
                <th style={{ textAlign: 'right', paddingBottom: '3px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.sale_items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 'bold' }}>{item.product_name}</div>
                    <div style={{ fontSize: '9px', color: '#444' }}>SKU: {item.product_sku}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px 0', verticalAlign: 'top' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '4px 0', verticalAlign: 'top' }}>
                    ₴{item.price_at_sale.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 'bold', verticalAlign: 'top' }}>
                    ₴{item.line_total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Totals */}
          <div style={{ fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>₴{sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discount_percentage > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#222' }}>
                <span>Discount ({sale.discount_percentage}%):</span>
                <span>-₴{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 'bold',
                marginTop: '4px',
                borderTop: '1px solid #000',
                paddingTop: '4px',
              }}
            >
              <span>TOTAL PAYABLE:</span>
              <span>₴{sale.total_price.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '2px' }}>
              <span>Payment:</span>
              <span style={{ textTransform: 'uppercase' }}>{sale.payment_method}</span>
            </div>
          </div>

          {sale.customer_notes && (
            <div
              style={{
                marginTop: '6px',
                padding: '4px',
                border: '1px dotted #666',
                fontSize: '9px',
                fontStyle: 'italic',
              }}
            >
              Note: {sale.customer_notes}
            </div>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>
            <div>ДЯКУЄМО ЗА ПОКУПКУ!</div>
            <div>THANK YOU FOR YOUR PURCHASE!</div>
            <div style={{ fontSize: '8px', color: '#666', marginTop: '4px' }}>
              FISCAL STATUS: {sale.fiscal_code ? sale.fiscal_code : 'IN-STORE TRANSACTION'}
            </div>
          </div>
        </div>
      ) : (
        /* A4 Full Page Invoice Layout */
        <div
          style={{
            width: '180mm',
            margin: '0 auto',
            padding: '10mm',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '12px',
            lineHeight: '1.4',
            color: '#111',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '2px solid #2563eb',
              paddingBottom: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#1e3a8a' }}>
                PRODUCTS TRACKER UA
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '11px' }}>
                Official Sales Receipt & Invoice
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Receipt #{sale.id.slice(0, 8).toUpperCase()}</div>
              <div style={{ color: '#4b5563', fontSize: '11px' }}>
                Date:{' '}
                {new Date(sale.created_at).toLocaleString('uk-UA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Store Location
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{sale.location.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Transaction Info
              </div>
              <div>Cashier: {sale.user.email}</div>
              <div>Payment Method: {sale.payment_method.toUpperCase()}</div>
              {sale.customer_notes && (
                <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#1f2937' }}>
                  Customer Note: {sale.customer_notes}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', fontSize: '11px', color: '#4b5563' }}>Product</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', color: '#4b5563' }}>SKU</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', color: '#4b5563', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', color: '#4b5563', textAlign: 'right' }}>
                  Unit Price
                </th>
                <th style={{ padding: '8px 10px', fontSize: '11px', color: '#4b5563', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.sale_items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{item.product_name}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6b7280' }}>
                    {item.product_sku}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>₴{item.price_at_sale.toFixed(2)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                    ₴{item.line_total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Box */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <div style={{ width: '220px', borderTop: '2px solid #e5e7eb', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: '#4b5563' }}>Subtotal:</span>
                <span style={{ fontWeight: 'bold' }}>₴{sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount_percentage > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#059669' }}>
                  <span>Discount ({sale.discount_percentage}%):</span>
                  <span>-₴{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  borderTop: '2px solid #111',
                  marginTop: '4px',
                }}
              >
                <span>Total Amount:</span>
                <span style={{ color: '#2563eb' }}>₴{sale.total_price.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* A4 Footer */}
          <div
            style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: '16px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '10px',
            }}
          >
            Thank you for shopping with Products Tracker UA! • Customer Support: support@productstracker.ua
          </div>
        </div>
      )}
    </div>,
    portalNode
  )
}
