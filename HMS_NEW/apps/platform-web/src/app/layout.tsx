import { BRAND_NAME } from "../lib/brand";
import MarketingMotion from "./components/marketing-motion";
import "./product-showcase-menu.css";
import "./reference-fixes.css";
import ReferenceInteractions from "./ReferenceInteractions";
import "./globals.css";
import "./brand.css";
import "./flow-brand.css";
import "./launch-polish.css";
import type { ReactNode } from "react";
import { SITE_ORIGIN } from "../lib/site";
import { pageMetadata, organisationGraph, jsonLd } from "../lib/seo";
import WebsiteAnalytics from "./components/website-analytics";
import { connection } from "next/server";

export const metadata = { ...pageMetadata('/'), referrer: 'strict-origin-when-cross-origin' as const, metadataBase: SITE_ORIGIN ? new URL(SITE_ORIGIN) : undefined,
 verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined, other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined },
 icons: { icon: [{ url: '/capture-bell-icon-v3.png', type: 'image/png' }], apple: '/capture-bell-icon-v3.png' } };


export default async function RootLayout({ children }: { children: ReactNode }) {
  // Production pages render for each request. The explicit export build remains
  // available for static-hosting previews and never calls request-only APIs.
  if (process.env.CAPTURE_STATIC_EXPORT !== "1") await connection();
  return (
    <html lang="en-IN">
      <head />
      <body className="cn0">
        {organisationGraph() && <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(organisationGraph())}}/>}{children}<WebsiteAnalytics/><ReferenceInteractions /><MarketingMotion />
      </body>
    </html>
  );
}
