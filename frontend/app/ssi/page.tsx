'use client'

import Link from 'next/link'
import PageHeader from '../components/PageHeader'
import { useTranslation } from 'react-i18next'

export default function SSIPage() {
  const { t } = useTranslation('common')

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title={t('ssi.title')}
          subtitle={t('ssi.subtitle')}
          backHref="/dashboard"
        />

        {/* Coming Soon Notice */}
        <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-lg p-8 mb-8">
          <div className="flex items-start">
            <span className="text-4xl mr-4">🚧</span>
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-purple-400">{t('ssi.comingSoon.title')}</h2>
              <p className="opacity-70 mb-4">
                {t('ssi.comingSoon.description')}
              </p>
              <ul className="list-disc list-inside space-y-2 opacity-70">
                <li>{t('ssi.comingSoon.points.templates')}</li>
                <li>{t('ssi.comingSoon.points.counterparties')}</li>
                <li>{t('ssi.comingSoon.points.multicurrency')}</li>
                <li>{t('ssi.comingSoon.points.integration')}</li>
                <li>{t('ssi.comingSoon.points.validation')}</li>
                <li>{t('ssi.comingSoon.points.automation')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Feature Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">{t('ssi.cards.templatesTitle')}</h3>
              <span className="text-3xl">📋</span>
            </div>
            <p className="opacity-70">
              {t('ssi.cards.templatesDescription')}
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">{t('ssi.cards.counterpartyTitle')}</h3>
              <span className="text-3xl">🏦</span>
            </div>
            <p className="opacity-70">
              {t('ssi.cards.counterpartyDescription')}
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">{t('ssi.cards.validationTitle')}</h3>
              <span className="text-3xl">✅</span>
            </div>
            <p className="opacity-70">
              {t('ssi.cards.validationDescription')}
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">{t('ssi.cards.automationTitle')}</h3>
              <span className="text-3xl">⚡</span>
            </div>
            <p className="opacity-70">
              {t('ssi.cards.automationDescription')}
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-block bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-6 py-3 rounded-lg transition-colors border-2 border-purple-500/30"
          >
            {t('nav.backToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}
