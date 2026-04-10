'use client'

import { useEffect, useState } from 'react'

import { buildFooterVersionTooltip, type FooterVersionInfo } from './footerVersion'

const ENV_STYLES: Record<string, { label: string; badge: string }> = {
  dev: {
    label: 'DEV',
    badge: 'theme-btn-primary',
  },
  uat: {
    label: 'UAT',
    badge: 'theme-btn-neutral',
  },
  main: {
    label: 'MAIN',
    badge: 'theme-btn-neutral',
  },
  prod: {
    label: 'PROD',
    badge: 'theme-btn-neutral',
  },
}

export default function Footer() {
  const [versionInfo, setVersionInfo] = useState<FooterVersionInfo>({ version: 'loading...' })

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const API_BASE_URL = typeof window !== 'undefined'
          ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
          : 'http://backend:8080'

        const response = await fetch(`${API_BASE_URL}/version`)
        if (response.ok) {
          const data = await response.json()
          setVersionInfo({
            version: data.version ?? 'unknown',
            gitCommit: data.gitCommit,
            buildDate: data.buildDate,
          })
        } else {
          setVersionInfo({ version: 'unknown' })
        }
      } catch (error) {
        console.error('Failed to fetch version:', error)
        setVersionInfo({ version: 'unknown' })
      }
    }

    fetchVersion()
  }, [])

  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev'
  const envStyle = ENV_STYLES[env] ?? { label: env.toUpperCase(), badge: 'theme-btn-neutral' }
  const versionTooltip = buildFooterVersionTooltip(versionInfo)

  return (
    <footer className="fixed bottom-0 right-0 flex items-center gap-2 px-3 py-1 theme-panel theme-text-muted text-xs rounded-tl-md border-t border-l border-[rgb(var(--border-rgb))] z-10">
      <span className={`px-1.5 py-0.5 rounded font-bold tracking-wide ${envStyle.badge}`}>
        {envStyle.label}
      </span>
      <span className={versionTooltip ? 'cursor-help' : undefined} title={versionTooltip}>
        Axiom v{versionInfo.version}
      </span>
    </footer>
  )
}
