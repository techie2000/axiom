import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <section className="mb-12">
          <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-2xl shadow-lg p-7 md:p-9">
            <div className="flex items-center gap-4 md:gap-6 mb-7">
              <div className="flex items-center gap-4 md:gap-6">
                <Image
                  src="/branding/logo.svg"
                  alt="Axiom brand"
                  width={96}
                  height={96}
                  className="rounded-xl border border-gray-200 dark:border-white/10 md:w-[108px] md:h-[108px] lg:w-[120px] lg:h-[120px]"
                  priority
                />
                <div>
                  <span className="inline-block mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    Axiom platform
                  </span>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    Axiom
                  </h1>
                  <p className="mt-1.5 text-gray-700 dark:text-gray-200">
                    Financial Services Static Data Management System
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to Axiom
              </h2>
              <p className="text-gray-700 dark:text-gray-200 mb-6">
                Choose where you want to go: sign in for protected features, or browse public
                reference data.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-semibold transition-colors"
              >
                Sign In →
              </Link>
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-md border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 px-6 py-3 font-semibold transition-colors"
              >
                Explore Public Reference Data
              </Link>
            </div>
            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Protected modules are available after sign-in.
            </div>
          </div>
        </section>

        <section>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Looking for public ISO and LEI reference datasets? Continue to{' '}
            <Link href="/home" className="text-blue-500 hover:text-blue-400">
              Public Reference Data
            </Link>
            .
          </div>
        </section>
      </div>
    </main>
  )
}
