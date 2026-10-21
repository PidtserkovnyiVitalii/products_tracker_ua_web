import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, type FormEvent } from 'react'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import {
  Package,
  Plus,
  Search,
  FolderTree,
  MapPin,
  Edit3,
  Trash2,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  X,
  SlidersHorizontal,
  Layers,
  Barcode,
} from 'lucide-react'

export const Route = createFileRoute('/products')({
  validateSearch: (search: Record<string, unknown>): { location_id?: string } => ({
    location_id: (search.location_id as string) || undefined,
  }),
  component: ProductsPage,
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
  created_at: string
}

interface CategoryOption {
  id: string
  name: string
}

interface LocationOption {
  id: string
  name: string
}

function ProductModal({
  product,
  categories,
  onClose,
  onSubmit,
  isPending,
  errorMsg,
}: {
  product?: ProductRecord | null
  categories: CategoryOption[]
  onClose: () => void
  onSubmit: (data: {
    name: string
    sku: string
    barcode?: string
    description?: string
    category_id?: string
  }) => void
  isPending: boolean
  errorMsg: string | null
}) {
  const [name, setName] = useState(product?.name || '')
  const [sku, setSku] = useState(product?.sku || '')
  const [barcode, setBarcode] = useState(product?.barcode || '')
  const [description, setDescription] = useState(product?.description || '')
  const [categoryId, setCategoryId] = useState(product?.category_id || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !sku.trim()) return
    onSubmit({
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      description: description.trim() || undefined,
      category_id: categoryId || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {product ? 'Edit Product' : 'New Product'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {product ? 'Update product details in catalog' : 'Register a new item in the catalog'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Product Name *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Конструктор LEGO City 60316"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                SKU (Unique Code) *
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. SKU-LEGO-60316"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Barcode (EAN/UPC)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 5702017161914"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            >
              <option value="">-- No Category --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description and details..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim() || !sku.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? 'Saving...' : product ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdjustStockModal({
  product,
  locations,
  onClose,
  onSubmit,
  isPending,
  errorMsg,
}: {
  product: ProductRecord
  locations: LocationOption[]
  onClose: () => void
  onSubmit: (data: { location_id: string; quantity: number }) => void
  isPending: boolean
  errorMsg: string | null
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id || '')
  const [quantity, setQuantity] = useState<number>(() => {
    const existing = product.stocks.find((s) => s.location_id === locations[0]?.id)
    return existing ? existing.quantity : 0
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleLocationChange = (locId: string) => {
    setLocationId(locId)
    const existing = product.stocks.find((s) => s.location_id === locId)
    setQuantity(existing ? existing.quantity : 0)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!locationId) return
    onSubmit({ location_id: locationId, quantity: Math.max(0, quantity) })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Adjust Stock</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Select Store or Warehouse
            </label>
            <select
              value={locationId}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            >
              {locations.map((loc) => {
                const stock = product.stocks.find((s) => s.location_id === loc.id)
                return (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} (Current: {stock ? stock.quantity : 0})
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              New Inventory Quantity
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(0, prev - 1))}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                className="flex-1 text-center py-2.5 rounded-xl border border-slate-200 text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setQuantity((prev) => prev + 1)}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? 'Updating...' : 'Set Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProductsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const { location_id: searchLocationId } = Route.useSearch()
  const navigate = useNavigate({ from: '/products' })

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const selectedLocation = searchLocationId || ''
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null)
  const [stockAdjustProduct, setStockAdjustProduct] = useState<ProductRecord | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleLocationChange = (locId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        location_id: locId || undefined,
      }),
    })
  }

  const canManage = user?.role === 'admin' || user?.role === 'stockkeeper'

  // Fetch Products
  const { data: products = [], isLoading, error } = useQuery<ProductRecord[]>({
    queryKey: ['products', searchQuery, selectedCategory, selectedLocation],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (searchQuery.trim()) params.query = searchQuery.trim()
      if (selectedCategory) params.category_id = selectedCategory
      if (selectedLocation) params.location_id = selectedLocation
      const res = await api.get('/api/v1/products', { params })
      return res.data
    },
    enabled: !!token,
  })

  // Fetch Categories for dropdown filter
  const { data: categories = [] } = useQuery<CategoryOption[]>({
    queryKey: ['categories', 'flat'],
    queryFn: async () => {
      const res = await api.get('/api/v1/categories')
      return res.data
    },
    enabled: !!token,
  })

  // Fetch Locations for stock adjustment modal
  const { data: locations = [] } = useQuery<LocationOption[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
    enabled: !!token,
  })

  const productMutation = useMutation({
    mutationFn: async (data: {
      name: string
      sku: string
      barcode?: string
      description?: string
      category_id?: string
    }) => {
      if (editingProduct) {
        const res = await api.put(`/api/v1/products/${editingProduct.id}`, { product: data })
        return res.data
      } else {
        const res = await api.post('/api/v1/products', { product: data })
        return res.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setIsProductModalOpen(false)
      setEditingProduct(null)
      setModalError(null)
      setSuccessMsg(editingProduct ? 'Product updated successfully!' : 'Product created successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to save product'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setModalError(msg)
    },
  })

  const stockMutation = useMutation({
    mutationFn: async (data: { location_id: string; quantity: number }) => {
      if (!stockAdjustProduct) return
      const res = await api.post('/api/v1/stocks/adjust', {
        product_id: stockAdjustProduct.id,
        location_id: data.location_id,
        quantity: data.quantity,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setStockAdjustProduct(null)
      setModalError(null)
      setSuccessMsg('Stock updated successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to adjust stock'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setModalError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/products/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSuccessMsg('Product archived.')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to delete product'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      alert(msg)
    },
  })

  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">You must sign in to view products and inventory.</p>
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
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Products & Inventory</h1>
            <p className="text-sm text-slate-500">Catalog items and real-time stock across locations</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setEditingProduct(null)
              setModalError(null)
              setIsProductModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Product
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search, Category & Location Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 mb-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="relative w-full md:w-56">
          <FolderTree className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full md:w-56">
          <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedLocation}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-slate-700"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedLocation && (
        <div className="flex items-center justify-between mb-4 px-4 py-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              Showing products stocked at <strong className="font-semibold">{locations.find((l) => l.id === selectedLocation)?.name || 'Selected Location'}</strong>
            </span>
          </div>
          <button
            onClick={() => handleLocationChange('')}
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filter
          </button>
        </div>
      )}

      {/* Products List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading catalog...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
          Failed to load products. Please check connection.
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-700">No products found</h3>
          <p className="text-sm text-slate-500 mt-1">
            {selectedLocation
              ? 'No products with inventory at this location. Try clearing the location filter.'
              : 'Try adjusting your search or category filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((item) => {
            const hasStock = item.total_stock > 0
            const locationStockItem = selectedLocation
              ? item.stocks.find((st) => st.location_id === selectedLocation)
              : null
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-start justify-between gap-6"
              >
                {/* Product Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                    {item.category && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                        {item.category.name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500">
                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      SKU: {item.sku}
                    </span>
                    {item.barcode && (
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        {item.barcode}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">{item.description}</p>
                  )}

                  {/* Stock Breakdown per Location */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Stock per Location:
                    </div>
                    {item.stocks.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">No stock recorded yet</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {item.stocks.map((st) => {
                          const isCurrentLocation = selectedLocation === st.location_id
                          return (
                            <div
                              key={st.location_id}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                                isCurrentLocation
                                  ? 'border-blue-400 bg-blue-50/80 text-blue-900 font-semibold ring-1 ring-blue-300'
                                  : 'border-slate-200 bg-slate-50/70 text-slate-700'
                              }`}
                            >
                              <MapPin
                                className={`w-3 h-3 ${isCurrentLocation ? 'text-blue-600' : 'text-slate-400'}`}
                              />
                              <span className="font-medium">{st.location_name}:</span>
                              <span className="font-bold">{st.quantity}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Total Stock Badge & Actions */}
                <div className="flex md:flex-col items-end justify-between md:justify-start gap-4">
                  <div className="text-right">
                    {locationStockItem ? (
                      <>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                          Location Units
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 justify-end">
                          <span className="text-2xl font-black text-blue-700">
                            {locationStockItem.quantity}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            (Total: {item.total_stock})
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Total Units
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-2xl font-black ${
                              hasStock ? 'text-slate-900' : 'text-red-500'
                            }`}
                          >
                            {item.total_stock}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              hasStock
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {hasStock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setStockAdjustProduct(item)
                          setModalError(null)
                        }}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        title="Adjust inventory"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Stock
                      </button>
                      <button
                        onClick={() => {
                          setEditingProduct(item)
                          setModalError(null)
                          setIsProductModalOpen(true)
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        title="Edit product"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Archive product "${item.name}"?`)) {
                            deleteMutation.mutate(item.id)
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Archive product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal for Creating or Editing Product */}
      {isProductModalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setIsProductModalOpen(false)
            setEditingProduct(null)
          }}
          onSubmit={(data) => productMutation.mutate(data)}
          isPending={productMutation.isPending}
          errorMsg={modalError}
        />
      )}

      {/* Modal for Adjusting Location Stock */}
      {stockAdjustProduct && (
        <AdjustStockModal
          product={stockAdjustProduct}
          locations={locations}
          onClose={() => setStockAdjustProduct(null)}
          onSubmit={(data) => stockMutation.mutate(data)}
          isPending={stockMutation.isPending}
          errorMsg={modalError}
        />
      )}
    </div>
  )
}
