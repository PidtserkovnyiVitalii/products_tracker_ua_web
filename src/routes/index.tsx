import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthStore } from '../store/authStore'
import { FolderTree, MapPin, Package, ArrowUpRight, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-4 h-4" />
              Products Tracker UA
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {user ? `Welcome back, ${user.email}` : 'Welcome to Products Tracker'}
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-xl">
              Centralized platform for product inventory, hierarchical category taxonomy,
              location stock management, and sales tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {token ? (
              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <div className="text-xs text-slate-300">Active Role</div>
                  <div className="text-sm font-bold uppercase tracking-wider text-white">
                    {user?.role}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-2xl shadow-lg transition-all"
              >
                Sign In to Start
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Feature Cards Grid (Shown for authenticated users) */}
      {token && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/categories"
            className="group p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FolderTree className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center justify-between">
                Categories
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </h3>
              <p className="text-slate-500 text-sm mt-1.5">
                Hierarchical product tree taxonomy with slug management and circular dependency protection.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-blue-600">Explore Tree &rarr;</div>
          </Link>

          <Link
            to="/locations"
            className="group p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-md hover:border-emerald-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center justify-between">
                Locations
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </h3>
              <p className="text-slate-500 text-sm mt-1.5">
                Warehouse points and retail locations registered across Ukraine.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-emerald-600">View Locations &rarr;</div>
          </Link>

          <div className="p-6 bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs opacity-75 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-700 text-lg">Products & Stock</h3>
              <p className="text-slate-400 text-sm mt-1.5">
                Coming next: product catalog linked to categories with location stock tracking.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-purple-400">In Development</div>
          </div>
        </div>
      )}
    </div>
  )
}
