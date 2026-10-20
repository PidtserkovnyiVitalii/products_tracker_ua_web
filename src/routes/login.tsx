import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import axios from 'axios'
import { api } from '../api/api'
import { useAuthStore, type UserRole } from '../store/authStore'
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

interface LoginResponse {
  token: string
  role: UserRole
  exp: string
}

function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {}
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'email') fieldErrors.email = issue.message
        if (issue.path[0] === 'password') fieldErrors.password = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    try {
      setLoading(true)
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      })

      setAuth(response.data.token, {
        email,
        role: response.data.role,
      })

      navigate({ to: '/' })
    } catch (err: unknown) {
      let msg = 'Failed to authenticate. Please check your credentials.'
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        msg = err.response.data.error
      }
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h1>
          <p className="text-sm text-slate-500 mt-1">Products Tracker UA</p>
        </div>

        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-slate-50/50"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-slate-50/50"
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
