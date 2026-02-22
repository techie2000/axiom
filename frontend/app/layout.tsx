import type { Metadata } from 'next'
import './globals.css'
import Footer from './components/Footer'

export const metadata: Metadata = {
  title: 'Axiom - Financial Services Static Data',
  description: 'Financial Services Static Data Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
        <Footer />
      </body>
    </html>
  )
}
