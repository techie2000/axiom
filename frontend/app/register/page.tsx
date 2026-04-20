'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import '../lib/i18n'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSelector from '../components/LanguageSelector'
import { getApiBaseUrl } from '../lib/api-base'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { resolveHydrationSafeLabel } from '../lib/hydrationSafeLabel'

const API_BASE_URL = getApiBaseUrl()

export default function RegisterPage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const [hasHydrated, setHasHydrated] = useState(false)
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const hydrationSafeLabel = (translationKey: string, fallbackLabel: string) =>
    resolveHydrationSafeLabel(undefined, hasHydrated, t(translationKey), fallbackLabel)

  const backToLoginLabel = hydrationSafeLabel('nav.backToLogin', '← Back to Login')
  const registerTitleLabel = hydrationSafeLabel('register.title', 'Request Access')
  const registerSubtitleLabel = hydrationSafeLabel(
    'register.subtitle',
    'Submit a request for an Axiom account. An administrator will review and approve it.',
  )
  const fullNameLabel = hydrationSafeLabel('register.fullNameLabel', 'Full name')
  const fullNamePlaceholder = hydrationSafeLabel('register.fullNamePlaceholder', 'Jane Smith')
  const emailLabel = hydrationSafeLabel('register.emailLabel', 'Email address')
  const emailPlaceholder = hydrationSafeLabel('register.emailPlaceholder', 'jane@example.com')
  const usernameLabel = hydrationSafeLabel('register.usernameLabel', 'Username')
  const usernamePlaceholder = hydrationSafeLabel('register.usernamePlaceholder', 'jsmith')
  const passwordLabel = hydrationSafeLabel('register.passwordLabel', 'Password')
  const passwordPlaceholder = hydrationSafeLabel('register.passwordPlaceholder', 'At least 8 characters')
  const confirmPasswordLabel = hydrationSafeLabel('register.confirmPasswordLabel', 'Confirm password')
  const confirmPasswordPlaceholder = hydrationSafeLabel(
    'register.confirmPasswordPlaceholder',
    'Repeat password',
  )
  const requiredLabel = hydrationSafeLabel('register.required', '*')
  const submitButtonLabel = hydrationSafeLabel('register.submitButton', 'Submit request')
  const submittingButtonLabel = hydrationSafeLabel('register.submittingButton', 'Submitting request...')
  const alreadyHaveAccountLabel = hydrationSafeLabel('register.alreadyHaveAccount', 'Already have an account?')
  const signInLabel = hydrationSafeLabel('register.signInLink', 'Sign in')
  const registerSuccessTitle = hydrationSafeLabel('register_success.title', 'Request submitted')
  const registerSuccessMessage = hydrationSafeLabel(
    'register_success.message',
    'Your account request has been sent. An administrator will review it shortly.',
  )
  const backToLoginSuccessLabel = hydrationSafeLabel('register_success.backToLogin', 'Back to sign in')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError(t('register.errorPasswordMatch'))
      return
    }
    if (form.password.length < 8) {
      setError(t('register.errorPasswordLength'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          username: form.username,
          password: form.password,
          full_name: form.full_name,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('register.errorGeneric'))
        return
      }

      setSuccess(true)
    } catch {
      setError(t('register.errorNetwork'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="theme-panel border-2 backdrop-blur-sm rounded-lg shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-3">
              {registerSuccessTitle}
            </h1>
            <p className="theme-text-muted mb-6" title={getEnglishTooltip('register_success.message')}>
              {registerSuccessMessage}
            </p>
            <Link
              href="/login"
              className="inline-block py-2 px-6 theme-btn-primary font-medium rounded-md"
              title={getEnglishTooltip('register_success.backToLogin')}
            >
              {backToLoginSuccessLabel}
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-8">
          <Link href="/login" className="theme-link hover:opacity-80 text-sm">
            {backToLoginLabel}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector compact />
            <ThemeToggle />
          </div>
        </div>

        <div className="theme-panel border-2 backdrop-blur-sm rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2" title={getEnglishTooltip('register.title')}>
              {registerTitleLabel}
            </h1>
            <p className="theme-text-muted text-sm" title={getEnglishTooltip('register.subtitle')}>
              {registerSubtitleLabel}
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
                htmlFor="full_name"
                className="block text-sm font-medium theme-text-muted mb-1"
              >
                {fullNameLabel}
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                value={form.full_name}
                onChange={handleChange}
                title={getEnglishTooltip('register.fullNamePlaceholder')}
                className="w-full px-3 py-2 border rounded-md theme-input"
                placeholder={fullNamePlaceholder}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium theme-text-muted mb-1"
              >
                {emailLabel} <span className="text-red-500">{requiredLabel}</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                title={getEnglishTooltip('register.emailPlaceholder')}
                className="w-full px-3 py-2 border rounded-md theme-input"
                placeholder={emailPlaceholder}
              />
            </div>

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium theme-text-muted mb-1"
              >
                {usernameLabel} <span className="text-red-500">{requiredLabel}</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={100}
                value={form.username}
                onChange={handleChange}
                title={getEnglishTooltip('register.usernamePlaceholder')}
                className="w-full px-3 py-2 border rounded-md theme-input"
                placeholder={usernamePlaceholder}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium theme-text-muted mb-1"
              >
                {passwordLabel} <span className="text-red-500">{requiredLabel}</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={handleChange}
                title={getEnglishTooltip('register.passwordPlaceholder')}
                className="w-full px-3 py-2 border rounded-md theme-input"
                placeholder={passwordPlaceholder}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium theme-text-muted mb-1"
              >
                {confirmPasswordLabel} <span className="text-red-500">{requiredLabel}</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={handleChange}
                title={getEnglishTooltip('register.confirmPasswordPlaceholder')}
                className="w-full px-3 py-2 border rounded-md theme-input"
                placeholder={confirmPasswordPlaceholder}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              title={loading ? getEnglishTooltip('register.submittingButton') : getEnglishTooltip('register.submitButton')}
              className="w-full py-2 px-4 theme-btn-primary disabled:opacity-60 font-medium rounded-md theme-focus"
            >
              {loading ? submittingButtonLabel : submitButtonLabel}
            </button>
          </form>

          <div className="mt-6 text-center text-sm theme-text-muted">
            {alreadyHaveAccountLabel}{' '}
            <Link href="/login" className="theme-link hover:opacity-80 font-medium" title={getEnglishTooltip('register.signInLink')}>
              {signInLabel}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

