'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '../lib/i18n'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSelector from '../components/LanguageSelector'

const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080'
    : 'http://backend:8080'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation('common')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        router.push('/home')
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
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
            {t('nav.backToHome')}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector compact />
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('login.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t('login.subtitle')}
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
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('login.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('login.emailPlaceholder')}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('login.passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-md bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('login.passwordPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? t('login.submittingButton') : t('login.submitButton')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('login.noAccount')}{' '}
            <Link
              href="/register"
              className="text-blue-500 hover:text-blue-400 font-medium"
            >
              {t('login.requestAccessLink')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

