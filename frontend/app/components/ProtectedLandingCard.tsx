import Link from 'next/link'

interface ProtectedLandingCardProps {
  href: string
  title: string
  description: string
  icon: string
  titleTooltip?: string
  descriptionTooltip?: string
}

export default function ProtectedLandingCard({ href, title, description, icon, titleTooltip, descriptionTooltip }: ProtectedLandingCardProps) {
  return (
    <Link href={href} className="group theme-panel theme-card-hover border-2 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 theme-card-title" title={titleTooltip}>
            {title} →
          </h3>
          <p className="theme-text-muted flex-1 mb-4 break-words whitespace-normal" title={descriptionTooltip}>{description}</p>
          <div className="mt-auto">
            <span className="px-2 py-1 theme-subtle text-xs rounded">Protected</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">{icon}</span>
      </div>
    </Link>
  )
}
