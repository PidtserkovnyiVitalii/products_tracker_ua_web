import { create } from 'zustand'

export type UserRole = 'admin' | 'cashier' | 'stockkeeper'

export interface User {
  email: string
  role: UserRole
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

const getStoredToken = () => localStorage.getItem('auth_token')
const getStoredUser = (): User | null => {
  const stored = localStorage.getItem('auth_user')
  return stored ? (JSON.parse(stored) as User) : null
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  setAuth: (token, user) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    set({ token, user })
  },
  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    set({ token: null, user: null })
  },
}))
