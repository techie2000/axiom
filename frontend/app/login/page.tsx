'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '../lib/i18n'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSelector from '../components/LanguageSelector'
import { getApiBaseUrl } from '../lib/api-base'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { resolveHydrationSafeLabel } from '../lib/hydrationSafeLabel'

const API_BASE_URL = getApiBaseUrl()

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const [hasHydrated, setHasHydrated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const hydrationSafeLabel = (translationKey: string, fallbackLabel: string) =>
    resolveHydrationSafeLabel(undefined, hasHydrated, t(translationKey), fallbackLabel)

  const backToHomeLabel = hydrationSafeLabel('nav.backToHome', '← Back to Home')
  const loginTitleLabel = hydrationSafeLabel('login.title', 'Sign In')
  const loginSubtitleLabel = hydrationSafeLabel(
    'login.subtitle',
    'Sign in to access protected Axiom features',
  )
  const emailLabel = hydrationSafeLabel('login.emailLabel', 'Email address')
  const emailPlaceholder = hydrationSafeLabel('login.emailPlaceholder', 'you@example.com')
  const passwordLabel = hydrationSafeLabel('login.passwordLabel', 'Password')
  const passwordPlaceholder = hydrationSafeLabel('login.passwordPlaceholder', '********')
  const submitButtonLabel = hydrationSafeLabel('login.submitButton', 'Sign in')
  const submittingButtonLabel = hydrationSafeLabel('login.submittingButton', 'Signing in...')
  const noAccountLabel = hydrationSafeLabel('login.noAccount', "Don't have an account?")
  const requestAccessLabel = hydrationSafeLabel('login.requestAccessLink', 'Request access')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('login.errorGeneric'))
        return
      }

      // Persist the token
      localStorage.setItem('axiom_token', data.token)
      localStorage.setItem('axiom_user', JSON.stringify(data.user))

      if (data.is_bootstrap) {
        // Bootstrap admin must create a real admin account first
        router.push('/admin/users?bootstrap=true')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError(t('login.errorNetwork'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="theme-link hover:opacity-80 text-sm">
            {backToHomeLabel}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector compact />
            <ThemeToggle />
          </div>
        </div>

        <div className="theme-panel border-2 backdrop-blur-sm rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2" title={getEnglishTooltip('login.title')}>{loginTitleLabel}</h1>
            <p className="theme-text-muted text-sm" title={getEnglishTooltip('login.subtitle')}>
              {loginSubtitleLabel}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium theme-text-muted mb-1"
              >
                {emailLabel}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                title={getEnglishTooltip('login.emailPlaceholder')}
                className="w-full px-3 py-2 border rounded-md theme-input"
                placeholder={emailPlaceholder}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium theme-text-muted mb-1"
              >
                {passwordLabel}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                title={getEnglishTooltip('login.passwordPlaceholder')}
                className="w-full px-3 py-2 border rounded-md theme-input"
                placeholder={passwordPlaceholder}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              title={loading ? getEnglishTooltip('login.submittingButton') : getEnglishTooltip('login.submitButton')}
              className="w-full py-2 px-4 theme-btn-primary disabled:opacity-60 font-medium rounded-md theme-focus"
            >
              {loading ? submittingButtonLabel : submitButtonLabel}
            </button>
          </form>

          <div className="mt-6 text-center text-sm theme-text-muted">
            {noAccountLabel}{' '}
            <Link
              href="/register"
              className="theme-link hover:opacity-80 font-medium"
              title={getEnglishTooltip('login.requestAccessLink')}
            >
              {requestAccessLabel}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

