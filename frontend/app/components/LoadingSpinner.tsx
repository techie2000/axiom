interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-20">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"
            role="status"
            aria-label={message}
          ></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">{message}</p>
        </div>
      </div>
    </div>
  )
}
