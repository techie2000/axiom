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
  blue:    'theme-status-info',
  green:   'theme-status-success',
  red:     'theme-status-danger',
  yellow:  'theme-status-warning',
  orange:  'theme-status-warning',
  purple:  'theme-status-info',
  gray:    'theme-status-neutral',
  default: 'theme-status-neutral',
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
