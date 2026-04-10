'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAuthToken } from './lib/auth-token'
import { useEnglishTooltips } from './lib/useEnglishTooltips'
import AdminSection from './components/AdminSection'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()

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
          <div className="theme-panel border-2 backdrop-blur-sm rounded-2xl shadow-lg p-7 md:p-9">
            <div className="flex items-center gap-4 md:gap-6 mb-7">
              <div className="flex items-center gap-4 md:gap-6">
                <Image
                  src="/branding/logo.svg"
                  alt="Axiom brand"
                  width={96}
                  height={96}
                  className="rounded-xl border border-[rgb(var(--border-rgb))] md:w-[108px] md:h-[108px] lg:w-[120px] lg:h-[120px]"
                  priority
                />
                <div>
                  <span className="inline-block mb-2 text-xs font-semibold uppercase tracking-[0.12em] theme-text-muted" title={getEnglishTooltip('landing.platformLabel')}>
                    {t('landing.platformLabel')}
                  </span>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                    Axiom
                  </h1>
                  <p className="mt-1.5 theme-text-muted" title={getEnglishTooltip('landing.subtitle')}>
                    {t('landing.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2" title={getEnglishTooltip('landing.welcomeTitle')}>
                {t('landing.welcomeTitle')}
              </h2>
              <p className="theme-text-muted mb-6" title={!mounted ? getEnglishTooltip('landing.loading') : isAuthenticated ? getEnglishTooltip('landing.welcomeBack') : getEnglishTooltip('landing.chooseWhere')}>
                {!mounted
                  ? t('landing.loading')
                  : isAuthenticated
                  ? t('landing.welcomeBack')
                  : t('landing.chooseWhere')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!mounted ? (
                <span className="inline-flex items-center justify-center rounded-md theme-btn-primary opacity-50 text-transparent px-6 py-3 font-semibold select-none" aria-hidden="true">
                  &nbsp;
                </span>
              ) : isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-md theme-btn-primary px-6 py-3 font-semibold"
                  title={getEnglishTooltip('landing.returnToDashboard')}
                >
                  {t('landing.returnToDashboard')}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-md theme-btn-primary px-6 py-3 font-semibold"
                  title={getEnglishTooltip('landing.signInBtn')}
                >
                  {t('landing.signInBtn')}
                </Link>
              )}
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-md border-2 theme-btn-neutral px-6 py-3 font-semibold"
                title={getEnglishTooltip('landing.explorePublicData')}
              >
                {t('landing.explorePublicData')}
              </Link>
            </div>
            <div className="mt-6 text-sm theme-text-muted">
              {mounted && (isAuthenticated
                ? (signedInAs ? t('landing.signedInAs', { name: signedInAs }) : t('landing.signedIn'))
                : t('landing.protectedModules'))}
            </div>
          </div>
        </section>

        {/* Administration Section — client component; hides itself for non-admins */}
        <AdminSection />
      </div>
    </main>
  )
}
