'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

/**
 * Renders every enabled tracking tag configured under
 * /admin/settings → Tags. This is a CLIENT component on purpose:
 * if it were a server component reading from DB, the layout would
 * have to be `async`, which forces every route to opt out of
 * static pre-rendering. With `/app` being heavily client-side and
 * pre-rendered statically, mixing in an async layout caused
 * hydration mismatches (React error #418).
 *
 * Trade-off: tags load slightly later (a single GET /api/site-tags/public
 * + script injection after first paint). Acceptable because all
 * snippets already use next/script `afterInteractive` strategy
 * anyway — the wire latency added here is one round-trip.
 *
 * Adding a new kind:
 *   1. Add it to KNOWN_TAG_KINDS in src/server/admin/tags.ts
 *   2. Extend the CHECK constraint in a migration
 *   3. Add a case in renderTag() below
 *   4. Add a label/placeholder in the admin Tags tab
 */
export default function TrackingTags() {
  const [tags, setTags] = useState<{ kind: string; value: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/site-tags/public', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { tags?: { kind: string; value: string }[] }) => {
        if (cancelled) return;
        let next = data.tags ?? [];
        // ENV fallback for the GA tag — keeps analytics live the
        // first time this component ships, before the admin Tags
        // module is filled.
        if (
          !next.some((t) => t.kind === 'analytics') &&
          process.env.NEXT_PUBLIC_GA_ID
        ) {
          next = [
            ...next,
            { kind: 'analytics', value: process.env.NEXT_PUBLIC_GA_ID },
          ];
        }
        setTags(next);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('TrackingTags: tag fetch failed', err);
        // Env fallback still tries to keep GA alive if it's set.
        const fallback: { kind: string; value: string }[] = [];
        if (process.env.NEXT_PUBLIC_GA_ID) {
          fallback.push({ kind: 'analytics', value: process.env.NEXT_PUBLIC_GA_ID });
        }
        setTags(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!tags || tags.length === 0) return null;

  return (
    <>
      {tags.map((t) => renderTag(t.kind, t.value))}
    </>
  );
}

function renderTag(kind: string, value: string): React.ReactNode {
  switch (kind) {
    case 'analytics':
      // Google Analytics 4 (gtag.js)
      return (
        <Script
          key="ga"
          id="ga-init"
          strategy="afterInteractive"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var s=document.createElement('script');
                s.async=true;
                s.src='https://www.googletagmanager.com/gtag/js?id=${value}';
                document.head.appendChild(s);
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${value}');
              })();
            `,
          }}
        />
      );

    case 'gtm':
      // Google Tag Manager — async loader + dataLayer init.
      return (
        <Script
          key="gtm"
          id="gtm-init"
          strategy="afterInteractive"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${value}');
            `,
          }}
        />
      );

    case 'facebook':
      // Meta (Facebook) Pixel.
      return (
        <Script
          key="fbq"
          id="fbq-init"
          strategy="afterInteractive"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${value}');
              fbq('track', 'PageView');
            `,
          }}
        />
      );

    case 'clarity':
      // Microsoft Clarity.
      return (
        <Script
          key="clarity"
          id="clarity-init"
          strategy="afterInteractive"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${value}");
            `,
          }}
        />
      );

    case 'tiktok':
      // TikTok Pixel.
      return (
        <Script
          key="ttq"
          id="ttq-init"
          strategy="afterInteractive"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
                ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
                ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
                for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
                ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
                ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
                ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
                ttq._o=ttq._o||{};ttq._o[e]=n||{};
                var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
                var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('${value}');
                ttq.page();
              }(window, document, 'ttq');
            `,
          }}
        />
      );

    case 'hotjar':
      // Hotjar — value is the numeric HJID.
      return (
        <Script
          key="hj"
          id="hj-init"
          strategy="afterInteractive"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:${JSON.stringify(Number(value) || 0)},hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `,
          }}
        />
      );

    default:
      return null;
  }
}
