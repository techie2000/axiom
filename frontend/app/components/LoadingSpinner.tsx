interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-20">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-4 theme-spinner"
            role="status"
            aria-label={message}
          ></div>
          <p className="mt-4 theme-text-muted">{message}</p>
        </div>
      </div>
    </div>
  )
}
