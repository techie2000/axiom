'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LEIStatusCard from '../components/LEIStatusCard'
import LEIRecordsCard from '../components/LEIRecordsCard'
import CountriesRecordsCard from '../components/CountriesRecordsCard'
import CurrenciesRecordsCard from '../components/CurrenciesRecordsCard'
import LanguagesRecordsCard from '../components/LanguagesRecordsCard'
import PageHeader from '../components/PageHeader'
import ProtectedLandingCard from '../components/ProtectedLandingCard'
import AdminSection from '../components/AdminSection'

export default function DashboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem('axiom_token')
    const loggedIn = !!token
    setIsLoggedIn(loggedIn)

    if (!loggedIn) {
      router.replace('/login')
    }
  }, [router])

  if (!mounted || !isLoggedIn) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto text-sm text-gray-500 dark:text-gray-400">
          Redirecting to sign in...
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
                  Axiom platform
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  Axiom Dashboard
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  Public and protected data modules in one place.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                Public Data Hub →
              </Link>
            </div>
          </div>
        </section>

        <PageHeader title="Module Catalog" subtitle="Choose the area you want to manage" showBackLink={false} />

        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">🌍</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Public Reference Data</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Publicly accessible ISO standards and reference data</p>
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Master Data Management</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Core financial entities and reference data • Authentication required</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProtectedLandingCard
              href="/instruments"
              title="Instruments"
              description="Securities, bonds, and derivatives"
              icon="🎯"
            />

            <ProtectedLandingCard
              href="/accounts"
              title="Accounts"
              description="Trading accounts and settlement instructions"
              icon="🏦"
            />

            <ProtectedLandingCard
              href="/ssi"
              title="SSI"
              description="Standard Settlement Instructions"
              icon="📋"
            />

            <ProtectedLandingCard
              href="/code-mappings"
              title="Code Mappings"
              description="Cross-system code translation (e.g., ALERT code &quot;SWE&quot; → ISO country code &quot;SE&quot;)"
              icon="🔄"
            />
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">📡</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Acquisition & Processing</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">External data ingestion and processing pipelines</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LEIStatusCard />

            <div className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-purple-500 dark:hover:border-purple-400 cursor-not-allowed opacity-50 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1 min-w-0">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                    Data Import 🔒
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4 break-words whitespace-normal">
                    Manual data import and validation tools
                  </p>
                  <div className="mt-auto">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded">Coming Soon</span>
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
