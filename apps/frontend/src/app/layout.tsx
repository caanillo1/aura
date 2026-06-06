import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'AURA ERP – Sistemas Infotec',
    template: '%s | AURA ERP',
  },
  description: 'Plataforma de gestión integral de implementaciones de software hospitalario',
  applicationName: 'AURA ERP',
  authors: [{ name: 'Sistemas Infotec' }],
  keywords: ['ERP', 'implementaciones', 'hospitalario', 'gestión', 'proyectos'],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AURA ERP',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192' },
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'AURA ERP',
    title: 'AURA ERP – Sistemas Infotec',
    description: 'Plataforma de gestión integral de implementaciones hospitalarias',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#060d1c' },
    { media: '(prefers-color-scheme: light)', color: '#5a8fd0' },
  ],
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: 'dark light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Skip navigation – WCAG 2.1 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-600 focus:text-white focus:font-semibold focus:shadow-lg focus:outline-none"
        >
          Ir al contenido principal
        </a>

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          themes={['dark', 'light']}
        >
          <QueryProvider>
            <main id="main-content">
              {children}
            </main>
            <Toaster
              position="top-right"
              richColors
              toastOptions={{
                duration: 4000,
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
