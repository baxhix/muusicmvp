import Script from 'next/script';

/**
 * Google Analytics 4 (gtag.js) loader.
 *
 * Uses `next/script` with `afterInteractive` so the loader is
 * appended after the first paint — analytics never blocks the
 * initial render path, which matters for the resting `/app` view
 * (a player loaded in the browser tab nonstop).
 *
 * The two `<Script>`s match the snippet Google generates:
 *   1) async loader from googletagmanager.com
 *   2) inline init that pushes the `js` + `config` events
 *
 * `dangerouslySetInnerHTML` is required because the inline init
 * declares a `gtag` function — `next/script` only renders inline
 * content via this prop. SPA navigations (App Router pushes) are
 * picked up automatically by GA4's enhanced-measurement listeners,
 * so no manual route hook is needed here.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-2PG52R6WPE';

export default function GoogleAnalytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga-init"
        strategy="afterInteractive"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `,
        }}
      />
    </>
  );
}
