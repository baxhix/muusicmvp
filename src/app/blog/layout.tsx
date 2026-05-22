import type { Metadata } from 'next';
import BlogHeader from '@/components/blog/BlogHeader';
import BlogFooter from '@/components/blog/BlogFooter';
import './blog.css';

/**
 * Layout do blog público. Server component — encapsula header
 * + footer + bg dark scoped (sem afetar outras rotas do app).
 *
 * Metadata default — cada page override com generateMetadata
 * onde precisar (post detail tem og:image/title específicos).
 */
export const metadata: Metadata = {
  title: 'Fanverse Blog',
  description:
    'Histórias do universo dos superfãs — bastidores, lançamentos, cultura e comunidade.',
  openGraph: {
    title: 'Fanverse Blog',
    description:
      'Histórias do universo dos superfãs — bastidores, lançamentos, cultura e comunidade.',
    siteName: 'Fanverse',
    type: 'website',
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="blog-shell">
      <BlogHeader />
      <main className="blog-main">{children}</main>
      <BlogFooter />
    </div>
  );
}
