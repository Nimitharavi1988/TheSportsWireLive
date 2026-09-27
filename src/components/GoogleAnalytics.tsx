import Script from "next/script";

// Dormant until NEXT_PUBLIC_GA_MEASUREMENT_ID is set (get one free at
// analytics.google.com — create a GA4 property, add a "Web" data stream,
// copy the Measurement ID, looks like "G-XXXXXXXXXX"). Renders nothing
// until then, so this is safe to ship ahead of actually having an ID.
//
// lazyOnload (was afterInteractive): the 172 KB gtag script loads after the
// page has, when the browser is idle, instead of competing with the first
// paint (2026-09-27). A visit that leaves within a second or two may go
// uncounted.
export default function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="lazyOnload" />
      <Script id="ga4-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
