import React from 'react'

interface ContextDocsLinkProps {
  href: string
  label: string
}

export default function ContextDocsLink({
  href,
  label,
}: ContextDocsLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-2 rounded-lg border-2 border-blue-600/30 text-blue-700 hover:text-blue-800 hover:border-blue-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors text-sm font-medium dark:border-blue-500/40 dark:text-blue-300 dark:hover:text-blue-200 dark:hover:border-blue-400/60 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-gray-950"
      aria-label={label}
      title={label}
    >
      {label}
    </a>
  )
}
