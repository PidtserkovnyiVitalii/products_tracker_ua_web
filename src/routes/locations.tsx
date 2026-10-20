import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { MapPin, ShieldAlert, Calendar } from 'lucide-react'

export const Route = createFileRoute('/locations')({
  component: LocationsPage,
})

interface LocationRecord {
  id: string
  address: string
  created_at: string
}

function LocationsPage() {
  const token = useAuthStore((state) => state.token)

  const { data: locations = [], isLoading, error } = useQuery<LocationRecord[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/locations')
      return res.data
    },
    enabled: !!token,
  })

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
      <div className="flex items-center gap-2.5 mb-6">
        <MapPin className="w-7 h-7 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
          <p className="text-sm text-slate-500">Retail points and warehouses</p>
        </div>
      </div>

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
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-slate-300 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{loc.address}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Added {new Date(loc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
