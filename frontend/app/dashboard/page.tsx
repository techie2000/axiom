'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import LEIStatusCard from '../components/LEIStatusCard'
import LEIRecordsCard from '../components/LEIRecordsCard'
import CountriesRecordsCard from '../components/CountriesRecordsCard'
import CurrenciesRecordsCard from '../components/CurrenciesRecordsCard'
import LanguagesRecordsCard from '../components/LanguagesRecordsCard'
import ProtectedLandingCard from '../components/ProtectedLandingCard'
import AdminSection from '../components/AdminSection'
import { getAuthToken } from '../lib/auth-token'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { buildDocsUrl } from '../lib/docsLinks'
import { getDashboardSectionById } from '../lib/dashboard-sections'

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardPageContent />
    </Suspense>
  )
}

function DashboardPageFallback() {
  const { t } = useTranslation('common')

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto text-sm theme-text-muted">
        {t('dashboard.redirecting')}
      </div>
    </main>
  )
}

function DashboardPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const activeSection = getDashboardSectionById(searchParams.get('section'))

  const showPublicReferenceData = !activeSection || activeSection.id === 'public-reference-data'
  const showMasterData = !activeSection || activeSection.id === 'master-data-management'
  const showDataAcquisition = !activeSection || activeSection.id === 'data-acquisition-processing'
  const showAdministration = !activeSection || activeSection.id === 'administration'

  useEffect(() => {
    setMounted(true)
    const loggedIn = getAuthToken() !== null
    setIsLoggedIn(loggedIn)

    if (!loggedIn) {
      router.replace('/login')
    }
  }, [router])

  if (!mounted || !isLoggedIn) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto text-sm theme-text-muted">
          {t('dashboard.redirecting')}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <section className="mb-10 theme-panel border-2 backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4 md:gap-5">
              <Image
                src="/branding/logo.png"
                alt="Axiom brand"
                width={88}
                height={88}
                className="rounded-xl border border-[rgb(var(--border-rgb))]"
                priority
              />
              <div>
                <span className="inline-block mb-2 text-xs uppercase tracking-wide theme-text-muted">
                  {t('dashboard.platformLabel')}
                </span>
                <h1 className="text-3xl md:text-4xl font-bold" title={getEnglishTooltip('dashboard.title')}>
                  {t('dashboard.title')}
                </h1>
                <p className="mt-2 theme-text-muted" title={getEnglishTooltip('dashboard.subtitle')}>
                  {t('dashboard.subtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={buildDocsUrl('')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-md theme-btn-neutral px-4 py-2 text-sm font-medium"
                title={getEnglishTooltip('nav.documentation')}
              >
                {t('nav.documentation')}
              </Link>
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-md theme-btn-primary px-4 py-2 text-sm font-medium"
                title={getEnglishTooltip('dashboard.publicDataHubButton')}
              >
                {t('dashboard.publicDataHubButton')}
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-2" title={getEnglishTooltip('dashboard.moduleCatalog.title')}>{t('dashboard.moduleCatalog.title')}</h2>
          {!activeSection && (
            <p className="theme-text-muted" title={getEnglishTooltip('dashboard.moduleCatalog.subtitle')}>
              {t('dashboard.moduleCatalog.subtitle')}
            </p>
          )}
          {activeSection && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="theme-text-muted">
                {t(activeSection.titleKey)}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-md theme-btn-neutral px-3 py-1.5 text-xs font-medium"
              >
                {t('nav.backToDashboard')}
              </Link>
            </div>
          )}
        </section>

        {showPublicReferenceData && (
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">🌍</span>
            <div>
              <h2 className="text-2xl font-bold" title={getEnglishTooltip('dashboard.publicReferenceData.title')}>{t('dashboard.publicReferenceData.title')}</h2>
              <p className="text-sm theme-text-muted" title={getEnglishTooltip('dashboard.publicReferenceData.subtitle')}>{t('dashboard.publicReferenceData.subtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
            <CountriesRecordsCard />
            <CurrenciesRecordsCard />
            <LanguagesRecordsCard />
            <LEIRecordsCard />
          </div>
        </section>
        )}

        {showMasterData && (
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">📊</span>
            <div>
              <h2 className="text-2xl font-bold" title={getEnglishTooltip('dashboard.masterData.title')}>{t('dashboard.masterData.title')}</h2>
              <p className="text-sm theme-text-muted" title={getEnglishTooltip('dashboard.masterData.subtitle')}>{t('dashboard.masterData.subtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProtectedLandingCard
              href="/instruments"
              title={t('dashboard.instruments.title')}
              description={t('dashboard.instruments.description')}
              titleTooltip={getEnglishTooltip('dashboard.instruments.title')}
              descriptionTooltip={getEnglishTooltip('dashboard.instruments.description')}
              icon="🎯"
            />

            <ProtectedLandingCard
              href="/accounts"
              title={t('dashboard.accounts.title')}
              description={t('dashboard.accounts.description')}
              titleTooltip={getEnglishTooltip('dashboard.accounts.title')}
              descriptionTooltip={getEnglishTooltip('dashboard.accounts.description')}
              icon="🏦"
            />

            <ProtectedLandingCard
              href="/ssi"
              title={t('dashboard.ssi.title')}
              description={t('dashboard.ssi.description')}
              titleTooltip={getEnglishTooltip('dashboard.ssi.title')}
              descriptionTooltip={getEnglishTooltip('dashboard.ssi.description')}
              icon="📋"
            />

            <ProtectedLandingCard
              href="/code-mappings"
              title={t('dashboard.codeMappings.title')}
              description={t('dashboard.codeMappings.description')}
              titleTooltip={getEnglishTooltip('dashboard.codeMappings.title')}
              descriptionTooltip={getEnglishTooltip('dashboard.codeMappings.description')}
              icon="🔄"
            />
          </div>
        </section>
        )}

        {showDataAcquisition && (
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">📡</span>
            <div>
              <h2 className="text-2xl font-bold" title={getEnglishTooltip('dashboard.dataAcquisition.title')}>{t('dashboard.dataAcquisition.title')}</h2>
              <p className="text-sm theme-text-muted" title={getEnglishTooltip('dashboard.dataAcquisition.subtitle')}>{t('dashboard.dataAcquisition.subtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LEIStatusCard />

            <div className="group theme-panel border-2 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-purple-500 dark:hover:border-purple-400 cursor-not-allowed opacity-50 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1 min-w-0">
                  <h3 className="text-xl font-semibold mb-2">
                    {t('dashboard.dataImport.title')}
                  </h3>
                  <p className="theme-text-muted flex-1 mb-4 break-words whitespace-normal">
                    {t('dashboard.dataImport.description')}
                  </p>
                  <div className="mt-auto">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded">{t('dashboard.dataImport.comingSoon')}</span>
                  </div>
                </div>
                <span className="text-3xl ml-4 shrink-0">📥</span>
              </div>
            </div>
          </div>
        </section>
        )}

        {showAdministration && <AdminSection />}
      </div>
    </main>
  )
}
