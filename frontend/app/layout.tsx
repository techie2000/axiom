import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import Footer from './components/Footer'
import I18nProvider from './components/I18nProvider'
import PreferenceSaveErrorToast from './components/PreferenceSaveErrorToast'

export const metadata: Metadata = {
  title: 'Axiom - Financial Services Static Data',
  description: 'Financial Services Static Data Management System',
  icons: {
    icon: [{ url: '/branding/favicon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="axiom-theme-bootstrap" strategy="beforeInteractive">
          {`(function(){
  try {
    var doc = document.documentElement;
    var themes = ['default', 'modern-minimal', 'supabase', 'perpetuity', 'twitter'];
    var read = function(key){
      try { return localStorage.getItem(key); } catch (_) { return null; }
    };
    var storedTheme = read('axiom_pref::global::theme') || read('theme') || 'default';
    var theme = themes.indexOf(storedTheme) >= 0 ? storedTheme : 'default';
    doc.setAttribute('data-theme', theme);

    var storedMode = read('axiom_pref::global::dark_mode') || read('darkMode') || 'dark';
    doc.classList.toggle('dark', storedMode !== 'light');
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'default');
    document.documentElement.classList.add('dark');
  }
})();`}
        </Script>
        <I18nProvider>
          {children}
          <PreferenceSaveErrorToast />
          <Footer />
        </I18nProvider>
      </body>
    </html>
  )
}
