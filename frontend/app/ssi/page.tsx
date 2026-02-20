'use client'

import Link from 'next/link'
import PageHeader from '../components/PageHeader'

export default function SSIPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Standard Settlement Instructions (SSI)"
          subtitle="Manage settlement instructions for securities trading counterparties"
        />

        {/* Coming Soon Notice */}
        <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-lg p-8 mb-8">
          <div className="flex items-start">
            <span className="text-4xl mr-4">🚧</span>
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-purple-400">Coming Soon</h2>
              <p className="opacity-70 mb-4">
                The SSI module is currently under development. This feature will provide:
              </p>
              <ul className="list-disc list-inside space-y-2 opacity-70">
                <li>Settlement instruction templates for multiple asset classes</li>
                <li>Counterparty SSI database with validation rules</li>
                <li>Multi-currency and cross-border settlement support</li>
                <li>Integration with accounts and entities</li>
                <li>BIC/SWIFT code validation</li>
                <li>Settlement workflow automation</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Feature Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">SSI Templates</h3>
              <span className="text-3xl">📋</span>
            </div>
            <p className="opacity-70">
              Pre-configured settlement instruction templates for Equities, Bonds, FX, and Derivatives
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">Counterparty Management</h3>
              <span className="text-3xl">🏦</span>
            </div>
            <p className="opacity-70">
              Centralized repository of counterparty settlement details with LEI integration
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">Validation Rules</h3>
              <span className="text-3xl">✅</span>
            </div>
            <p className="opacity-70">
              Real-time validation of BIC codes, IBANs, and account numbers against ISO standards
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-6 border-2 border-white/10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">Settlement Automation</h3>
              <span className="text-3xl">⚡</span>
            </div>
            <p className="opacity-70">
              Automated settlement instruction generation based on trade details and counterparty rules
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-block bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-6 py-3 rounded-lg transition-colors border-2 border-purple-500/30"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
