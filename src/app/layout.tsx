import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { UniverseProvider } from '@/lib/universe/UniverseContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorLogger from '@/components/GlobalErrorLogger';
import TrackingTags from '@/components/TrackingTags';
import AnalyticsProvider from '@/lib/analytics/AnalyticsProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Fanverse — O universo dos superfãs',
  description:
    'Descubra o que o mundo está ouvindo, em tempo real. Conecte-se com fãs ao seu redor.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${instrumentSerif.variable}`}
      // Suppress hydration warnings caused by browser extensions
      // (Grammarly, password managers, dark-mode tweakers, etc.)
      // that mutate <html>/<body> attributes BEFORE React hydrates.
      // Those external mutations are unavoidable and trigger React
      // error #418 in production builds even when our SSR is clean.
      // suppressHydrationWarning only suppresses the diff on the
      // tagged element + its attributes — children are still
      // hydration-checked normally.
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {/* Pixels e tags de tracking (GA4, Clarity, Meta Pixel,
            etc.) — next/script com strategy="afterInteractive"
            injeta os scripts no DOM real (head, na prática), sem
            bloquear o first paint. Renderizado dentro de <body>
            porque o App Router do Next 15 gerencia <head> via
            metadata API; declarar <head> manualmente aqui causou
            hydration mismatch (React error #418). */}
        <TrackingTags />
        <ErrorBoundary>
          <GlobalErrorLogger />
          <AuthProvider>
            {/* Analytics has to live INSIDE AuthProvider so it can
                read the current user for identify(). It's a
                side-effect-only component — renders nothing.
                The PostHog key is resolved CLIENT-SIDE inside the
                provider (env first, /api/site-tags/public as
                fallback) so the root layout stays synchronous and
                static pre-rendering of /app keeps working. */}
            <AnalyticsProvider />
            <UniverseProvider>{children}</UniverseProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
