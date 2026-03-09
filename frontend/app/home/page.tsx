import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'

const publicModules = [
  { href: '/lei', label: 'LEI Records' },
  { href: '/lei-records', label: 'LEI Import Status' },
  { href: '/countries', label: 'Countries' },
  { href: '/currencies', label: 'Currencies' },
  { href: '/languages', label: 'Languages' },
]

export default function PublicHomePage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400 text-sm font-medium">
            ← Back to Landing
          </Link>
          <ThemeToggle />
        </div>

        <section className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-2xl shadow-lg p-7 md:p-9">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Public Reference Data</h1>
          <p className="mt-3 text-gray-700 dark:text-gray-200">
            Browse publicly available static reference datasets without signing in.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {publicModules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="rounded-lg border-2 border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 px-4 py-3 font-medium text-gray-900 dark:text-white hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
              >
                {module.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
