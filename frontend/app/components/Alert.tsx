import React from 'react'

type AlertVariant = 'info' | 'warning' | 'error' | 'success'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<AlertVariant, { wrapper: string; text: string }> = {
  info: {
    wrapper: 'theme-status-info',
    text:    'theme-status-text-info',
  },
  warning: {
    wrapper: 'theme-status-warning',
    text:    'theme-status-text-warning',
  },
  error: {
    wrapper: 'theme-status-danger',
    text:    'theme-status-text-danger',
  },
  success: {
    wrapper: 'theme-status-success',
    text:    'theme-status-text-success',
  },
}

export default function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const { wrapper, text } = variantClasses[variant]
  return (
    <div className={`p-4 rounded-lg border ${wrapper} ${className}`}>
      <div className={`text-sm ${text}`}>
        {title && <span className="font-semibold">{title} </span>}
        {children}
      </div>
    </div>
  )
}
