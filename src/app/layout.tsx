import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { UniverseProvider } from '@/lib/universe/UniverseContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorLogger from '@/components/GlobalErrorLogger';
import GoogleAnalytics from '@/components/GoogleAnalytics';
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
    >
      <body>
        <GoogleAnalytics />
        <ErrorBoundary>
          <GlobalErrorLogger />
          <AuthProvider>
            <UniverseProvider>{children}</UniverseProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
