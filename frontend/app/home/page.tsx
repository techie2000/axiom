'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import CountriesRecordsCard from '../components/CountriesRecordsCard'
import CurrenciesRecordsCard from '../components/CurrenciesRecordsCard'
import LanguagesRecordsCard from '../components/LanguagesRecordsCard'
import LEIRecordsCard from '../components/LEIRecordsCard'
import SignInPrompt from '../components/SignInPrompt'
import AllModulesButton from '../components/AllModulesButton'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { buildDocsUrl } from '../lib/docsLinks'

export default function PublicDataHomePage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <section className="mb-10 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4 md:gap-5">
              <Image
                src="/branding/logo.svg"
                alt="Axiom brand"
                width={88}
                height={88}
                className="rounded-xl border border-gray-200 dark:border-white/10"
                priority
              />
              <div>
                <span className="inline-block mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('publicHub.platformLabel')}
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white" title={getEnglishTooltip('publicHub.title')}>
                  {t('publicHub.title')}
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300" title={getEnglishTooltip('publicHub.subtitle')}>
                  {t('publicHub.subtitle')}
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
              <AllModulesButton />
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white" title={getEnglishTooltip('publicHub.catalogTitle')}>{t('publicHub.catalogTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-300" title={getEnglishTooltip('publicHub.catalogSubtitle')}>{t('publicHub.catalogSubtitle')}</p>
        </section>

        <SignInPrompt />

        <section className="mb-12">
          <div className="mb-5 flex flex-wrap gap-2">
            <Link
              href="/countries"
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              title={getEnglishTooltip('publicHub.iso3166Countries')}
            >
              {t('publicHub.iso3166Countries')}
            </Link>
            <Link
              href="/currencies"
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              title={getEnglishTooltip('publicHub.iso4217Currencies')}
            >
              {t('publicHub.iso4217Currencies')}
            </Link>
            <Link
              href="/languages"
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
              title={getEnglishTooltip('publicHub.isoLanguages')}
            >
              {t('publicHub.isoLanguages')}
            </Link>
            <Link
              href="/lei-records"
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
              title={getEnglishTooltip('publicHub.leiRecordsTag')}
            >
              {t('publicHub.leiRecordsTag')}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
            <CountriesRecordsCard />
            <CurrenciesRecordsCard />
            <LanguagesRecordsCard />
            <LEIRecordsCard />
          </div>
        </section>
      </div>
    </main>
  )
}
