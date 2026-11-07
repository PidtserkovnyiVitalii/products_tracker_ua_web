import { create } from 'zustand'
import { api } from '../api/api'

export type Locale = 'uk' | 'en'

const LOCALE_STORAGE_KEY = 'app_locale'

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'uk'
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored === 'uk' || stored === 'en') {
    return stored
  }
  try {
    const authUserRaw = localStorage.getItem('auth_user')
    if (authUserRaw) {
      const parsed = JSON.parse(authUserRaw) as { locale?: string }
      if (parsed?.locale === 'uk' || parsed?.locale === 'en') {
        localStorage.setItem(LOCALE_STORAGE_KEY, parsed.locale)
        return parsed.locale
      }
    }
  } catch {
    // ignore JSON parse errors
  }
  return 'uk'
}

interface I18nState {
  locale: Locale
  setLocale: (newLocale: Locale, syncBackend?: boolean) => void
  syncLocaleOnLogin: (userLocale?: string) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: getInitialLocale(),

  setLocale: (newLocale, syncBackend = true) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
    try {
      const authUserRaw = localStorage.getItem('auth_user')
      if (authUserRaw) {
        const parsed = JSON.parse(authUserRaw)
        localStorage.setItem('auth_user', JSON.stringify({ ...parsed, locale: newLocale }))
      }
    } catch {
      // ignore
    }
    set({ locale: newLocale })

    if (syncBackend && localStorage.getItem('auth_token')) {
      api.patch('/api/v1/profile/locale', { locale: newLocale }).catch(() => {
        // Non-blocking background sync
      })
    }
  },

  syncLocaleOnLogin: (userLocale) => {
    const existingLocal = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (existingLocal === 'uk' || existingLocal === 'en') {
      set({ locale: existingLocal })
      return
    }
    const resolved: Locale = userLocale === 'en' ? 'en' : 'uk'
    localStorage.setItem(LOCALE_STORAGE_KEY, resolved)
    set({ locale: resolved })
  },
}))

const ROLE_LABELS: Record<Locale, Record<string, string>> = {
  uk: {
    admin: 'Адмін',
    cashier: 'Касир',
    stockkeeper: 'Комірник',
  },
  en: {
    admin: 'Admin',
    cashier: 'Cashier',
    stockkeeper: 'Stockkeeper',
  },
}

export function useI18n() {
  const locale = useI18nStore((state) => state.locale)
  const setLocale = useI18nStore((state) => state.setLocale)

  const tr = (ukText: string, enText: string): string => (locale === 'uk' ? ukText : enText)

  const tRole = (role?: string | null): string => {
    if (!role) return ''
    return ROLE_LABELS[locale][role] || role
  }

  return {
    locale,
    isUk: locale === 'uk',
    setLocale,
    tr,
    tRole,
  }
}
