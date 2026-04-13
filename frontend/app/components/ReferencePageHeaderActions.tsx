import { ReactNode } from 'react'

interface ReferenceToggleAction {
  isActive: boolean
  activeTitle?: string
  inactiveTitle?: string
  activeLabel: string
  inactiveLabel: string
  onToggle: () => void
}

interface ReferencePageHeaderActionsProps {
  effectiveExpandedWidth: boolean
  normalTitle?: string
  expandTitle?: string
  normalLabel: string
  expandLabel: string
  saveWidthTitle?: string
  saveWidthLabel: string
  hasUnsavedWidthChanges: boolean
  onToggleExpandedWidth: () => void
  onSaveExpandedWidth: () => void
  formatLabel: (label: string) => string
  secondaryToggle?: ReferenceToggleAction
  children?: ReactNode
}

export default function ReferencePageHeaderActions({
  effectiveExpandedWidth,
  normalTitle,
  expandTitle,
  normalLabel,
  expandLabel,
  saveWidthTitle,
  saveWidthLabel,
  hasUnsavedWidthChanges,
  onToggleExpandedWidth,
  onSaveExpandedWidth,
  formatLabel,
  secondaryToggle,
  children,
}: ReferencePageHeaderActionsProps) {
  return (
    <>
      <button
        onClick={onToggleExpandedWidth}
        className="theme-header-action rounded-lg theme-btn-neutral theme-focus"
        title={effectiveExpandedWidth ? normalTitle : expandTitle}
        aria-label={effectiveExpandedWidth ? normalLabel : expandLabel}
      >
        {effectiveExpandedWidth ? formatLabel(normalLabel) : formatLabel(expandLabel)}
      </button>

      {hasUnsavedWidthChanges && (
        <button
          onClick={onSaveExpandedWidth}
          className="theme-header-action rounded-lg theme-btn-primary theme-focus"
          title={saveWidthTitle}
        >
          {formatLabel(saveWidthLabel)}
        </button>
      )}

      {secondaryToggle && (
        <button
          onClick={secondaryToggle.onToggle}
          className="theme-header-action rounded-lg theme-btn-neutral theme-focus"
          title={secondaryToggle.isActive ? secondaryToggle.activeTitle : secondaryToggle.inactiveTitle}
          aria-label={secondaryToggle.isActive ? secondaryToggle.activeLabel : secondaryToggle.inactiveLabel}
        >
          {formatLabel(secondaryToggle.isActive ? secondaryToggle.activeLabel : secondaryToggle.inactiveLabel)}
        </button>
      )}

      {children}
    </>
  )
}