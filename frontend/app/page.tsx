import Link from 'next/link'
import ThemeToggle from './components/ThemeToggle'
import LEIStatusCard from './components/LEIStatusCard'
import LEIRecordsCard from './components/LEIRecordsCard'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">Axiom</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Financial Services Static Data Management System
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Public Reference Data Section */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">🌍</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Public Reference Data</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Publicly accessible ISO standards and reference data</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            <Link href="/countries" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-green-500 dark:hover:border-green-400 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400">
                    Countries →
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
                    Browse ISO 3166 country codes and reference data
                  </p>
                  <div className="flex gap-2 mt-auto">
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">ISO 3166</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">Public</span>
                  </div>
                </div>
                <span className="text-3xl ml-4">🗺️</span>
              </div>
            </Link>

            <Link href="/currencies" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-green-500 dark:hover:border-green-400 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400">
                    Currencies →
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
                    Browse ISO 4217 currency codes and symbols
                  </p>
                  <div className="flex gap-2 mt-auto">
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">ISO 4217</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">Public</span>
                  </div>
                </div>
                <span className="text-3xl ml-4">💱</span>
              </div>
            </Link>

            <LEIRecordsCard />
          </div>
        </section>

        {/* Master Data Management Section */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">📊</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Master Data Management</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Core financial entities and reference data • Authentication required</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/instruments" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-blue-500 dark:hover:border-blue-400 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400">
                    Instruments →
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
                    Securities, bonds, and derivatives
                  </p>
                  <div className="mt-auto">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">Protected</span>
                  </div>
                </div>
                <span className="text-3xl ml-4">🎯</span>
              </div>
            </Link>

            <Link href="/accounts" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-blue-500 dark:hover:border-blue-400 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400">
                    Accounts →
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
                    Trading accounts and settlement instructions
                  </p>
                  <div className="mt-auto">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">Protected</span>
                  </div>
                </div>
                <span className="text-3xl ml-4">🏦</span>
              </div>
            </Link>

            <Link href="/ssi" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-blue-500 dark:hover:border-blue-400 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400">
                    SSI →
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
                    Standard Settlement Instructions
                  </p>
                  <div className="mt-auto">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">Protected</span>
                  </div>
                </div>
                <span className="text-3xl ml-4">📋</span>
              </div>
            </Link>

            <Link href="/code-mappings" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-blue-500 dark:hover:border-blue-400 min-h-[240px] flex flex-col">
              <div className="flex items-stretch justify-between flex-1">
                <div className="flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400">
                    Code Mappings →
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
                    Cross-system code translation (e.g., ALERT code &quot;SWE&quot; → ISO country code &quot;SE&quot;)
                  </p>
                  <div className="flex gap-2 mt-auto">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">Protected</span>
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs rounded">Integration</span>
                  </div>
                </div>
                <span className="text-3xl ml-4">🔄</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Data Acquisition Section */}
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
                <div className="flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                    Data Import 🔒
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
                    Manual data import and validation tools
                  </p>
                  <div className="mt-auto">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded">Coming Soon</span>
                  </div>
                </div>
                <span className="text-3xl ml-4">📥</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
