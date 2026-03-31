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
      className="theme-header-action rounded-lg theme-btn-neutral theme-focus transition-colors"
      aria-label={effectiveLabel}
      title={effectiveLabel}
    >
      {label}
    </a>
  )
}
