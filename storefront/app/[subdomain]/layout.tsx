import { api } from "@/lib/api";
import type { StorePublic } from "@/lib/types";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageViewTracker } from "@/components/ui/page-view-tracker";
import { FlashSaleBanner } from "@/components/ui/flash-sale-banner";
import { PopupDisplay } from "@/components/ui/popup-display";
import { CountdownTimerBanner } from "@/components/ui/countdown-timer-banner";
import { notFound } from "next/navigation";

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
function safeColor(value: string | undefined, fallback: string) {
  return value && HEX_RE.test(value) ? value : fallback;
}

const FONT_URLS: Record<string, string> = {
  Cairo: "Cairo:wght@400;500;600;700",
  Tajawal: "Tajawal:wght@400;500;700",
  "Noto Sans Arabic": "Noto+Sans+Arabic:wght@400;500;700",
  "Readex Pro": "Readex+Pro:wght@400;500;700",
};

interface StorePixels {
  googleTagId?: string | null;
  facebookPixelId?: string | null;
  tiktokPixelId?: string | null;
  snapchatPixelId?: string | null;
  googleAdsId?: string | null;
}

async function getStore(subdomain: string): Promise<StorePublic | null> {
  try {
    const res = await api.get(`/stores/s/${subdomain}`);
    return res.data.store;
  } catch {
    return null;
  }
}

async function getPixels(subdomain: string): Promise<StorePixels> {
  try {
    const res = await api.get(`/marketing/public/${subdomain}/pixels`);
    return res.data as StorePixels;
  } catch {
    return {};
  }
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const [store, pixels] = await Promise.all([getStore(subdomain), getPixels(subdomain)]);

  if (!store) notFound();

  const primaryColor = safeColor(store.settings?.primaryColor, "#2563eb");
  const secondaryColor = safeColor(store.settings?.secondaryColor, "#f97316");
  const fontFamily = store.settings?.fontFamily ?? "Cairo";
  const theme = store.settings?.theme ?? "default";
  const fontUrl = FONT_URLS[fontFamily] ?? FONT_URLS["Cairo"];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${fontUrl}&display=swap`}
      />
      <style>{`:root{--store-primary:${primaryColor};--store-secondary:${secondaryColor};}body{font-family:'${fontFamily}',sans-serif;}`}</style>

      {/* Marketing Pixels */}
      {pixels.googleTagId && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${pixels.googleTagId}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${pixels.googleTagId}');` }} />
        </>
      )}
      {pixels.facebookPixelId && (
        <script dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixels.facebookPixelId}');fbq('track','PageView');` }} />
      )}
      {pixels.tiktokPixelId && (
        <script dangerouslySetInnerHTML={{ __html: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixels.tiktokPixelId}');ttq.page();}(window,document,'ttq');` }} />
      )}
      {pixels.snapchatPixelId && (
        <script dangerouslySetInnerHTML={{ __html: `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${pixels.snapchatPixelId}');snaptr('track','PAGE_VIEW');` }} />
      )}

      <div className="flex flex-col min-h-screen" data-theme={theme}>
        <PageViewTracker storeId={store.id} />
        <FlashSaleBanner subdomain={subdomain} />
        <CountdownTimerBanner storeId={store.id} />
        <PopupDisplay subdomain={subdomain} />
        <Navbar store={store} />
        <main className="flex-1">{children}</main>
        <Footer store={store} />
      </div>
    </>
  );
}
