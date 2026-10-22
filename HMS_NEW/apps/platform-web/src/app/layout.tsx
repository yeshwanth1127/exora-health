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

export const metadata = { title: (BRAND_NAME + " · Care, connected"), description: "Reception, appointments and patient conversations in one connected clinic workspace.", icons: { icon: [{ url: "/capture-bell-icon-v3.png", type: "image/png" }], shortcut: "/capture-bell-icon-v3.png", apple: "/capture-bell-icon-v3.png" }, robots: { index: false, follow: false } };


export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={"en-us"}>
      <head />
      <body className="cn0">
        {children}<ReferenceInteractions /><MarketingMotion />
      </body>
    </html>
  );
}
