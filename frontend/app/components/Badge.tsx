import React from 'react'

type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple' | 'gray' | 'default'
type BadgeShape = 'rounded' | 'pill'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  shape?: BadgeShape
  mono?: boolean
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  blue:    'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  green:   'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  red:     'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  yellow:  'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  orange:  'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  purple:  'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  gray:    'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
}

const shapeClasses: Record<BadgeShape, string> = {
  rounded: 'rounded',
  pill:    'rounded-full',
}

export default function Badge({
  children,
  variant = 'default',
  shape = 'rounded',
  mono = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'px-2 py-1 text-xs font-medium',
        variantClasses[variant],
        shapeClasses[shape],
        mono ? 'font-mono' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
