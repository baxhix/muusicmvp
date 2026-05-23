import type { Metadata, Viewport } from 'next';
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

/**
 * Viewport meta. Plain `device-width` + `initial-scale: 1` so
 * iOS Safari renders at the device's natural CSS pixel ratio
 * without any custom widget layout hints.
 *
 * We DELIBERATELY don't set `interactive-widget: resizes-content`
 * here — earlier iOS builds were applying the layout-resize
 * behavior even outside of keyboard focus, which inflated the
 * apparent size of every fixed-position element on the mobile
 * home view. The LiveChatPanel composer keyboard handling
 * doesn't need this meta anyway; it has a dedicated
 * `window.visualViewport.resize` subscription that writes
 * `--chat-visual-h` / `--chat-visual-top` CSS vars onto the
 * panel element while open, which works across every browser
 * we care about (iOS 16.4+, modern Chromium, Firefox).
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Force every route to render on the server at request time
 * instead of being pre-rendered statically at build time.
 *
 * Why: /app is a complex client component with lots of dynamic
 * state (auth, live users, conversations, feed posts). Static
 * pre-rendering it works MOST of the time, but small drifts
 * between build-time HTML and runtime client expectations were
 * triggering React hydration mismatches (#418). Switching to
 * dynamic rendering guarantees the HTML React expects to hydrate
 * is generated from the SAME code path the client is about to
 * run — no drift possible.
 *
 * Cost: ~30-80ms TTFB on first hit per request vs ~0ms for
 * pre-rendered. The /app player loads once per session and stays
 * open, so the tradeoff is worth the correctness guarantee.
 */
export const dynamic = 'force-dynamic';

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
        {/* Welcome bootstrap — roda SINCRONAMENTE durante o
            parse do HTML, antes da hidratação do React. Lê
            ?welcome=1|back e marca data-welcome no <html> pra
            que o CSS (em app/layout.module.css) esconda todos
            os elementos .welcomeFade ANTES do primeiro paint.
            Sem isso, o SSR renderiza com stage=5 (sem window),
            o cliente quer stage=0, e a hydration mismatch
            cancela a animação — os elementos aparecem instantâneos
            em vez de fadear. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var w=new URLSearchParams(window.location.search).get('welcome');if(w==='1'||w==='back'){document.documentElement.setAttribute('data-welcome',w);}}catch(e){}})();",
          }}
        />
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
