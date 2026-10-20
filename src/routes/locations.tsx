import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, type FormEvent } from 'react'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { MapPin, ShieldAlert, Warehouse, Store, Plus, Edit3, X, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/locations')({
  component: LocationsPage,
})

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
            <h3 className="text-lg font-bold text-slate-900">
              {location ? 'Edit Location' : 'New Location'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {location ? 'Update store or warehouse details' : 'Register a new store or distribution hub'}
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
              Location Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ДитСвіт Хрещатик"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Physical Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. вул. Хрещатик, 1, Київ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Location Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  locationType === 'store'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="location_type"
                  value="store"
                  checked={locationType === 'store'}
                  onChange={() => setLocationType('store')}
                  className="sr-only"
                />
                <Store className="w-4 h-4 text-emerald-600" />
                <span className="text-sm">Retail Store</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  locationType === 'warehouse'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="location_type"
                  value="warehouse"
                  checked={locationType === 'warehouse'}
                  onChange={() => setLocationType('warehouse')}
                  className="sr-only"
                />
                <Warehouse className="w-4 h-4 text-amber-600" />
                <span className="text-sm">Warehouse</span>
              </label>
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

function LocationsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationRecord | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const canManage = user?.role === 'admin' || user?.role === 'stockkeeper'

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
      const res = await api.delete(`/locations/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setSuccessMsg('Location deleted.')
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: unknown) => {
      let msg = 'Failed to delete location'
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        msg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors)
      }
      alert(msg)
    },
  })

  const handleOpenCreate = () => {
    setEditingLocation(null)
    setModalError(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (location: LocationRecord) => {
    setEditingLocation(location)
    setModalError(null)
    setIsModalOpen(true)
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          You must sign in to view store locations.
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
        <div className="flex items-center gap-2.5">
          <MapPin className="w-7 h-7 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
            <p className="text-sm text-slate-500">Retail points and warehouses</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Location
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading locations...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
          Failed to load locations. Please ensure the backend is running.
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-700">No locations found</h3>
          <p className="text-sm text-slate-500 mt-1">No store or warehouse locations registered yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.map((loc) => {
            const isWarehouse = loc.location_type === 'warehouse'
            return (
              <div
                key={loc.id}
                className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isWarehouse ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {isWarehouse ? <Warehouse className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{loc.name || loc.address}</h3>
                      {loc.location_type && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {loc.location_type}
                        </span>
                      )}
                    </div>
                    {loc.name && loc.address && (
                      <p className="text-xs text-slate-500 mt-1">{loc.address}</p>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEdit(loc)}
                      className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${loc.name}"?`)) {
                          deleteMutation.mutate(loc.id)
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete location"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal for Creating / Editing Location */}
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
