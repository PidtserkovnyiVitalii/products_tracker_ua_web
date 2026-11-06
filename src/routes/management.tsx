import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, type FormEvent } from 'react'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import {
  FolderTree,
  MapPin,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  X,
  Edit3,
  Package,
  Warehouse,
  Store,
  ArrowRight,
  Settings2,
  Truck,
  Phone,
  FileText,
} from 'lucide-react'

export const Route = createFileRoute('/management')({
  validateSearch: (
    search: Record<string, unknown>
  ): { tab?: 'categories' | 'locations' | 'suppliers' } => ({
    tab: (search.tab as 'categories' | 'locations' | 'suppliers') || 'categories',
  }),
  component: ManagementPage,
})

/* =========================================================================
   Categories Manager Subcomponents & Logic
   ========================================================================= */

interface CategoryNode {
  id: string
  name: string
  slug: string
  parent_id: string | null
  created_at: string
  children: CategoryNode[]
}

function CategoryItem({
  node,
  canManage,
  onDelete,
  onAddChild,
  onEdit,
}: {
  node: CategoryNode
  canManage: boolean
  onDelete: (id: string) => void
  onAddChild: (parent: CategoryNode) => void
  onEdit: (category: CategoryNode) => void
}) {
  const [isOpen, setIsOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="border border-slate-200/80 bg-white rounded-xl shadow-xs mb-2 overflow-hidden">
      <div className="flex items-center justify-between p-3.5 hover:bg-slate-50/70 transition-colors">
        <div className="flex items-center gap-2.5">
          {hasChildren ? (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 hover:bg-slate-200/70 rounded-md text-slate-500 cursor-pointer"
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <div
            onClick={() => canManage && onEdit(node)}
            className={`flex items-center gap-2 ${canManage ? 'cursor-pointer group' : ''}`}
            title={canManage ? 'Click to edit category' : undefined}
          >
            <span className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
              {node.name}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
              {node.slug}
            </span>
            {canManage && (
              <Edit3 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/products"
            search={{ category_id: node.id }}
            className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 bg-slate-100 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">View Products</span>
          </Link>

          {canManage && (
            <>
              <button
                onClick={() => onAddChild(node)}
                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Add Subcategory"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Subcategory</span>
              </button>
              <button
                onClick={() => onDelete(node.id)}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Delete Category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="pl-6 pr-3.5 pb-2 border-t border-slate-100 bg-slate-50/40">
          <div className="pt-2">
            {node.children.map((child) => (
              <CategoryItem
                key={child.id}
                node={child}
                canManage={canManage}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryModal({
  parent,
  onClose,
  onSubmit,
  isPending,
  errorMsg,
}: {
  parent?: CategoryNode | null
  onClose: () => void
  onSubmit: (name: string) => void
  isPending: boolean
  errorMsg: string | null
}) {
  const [name, setName] = useState('')
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
    if (!name.trim()) return
    onSubmit(name.trim())
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {parent ? `Add Subcategory to "${parent.name}"` : 'New Root Category'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Action Figures, Board Games..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditCategoryModal({
  category,
  onClose,
  onSubmit,
  isPending,
  errorMsg,
}: {
  category: CategoryNode
  onClose: () => void
  onSubmit: (data: { name: string; slug: string }) => void
  isPending: boolean
  errorMsg: string | null
}) {
  const [name, setName] = useState(category.name)
  const [slug, setSlug] = useState(category.slug)
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
    if (!name.trim() || !slug.trim()) return
    onSubmit({ name: name.trim(), slug: slug.trim() })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Edit Category</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono text-slate-600"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim() || !slug.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CategoriesManager({ canManage, token }: { canManage: boolean; token: string | null }) {
  const queryClient = useQueryClient()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [modalParent, setModalParent] = useState<CategoryNode | null>(null)
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { data: categories = [], isLoading, error } = useQuery<CategoryNode[]>({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const res = await api.get('/api/v1/categories?tree=true')
      return res.data
    },
    enabled: !!token,
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; parent_id?: string | null }) => {
      const res = await api.post('/api/v1/categories', { category: data })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsAddModalOpen(false)
      setModalParent(null)
      setModalError(null)
      setSuccessMsg('Category created successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to create category'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setModalError(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; slug: string } }) => {
      const res = await api.put(`/api/v1/categories/${id}`, { category: data })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setEditingCategory(null)
      setModalError(null)
      setSuccessMsg('Category updated successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to update category'
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
      await api.delete(`/api/v1/categories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setSuccessMsg('Category deleted.')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: () => {
      alert('Failed to delete category.')
    },
  })

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this category? Subcategories will be moved to root.')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Taxonomy Tree</h2>
          <p className="text-xs text-slate-500">Configure product hierarchy and subcategories</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setModalParent(null)
              setModalError(null)
              setIsAddModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Root Category
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading categories...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">
          Failed to load category taxonomy.
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
          <FolderTree className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">No categories yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Create your first root category to start organizing products.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((node) => (
            <CategoryItem
              key={node.id}
              node={node}
              canManage={canManage}
              onDelete={handleDelete}
              onAddChild={(parent) => {
                setModalParent(parent)
                setModalError(null)
                setIsAddModalOpen(true)
              }}
              onEdit={(cat) => {
                setEditingCategory(cat)
                setModalError(null)
              }}
            />
          ))}
        </div>
      )}

      {isAddModalOpen && (
        <CategoryModal
          parent={modalParent}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={(name) => createMutation.mutate({ name, parent_id: modalParent?.id })}
          isPending={createMutation.isPending}
          errorMsg={modalError}
        />
      )}

      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingCategory.id, data })}
          isPending={updateMutation.isPending}
          errorMsg={modalError}
        />
      )}
    </div>
  )
}

/* =========================================================================
   Locations Manager Subcomponents & Logic
   ========================================================================= */

interface LocationRecord {
  id: string
  name: string
  address: string
  location_type?: string
}

function LocationModal({
  location,
  onClose,
  onSubmit,
  isPending,
  errorMsg,
}: {
  location?: LocationRecord | null
  onClose: () => void
  onSubmit: (data: { name: string; address: string; location_type: string }) => void
  isPending: boolean
  errorMsg: string | null
}) {
  const [name, setName] = useState(location?.name || '')
  const [address, setAddress] = useState(location?.address || '')
  const [locationType, setLocationType] = useState(location?.location_type || 'store')
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
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      address: address.trim(),
      location_type: locationType,
    })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {location ? 'Edit Location' : 'New Location'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Location Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Central Store, Kyiv Warehouse"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Physical Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Khreshchatyk St, 1, Kyiv"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Type
            </label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="store">Retail Store</option>
              <option value="warehouse">Warehouse</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? 'Saving...' : location ? 'Save Changes' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LocationsManager({ canManage, token }: { canManage: boolean; token: string | null }) {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationRecord | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { data: locations = [], isLoading, error } = useQuery<LocationRecord[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
    enabled: !!token,
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; address: string; location_type: string }) => {
      const res = await api.post('/locations', { location: data })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setIsModalOpen(false)
      setModalError(null)
      setSuccessMsg('Location created successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to create location'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setModalError(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; address: string; location_type: string } }) => {
      const res = await api.put(`/locations/${id}`, { location: data })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setEditingLocation(null)
      setModalError(null)
      setSuccessMsg('Location updated successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to update location'
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
      await api.delete(`/locations/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setSuccessMsg('Location deleted.')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: () => {
      alert('Failed to delete location.')
    },
  })

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? Stock records linked to this location may be affected.`)) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Physical Stores & Warehouses</h2>
          <p className="text-xs text-slate-500">Retail storefronts and warehouse distribution points across Ukraine</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingLocation(null)
              setModalError(null)
              setIsModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading locations...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">
          Failed to load locations.
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">No locations registered</h3>
          <p className="text-xs text-slate-500 mt-1">
            Add your retail store or warehouse to start tracking inventory.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => {
            const isWarehouse = loc.location_type === 'warehouse'
            return (
              <div
                key={loc.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isWarehouse ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {isWarehouse ? <Warehouse className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {isWarehouse ? 'Warehouse' : 'Store'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-1">{loc.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-4">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    <span>{loc.address || 'No physical address specified'}</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to="/products"
                    search={{ location_id: loc.id }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
                  >
                    <span>View Stock</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingLocation(loc)
                          setModalError(null)
                          setIsModalOpen(true)
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Location"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id, loc.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Location"
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

      {isModalOpen && (
        <LocationModal
          location={editingLocation}
          onClose={() => {
            setIsModalOpen(false)
            setEditingLocation(null)
          }}
          onSubmit={(data) => {
            if (editingLocation) {
              updateMutation.mutate({ id: editingLocation.id, data })
            } else {
              createMutation.mutate(data)
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
          errorMsg={modalError}
        />
      )}
    </div>
  )
}

/* =========================================================================
   Suppliers Manager Subcomponents & Logic
   ========================================================================= */

interface SupplierRecord {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  notes?: string | null
  supplies_count?: number
  created_at?: string
}

function SupplierModal({
  supplier,
  onClose,
  onSubmit,
  isPending,
  errorMsg,
}: {
  supplier?: SupplierRecord | null
  onClose: () => void
  onSubmit: (data: { name: string; phone: string; address: string; notes: string }) => void
  isPending: boolean
  errorMsg: string | null
}) {
  const [name, setName] = useState(supplier?.name || '')
  const [phone, setPhone] = useState(supplier?.phone || '')
  const [address, setAddress] = useState(supplier?.address || '')
  const [notes, setNotes] = useState(supplier?.notes || '')
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
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {supplier ? 'Edit Supplier' : 'New Supplier'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. ТОВ "Кідс Імпорт Україна"'
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Phone Number (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +380 44 234 5678"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Address (Optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. вул. Промислова, 14, Київ"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery schedule, payment terms, contact person..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? 'Saving...' : supplier ? 'Save Changes' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SuppliersManager({ canManage, token }: { canManage: boolean; token: string | null }) {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { data: suppliers = [], isLoading, error } = useQuery<SupplierRecord[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/api/v1/suppliers')
      return res.data
    },
    enabled: !!token,
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; address: string; notes: string }) => {
      const res = await api.post('/api/v1/suppliers', { supplier: data })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setIsModalOpen(false)
      setModalError(null)
      setSuccessMsg('Supplier created successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to create supplier'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg =
          typeof err.response.data.errors === 'string'
            ? err.response.data.errors
            : JSON.stringify(err.response.data.errors)
      }
      setModalError(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { name: string; phone: string; address: string; notes: string }
    }) => {
      const res = await api.put(`/api/v1/suppliers/${id}`, { supplier: data })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setIsModalOpen(false)
      setEditingSupplier(null)
      setModalError(null)
      setSuccessMsg('Supplier updated successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to update supplier'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg =
          typeof err.response.data.errors === 'string'
            ? err.response.data.errors
            : JSON.stringify(err.response.data.errors)
      }
      setModalError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/suppliers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setSuccessMsg('Supplier removed.')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to delete supplier.'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg =
          typeof err.response.data.errors === 'string'
            ? err.response.data.errors
            : JSON.stringify(err.response.data.errors)
      }
      alert(msg)
    },
  })

  const handleDelete = (supplier: SupplierRecord) => {
    if (confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) {
      deleteMutation.mutate(supplier.id)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Suppliers & Vendors</h2>
          <p className="text-xs text-slate-500">
            Configure product distributors, contact information, and delivery terms
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingSupplier(null)
              setModalError(null)
              setIsModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading suppliers...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">
          Failed to load suppliers.
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
          <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">No suppliers registered</h3>
          <p className="text-xs text-slate-500 mt-1">
            Add your first supplier to start recording inventory supplies.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Truck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {sup.supplies_count ?? 0} {sup.supplies_count === 1 ? 'Supply' : 'Supplies'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base mb-2">{sup.name}</h3>

                <div className="space-y-1.5 mb-4">
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    <span>{sup.phone || 'No phone number'}</span>
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    <span>{sup.address || 'No address specified'}</span>
                  </p>
                  {sup.notes && (
                    <p className="text-xs text-slate-500 flex items-start gap-1.5 pt-1 border-t border-slate-100 mt-2">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                      <span className="line-clamp-2">{sup.notes}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to="/supplies"
                  search={{ supplier_id: sup.id }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
                >
                  <span>View Supplies</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSupplier(sup)
                        setModalError(null)
                        setIsModalOpen(true)
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(sup)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Supplier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => {
            setIsModalOpen(false)
            setEditingSupplier(null)
          }}
          onSubmit={(data) => {
            if (editingSupplier) {
              updateMutation.mutate({ id: editingSupplier.id, data })
            } else {
              createMutation.mutate(data)
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
          errorMsg={modalError}
        />
      )}
    </div>
  )
}

/* =========================================================================
   Unified Management Page Component
   ========================================================================= */

function ManagementPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const { tab = 'categories' } = Route.useSearch()
  const navigate = useNavigate({ from: '/management' })

  const canManage = user?.role === 'admin' || user?.role === 'stockkeeper'

  if (!canManage) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 inline-block text-amber-600 mb-4">
          <ShieldAlert className="w-10 h-10 mx-auto" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500 mb-6">
          Management of categories, store locations, and suppliers is reserved for Stockkeepers and Administrators.
        </p>
        <Link
          to="/products"
          className="px-5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-blue-700 transition-colors inline-block"
        >
          Return to Products Catalog
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Structure Management</h1>
            <p className="text-xs text-slate-500">
              Taxonomy categories tree, physical location points, and suppliers
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-200/70 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate({ search: { tab: 'categories' } })}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'categories'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Categories</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ search: { tab: 'locations' } })}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'locations'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Locations</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ search: { tab: 'suppliers' } })}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'suppliers'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Suppliers</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {tab === 'categories' ? (
          <CategoriesManager canManage={canManage} token={token} />
        ) : tab === 'locations' ? (
          <LocationsManager canManage={canManage} token={token} />
        ) : (
          <SuppliersManager canManage={canManage} token={token} />
        )}
      </div>
    </div>
  )
}
