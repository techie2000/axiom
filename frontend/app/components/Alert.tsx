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
    wrapper: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    text:    'text-blue-800 dark:text-blue-200',
  },
  warning: {
    wrapper: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    text:    'text-yellow-800 dark:text-yellow-200',
  },
  error: {
    wrapper: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    text:    'text-red-800 dark:text-red-200',
  },
  success: {
    wrapper: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    text:    'text-green-800 dark:text-green-200',
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
