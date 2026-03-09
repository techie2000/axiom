'use client'

import PageHeader from '../components/PageHeader'

export default function AccountsPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Accounts"
          subtitle="Trading accounts and settlement instructions"
          backHref="/dashboard"
          backLabel="← Back to Dashboard"
        />

        {/* Coming Soon Card */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-12 text-center border-2 border-white/10">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🏦</div>
            <h2 className="text-2xl font-bold mb-4">
              Accounts Management
            </h2>
            <p className="opacity-70 mb-6">
              This page will display trading accounts, custodian relationships, and standard settlement instructions (SSI) managed in Axiom.
            </p>
            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm">
                <span className="font-semibold">🔒 Authentication Required</span>
                <br />
                This is protected data requiring user authentication.
              </p>
            </div>
            <p className="text-sm opacity-60">
              Features coming soon: Browse accounts, search by account number, view SSI details, manage account data
            </p>
          </div>
        </div>

        {/* Planned Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow p-6 border-2 border-white/10">
            <h3 className="font-semibold mb-2">🔍 Account Search</h3>
            <p className="text-sm opacity-70">
              Search accounts by number, entity, custodian, and status
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow p-6 border-2 border-white/10">
            <h3 className="font-semibold mb-2">📋 SSI Management</h3>
            <p className="text-sm opacity-70">
              View and manage standard settlement instructions for each account
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow p-6 border-2 border-white/10">
            <h3 className="font-semibold mb-2">✏️ Data Maintenance</h3>
            <p className="text-sm opacity-70">
              Create, update, and validate account reference data
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
