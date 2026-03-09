import type { Metadata } from 'next'
import './globals.css'
import Footer from './components/Footer'
import PreferenceSaveErrorToast from './components/PreferenceSaveErrorToast'

export const metadata: Metadata = {
  title: 'Axiom - Financial Services Static Data',
  description: 'Financial Services Static Data Management System',
  icons: {
    icon: [
      { url: '/branding/favicon.ico' },
      { url: '/branding/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/branding/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/branding/apple-touch-icon.png',
  },
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
        <PreferenceSaveErrorToast />
        <Footer />
      </body>
    </html>
  )
}
