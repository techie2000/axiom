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
    <Link href={href} className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-blue-500 dark:hover:border-blue-400 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400" title={titleTooltip}>
            {title} →
          </h3>
          <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4 break-words whitespace-normal" title={descriptionTooltip}>{description}</p>
          <div className="mt-auto">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">Protected</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">{icon}</span>
      </div>
    </Link>
  )
}
