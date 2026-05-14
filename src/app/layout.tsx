import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { UniverseProvider } from '@/lib/universe/UniverseContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorLogger from '@/components/GlobalErrorLogger';
import TrackingTags from '@/components/TrackingTags';
import AnalyticsProvider from '@/lib/analytics/AnalyticsProvider';
import { getActiveSiteTags } from '@/server/admin/tags';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the PostHog key + host from the DB-driven site tags
  // (set in /admin/settings → Tags). Falls back to env vars when
  // the admin hasn't filled in the row yet. Cached for 60s
  // in-process so the layout pays this cost at most once a minute
  // per Node process.
  const activeTags = await getActiveSiteTags().catch(() => []);
  const posthogKey = activeTags.find((t) => t.kind === 'posthog')?.value;

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${instrumentSerif.variable}`}
    >
      <head>
        {/* Pixels e tags de tracking (GA4, Clarity, Meta Pixel,
            etc.) carregam no <head> via next/script
            afterInteractive — mesma estratégia que o snippet
            oficial do Clarity/GA, sem bloquear o first paint. As
            tags ativas vêm do site_tags (admin Tags) ou de env
            como fallback. */}
        <TrackingTags />
      </head>
      <body>
        <ErrorBoundary>
          <GlobalErrorLogger />
          <AuthProvider>
            {/* Analytics has to live INSIDE AuthProvider so it can
                read the current user for identify(). It's a
                side-effect-only component — renders nothing.
                The PostHog key comes from the admin Tags module
                (DB) with NEXT_PUBLIC_POSTHOG_KEY as a fallback. */}
            <AnalyticsProvider posthogKey={posthogKey} />
            <UniverseProvider>{children}</UniverseProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
