import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import {
  ScanBarcode,
  MapPin,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Layers,
  Barcode as BarcodeIcon,
  RotateCcw,
} from 'lucide-react'

export const Route = createFileRoute('/scan')({
  component: ScanPage,
})

interface StockRecord {
  id?: string
  location_id: string
  location_name: string
  quantity: number
}

interface ProductRecord {
  id: string
  name: string
  sku: string
  barcode?: string
  description?: string
  category_id?: string
  category?: {
    id: string
    name: string
    slug: string
  }
  total_stock: number
  stocks: StockRecord[]
}

interface LocationOption {
  id: string
  name: string
}

function ScanPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)

  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [activeBarcode, setActiveBarcode] = useState<string>('')
  const [recentBarcodes, setRecentBarcodes] = useState<string[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canManage = user?.role === 'admin' || user?.role === 'stockkeeper'

  // Fetch Locations
  const { data: locations = [] } = useQuery<LocationOption[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
    enabled: !!token,
  })

  // Default selected location to first location if not set
  const activeLocationId = selectedLocationId || locations[0]?.id || ''

  // Fetch Product by Barcode
  const {
    data: matchedProducts = [],
    isLoading: isSearching,
    isFetched,
  } = useQuery<ProductRecord[]>({
    queryKey: ['products', 'barcode', activeBarcode],
    queryFn: async () => {
      if (!activeBarcode) return []
      const res = await api.get('/api/v1/products', {
        params: { query: activeBarcode },
      })
      return res.data
    },
    enabled: !!token && !!activeBarcode,
  })

  // Exact match by barcode or first query match
  const matchedProduct = matchedProducts.find(
    (p) => p.barcode?.toLowerCase() === activeBarcode.toLowerCase()
  ) || matchedProducts[0]

  // Mutation to adjust stock directly from scan view
  const adjustStockMutation = useMutation({
    mutationFn: async ({
      productId,
      locationId,
      quantity,
    }: {
      productId: string
      locationId: string
      quantity: number
    }) => {
      const res = await api.post('/api/v1/stocks/adjust', {
        product_id: productId,
        location_id: locationId,
        quantity,
      })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setFeedbackMsg({
        type: 'success',
        text: `Stock updated to ${data.quantity} units!`,
      })
      setTimeout(() => setFeedbackMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to adjust stock'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setFeedbackMsg({ type: 'error', text: msg })
    },
  })

  const handleBarcodeScanned = (barcode: string) => {
    setActiveBarcode(barcode)
    setRecentBarcodes((prev) => [barcode, ...prev.filter((b) => b !== barcode)].slice(0, 5))
  }

  const handleStockDelta = (delta: number) => {
    if (!matchedProduct || !activeLocationId) return
    const currentQty =
      matchedProduct.stocks.find((s) => s.location_id === activeLocationId)?.quantity ?? 0
    const newQty = Math.max(0, currentQty + delta)
    adjustStockMutation.mutate({
      productId: matchedProduct.id,
      locationId: activeLocationId,
      quantity: newQty,
    })
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">You must sign in to use the barcode scanner.</p>
        <Link
          to="/login"
          className="inline-flex py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm"
        >
          Sign In Now
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md">
            <ScanBarcode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mobile Barcode Scanner</h1>
            <p className="text-xs text-slate-500">Scan product barcodes with your phone camera</p>
          </div>
        </div>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-2xl shadow-md transition-all cursor-pointer"
        >
          <ScanBarcode className="w-4 h-4" />
          <span>Launch Camera</span>
        </button>
      </div>

      {feedbackMsg && (
        <div
          className={`mb-4 p-3.5 rounded-2xl border text-sm flex items-center gap-2.5 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Primary Scanner Action Card */}
      {!activeBarcode ? (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 mb-6 shadow-xl text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center mb-4 ring-8 ring-blue-500/10">
            <ScanBarcode className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Ready to Scan Barcode</h2>
          <p className="text-slate-300 text-xs max-w-sm mx-auto mb-6">
            Tap the button below to turn on your phone camera and point it at any toy or retail product barcode.
          </p>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-2xl shadow-lg transition-transform active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <ScanBarcode className="w-5 h-5" />
            <span>Open Camera Scanner</span>
          </button>
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          {/* Active Barcode Banner */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BarcodeIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Scanned Barcode
                </span>
                <span className="text-base font-mono font-bold text-slate-800">
                  {activeBarcode}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ScanBarcode className="w-3.5 h-3.5" />
                <span>Scan Next</span>
              </button>
              <button
                onClick={() => setActiveBarcode('')}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Clear barcode"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Result */}
          {isSearching ? (
            <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">Looking up product in database...</p>
            </div>
          ) : matchedProduct ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              {/* Product Info */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold inline-block mb-1.5">
                      {matchedProduct.category?.name || 'Uncategorized'}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">{matchedProduct.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block">Total Units</span>
                    <span className="text-2xl font-black text-slate-900">{matchedProduct.total_stock}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs font-mono text-slate-500">
                  <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    SKU: {matchedProduct.sku}
                  </span>
                  {matchedProduct.barcode && (
                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <BarcodeIcon className="w-3.5 h-3.5 text-slate-400" />
                      {matchedProduct.barcode}
                    </span>
                  )}
                </div>

                {matchedProduct.description && (
                  <p className="text-xs text-slate-600 mt-2">{matchedProduct.description}</p>
                )}
              </div>

              {/* Stock per Location */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Stock Breakdown
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {matchedProduct.stocks.map((st) => (
                    <div
                      key={st.location_id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        st.location_id === activeLocationId
                          ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-300'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">{st.location_name}</span>
                      </div>
                      <span className="font-bold text-slate-900 ml-2">{st.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stock Adjuster for Stockkeeper/Admin */}
              {canManage && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Quick Stock Adjustment</span>
                    <select
                      value={activeLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="text-xs py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={adjustStockMutation.isPending}
                      onClick={() => handleStockDelta(-1)}
                      className="flex-1 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-1 text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4 text-red-500" />
                      <span>-1 Unit</span>
                    </button>

                    <button
                      type="button"
                      disabled={adjustStockMutation.isPending}
                      onClick={() => handleStockDelta(1)}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+1 Unit</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Link
                  to="/products"
                  search={{ query: matchedProduct.barcode || matchedProduct.name }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>Open in Products Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ScanBarcode className="w-3.5 h-3.5" />
                  <span>Scan Next</span>
                </button>
              </div>
            </div>
          ) : isFetched ? (
            <div className="p-8 bg-white border border-dashed border-slate-300 rounded-3xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Product Not Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No product registered with barcode <strong className="font-mono">{activeBarcode}</strong>.
                </p>
              </div>

              {canManage && (
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New Product</span>
                </Link>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Recent Scans Strip */}
      {recentBarcodes.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Recently Scanned
          </span>
          <div className="flex flex-wrap gap-2">
            {recentBarcodes.map((b) => (
              <button
                key={b}
                onClick={() => setActiveBarcode(b)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                  activeBarcode === b
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan Toy Barcode"
      />
    </div>
  )
}
