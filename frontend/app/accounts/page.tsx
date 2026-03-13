'use client'

import PageHeader from '../components/PageHeader'
import { useTranslation } from 'react-i18next'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'

export default function AccountsPage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title={t('accounts.title')}
          subtitle={t('accounts.subtitle')}
          titleTooltip={getEnglishTooltip('accounts.title')}
          subtitleTooltip={getEnglishTooltip('accounts.subtitle')}
          backHref="/dashboard"
        />

        {/* Coming Soon Card */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-12 text-center border-2 border-white/10">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🏦</div>
            <h2 className="text-2xl font-bold mb-4" title={getEnglishTooltip('accounts.comingSoon.title')}>
              {t('accounts.comingSoon.title')}
            </h2>
            <p className="opacity-70 mb-6" title={getEnglishTooltip('accounts.comingSoon.description')}>
              {t('accounts.comingSoon.description')}
            </p>
            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm">
                <span className="font-semibold">🔒 Authentication Required</span>
                <br />
                <span title={getEnglishTooltip('accounts.comingSoon.authRequired')}>{t('accounts.comingSoon.authRequired')}</span>
              </p>
            </div>
            <p className="text-sm opacity-60" title={getEnglishTooltip('accounts.comingSoon.featureSummary')}>
              {t('accounts.comingSoon.featureSummary')}
            </p>
          </div>
        </div>

        {/* Planned Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow p-6 border-2 border-white/10">
            <h3 className="font-semibold mb-2" title={getEnglishTooltip('accounts.cards.searchTitle')}>{t('accounts.cards.searchTitle')}</h3>
            <p className="text-sm opacity-70" title={getEnglishTooltip('accounts.cards.searchDescription')}>
              {t('accounts.cards.searchDescription')}
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow p-6 border-2 border-white/10">
            <h3 className="font-semibold mb-2" title={getEnglishTooltip('accounts.cards.ssiTitle')}>{t('accounts.cards.ssiTitle')}</h3>
            <p className="text-sm opacity-70" title={getEnglishTooltip('accounts.cards.ssiDescription')}>
              {t('accounts.cards.ssiDescription')}
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow p-6 border-2 border-white/10">
            <h3 className="font-semibold mb-2" title={getEnglishTooltip('accounts.cards.maintenanceTitle')}>{t('accounts.cards.maintenanceTitle')}</h3>
            <p className="text-sm opacity-70" title={getEnglishTooltip('accounts.cards.maintenanceDescription')}>
              {t('accounts.cards.maintenanceDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
