import React from 'react'

interface ContextDocsLinkProps {
  href: string
  label: string
  /**
   * Optional text-only label used for accessibility attributes.
   * When provided, this will be used for aria-label and title,
   * allowing the visible label to be emoji-only or formatted.
   */
  accessibleLabel?: string
}

export default function ContextDocsLink({
  href,
  label,
  accessibleLabel,
}: ContextDocsLinkProps) {
  const effectiveLabel = accessibleLabel ?? label

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="h-9 px-3 inline-flex items-center rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors text-sm font-medium whitespace-nowrap"
      aria-label={effectiveLabel}
      title={effectiveLabel}
    >
      {label}
    </a>
  )
}
