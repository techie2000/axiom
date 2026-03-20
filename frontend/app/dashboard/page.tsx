'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

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
        <div className="max-w-7xl mx-auto text-sm text-gray-500 dark:text-gray-400">
          {t('dashboard.redirecting')}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <section className="mb-10 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4 md:gap-5">
              <Image
                src="/branding/logo.png"
                alt="Axiom brand"
                width={88}
                height={88}
                className="rounded-xl border border-gray-200 dark:border-white/10"
                priority
              />
              <div>
                <span className="inline-block mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('dashboard.platformLabel')}
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white" title={getEnglishTooltip('dashboard.title')}>
                  {t('dashboard.title')}
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300" title={getEnglishTooltip('dashboard.subtitle')}>
                  {t('dashboard.subtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={buildDocsUrl('')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/35"
                title={getEnglishTooltip('nav.documentation')}
              >
                {t('nav.documentation')}
              </Link>
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors"
                title={getEnglishTooltip('dashboard.publicDataHubButton')}
              >
                {t('dashboard.publicDataHubButton')}
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white" title={getEnglishTooltip('dashboard.moduleCatalog.title')}>{t('dashboard.moduleCatalog.title')}</h2>
          <p className="text-gray-600 dark:text-gray-300" title={getEnglishTooltip('dashboard.moduleCatalog.subtitle')}>{t('dashboard.moduleCatalog.subtitle')}</p>
        </section>

        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">🌍</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white" title={getEnglishTooltip('dashboard.publicReferenceData.title')}>{t('dashboard.publicReferenceData.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400" title={getEnglishTooltip('dashboard.publicReferenceData.subtitle')}>{t('dashboard.publicReferenceData.subtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
            <CountriesRecordsCard />
            <CurrenciesRecordsCard />
            <LanguagesRecordsCard />
            <LEIRecordsCard />
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">📊</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white" title={getEnglishTooltip('dashboard.masterData.title')}>{t('dashboard.masterData.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400" title={getEnglishTooltip('dashboard.masterData.subtitle')}>{t('dashboard.masterData.subtitle')}</p>
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

        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">📡</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white" title={getEnglishTooltip('dashboard.dataAcquisition.title')}>{t('dashboard.dataAcquisition.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400" title={getEnglishTooltip('dashboard.dataAcquisition.subtitle')}>{t('dashboard.dataAcquisition.subtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LEIStatusCard />

            <div className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-purple-500 dark:hover:border-purple-400 cursor-not-allowed opacity-50 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1 min-w-0">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                    {t('dashboard.dataImport.title')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4 break-words whitespace-normal">
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

        <AdminSection />
      </div>
    </main>
  )
}
