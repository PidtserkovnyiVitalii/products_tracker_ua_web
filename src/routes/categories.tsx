import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { FolderTree, Plus, ChevronRight, ChevronDown, Trash2, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react'

export const Route = createFileRoute('/categories')({
  component: CategoriesPage,
})

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
}: {
  node: CategoryNode
  canManage: boolean
  onDelete: (id: string) => void
  onAddChild: (parent: CategoryNode) => void
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

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 text-sm">{node.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
              /{node.slug}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAddChild(node)}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Subcategory
            </button>
            <button
              onClick={() => onDelete(node.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Delete category"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="pl-6 pr-3.5 pb-3 pt-1 border-t border-slate-100 bg-slate-50/30">
          {node.children.map((child) => (
            <CategoryItem
              key={child.id}
              node={child}
              canManage={canManage}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoriesPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)

  const [selectedParent, setSelectedParent] = useState<CategoryNode | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const canManage = user?.role === 'admin' || user?.role === 'stockkeeper'

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
      const res = await api.post('/api/v1/categories', {
        category: data,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setNewCategoryName('')
      setSelectedParent(null)
      setSuccessMsg('Category created successfully!')
      setErrorMsg(null)
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to create category'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = JSON.stringify(err.response.data.errors)
      }
      setErrorMsg(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/categories/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setSuccessMsg('Category deleted.')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to delete category'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      setErrorMsg(msg)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    createMutation.mutate({
      name: newCategoryName.trim(),
      parent_id: selectedParent?.id,
    })
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          You must sign in to view and manage categories.
        </p>
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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <FolderTree className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Hierarchical product categorization tree
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setSelectedParent(null)
              setNewCategoryName('')
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Root Category
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Creation Box if canManage */}
      {canManage && (
        <form onSubmit={handleCreate} className="mb-8 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={selectedParent ? `Subcategory under "${selectedParent.name}"` : 'Category name (e.g. Beverages, Dairy)'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {selectedParent && (
            <button
              type="button"
              onClick={() => setSelectedParent(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear parent
            </button>
          )}
          <button
            type="submit"
            disabled={createMutation.isPending || !newCategoryName.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            {createMutation.isPending ? 'Adding...' : selectedParent ? 'Add Subcategory' : 'Add Category'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading categories...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
          Failed to load categories. Please check your connection or sign in again.
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
          <FolderTree className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-700">No categories found</h3>
          <p className="text-sm text-slate-500 mt-1">Create your first category using the input above.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {categories.map((root) => (
            <CategoryItem
              key={root.id}
              node={root}
              canManage={canManage}
              onDelete={(id) => deleteMutation.mutate(id)}
              onAddChild={(parent) => setSelectedParent(parent)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
