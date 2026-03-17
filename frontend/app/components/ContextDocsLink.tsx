import React from 'react'

interface ContextDocsLinkProps {
  href: string
  label?: string
}

export default function ContextDocsLink({
  href,
  label = 'Documentation',
}: ContextDocsLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-2 rounded-lg border-2 border-blue-500/40 text-blue-300 hover:text-blue-200 hover:border-blue-400/60 transition-colors text-sm font-medium"
      aria-label={label}
      title={label}
    >
      {label}
    </a>
  )
}
