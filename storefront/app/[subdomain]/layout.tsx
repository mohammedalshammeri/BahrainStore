import type { StorePublic } from "@/lib/types";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageViewTracker } from "@/components/ui/page-view-tracker";
import { FlashSaleBanner } from "@/components/ui/flash-sale-banner";
import { PopupDisplay } from "@/components/ui/popup-display";
import { CountdownTimerBanner } from "@/components/ui/countdown-timer-banner";
import { PreviewThemeBridge } from "@/components/theme/PreviewThemeBridge";
import { notFound } from "next/navigation";
import { getPublicPixels, getPublicStore, type StorePixels } from "@/lib/storefront-server";

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
function safeColor(value: string | undefined, fallback: string) {
  return value && HEX_RE.test(value) ? value : fallback;
}

export default async function StoreLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subdomain } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [store, pixels] = await Promise.all([
    getPublicStore(subdomain).catch(() => null),
    getPublicPixels(subdomain),
  ]);

  if (!store) notFound();

  const primaryColor = safeColor(store.settings?.primaryColor, "#2563eb");
  const secondaryColor = safeColor(store.settings?.secondaryColor, "#f97316");
  const fontFamily = store.settings?.fontFamily ?? "Cairo";
  const theme = store.settings?.theme ?? "default";
  const previewEnabled = resolvedSearchParams.__builderPreview === "1";
  const previewOrigin = typeof resolvedSearchParams.__builderOrigin === "string" ? resolvedSearchParams.__builderOrigin : undefined;

  return (
    <>
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

      <PreviewThemeBridge
        previewEnabled={previewEnabled}
        previewOrigin={previewOrigin}
        initialSettings={{
          primaryColor,
          secondaryColor,
          fontFamily,
          themeVariant: theme,
        }}
      >
        <PageViewTracker storeId={store.id} />
        <FlashSaleBanner subdomain={subdomain} />
        <CountdownTimerBanner storeId={store.id} />
        <PopupDisplay subdomain={subdomain} />
        <Navbar store={store} />
        <main className="flex-1">{children}</main>
        <Footer store={store} />
      </PreviewThemeBridge>
    </>
  );
}
