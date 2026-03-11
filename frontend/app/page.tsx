'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAuthToken } from './lib/auth-token'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const { t } = useTranslation('common')

  useEffect(() => {
    setMounted(true)

    const hasValidToken = getAuthToken() !== null
    setIsAuthenticated(hasValidToken)

    if (!hasValidToken) {
      setSignedInAs(null)
      return
    }

    const rawUser = localStorage.getItem('axiom_user')
    if (!rawUser) {
      setSignedInAs(null)
      return
    }

    try {
      const parsedUser = JSON.parse(rawUser) as {
        full_name?: string
        username?: string
        email?: string
      }
      const displayName =
        (parsedUser.full_name || '').trim() ||
        (parsedUser.username || '').trim() ||
        (parsedUser.email || '').trim()
      const email = (parsedUser.email || '').trim()

      if (!displayName) {
        setSignedInAs(null)
        return
      }

      const identity =
        email && displayName.toLowerCase() !== email.toLowerCase()
          ? `${displayName} (${email})`
          : displayName
      setSignedInAs(identity)
    } catch {
      setSignedInAs(null)
    }
  }, [])

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <section className="mb-12">
          <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-2xl shadow-lg p-7 md:p-9">
            <div className="flex items-center gap-4 md:gap-6 mb-7">
              <div className="flex items-center gap-4 md:gap-6">
                <Image
                  src="/branding/logo.svg"
                  alt="Axiom brand"
                  width={96}
                  height={96}
                  className="rounded-xl border border-gray-200 dark:border-white/10 md:w-[108px] md:h-[108px] lg:w-[120px] lg:h-[120px]"
                  priority
                />
                <div>
                  <span className="inline-block mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    {t('landing.platformLabel')}
                  </span>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    Axiom
                  </h1>
                  <p className="mt-1.5 text-gray-700 dark:text-gray-200">
                    {t('landing.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('landing.welcomeTitle')}
              </h2>
              <p className="text-gray-700 dark:text-gray-200 mb-6">
                {!mounted
                  ? t('landing.loading')
                  : isAuthenticated
                  ? t('landing.welcomeBack')
                  : t('landing.chooseWhere')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!mounted ? (
                <span className="inline-flex items-center justify-center rounded-md bg-blue-600/40 text-transparent px-6 py-3 font-semibold select-none" aria-hidden="true">
                  &nbsp;
                </span>
              ) : isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-semibold transition-colors"
                >
                  {t('landing.returnToDashboard')}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-semibold transition-colors"
                >
                  {t('landing.signInBtn')}
                </Link>
              )}
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-md border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 px-6 py-3 font-semibold transition-colors"
              >
                {t('landing.explorePublicData')}
              </Link>
            </div>
            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              {mounted && (isAuthenticated
                ? (signedInAs ? t('landing.signedInAs', { name: signedInAs }) : t('landing.signedIn'))
                : t('landing.protectedModules'))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
