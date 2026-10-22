import { BRAND_NAME } from "../lib/brand";
// Semantic page content extracted from recognized recipe sections.

export type TileDataItem = {
  imgSrc: string;
  srcSet: string;
};
export const tileData: TileDataItem[] = [
    { imgSrc: "/assets/capture-illustrations/patient-records-lime.webp", srcSet: "/assets/capture-illustrations/patient-records-lime.webp 1x, /assets/capture-illustrations/patient-records-lime.webp 2x" },
    { imgSrc: "/assets/capture-illustrations/appointments-blue.webp", srcSet: "/assets/capture-illustrations/appointments-blue.webp 1x, /assets/capture-illustrations/appointments-blue.webp 2x" },
    { imgSrc: "/assets/capture-illustrations/care-messaging-coral.webp", srcSet: "/assets/capture-illustrations/care-messaging-coral.webp 1x, /assets/capture-illustrations/care-messaging-coral.webp 2x" },
    { imgSrc: "/assets/capture-illustrations/clinic-team-lime.webp", srcSet: "/assets/capture-illustrations/clinic-team-lime.webp 1x, /assets/capture-illustrations/clinic-team-lime.webp 2x" },
    { imgSrc: "/assets/capture-illustrations/secure-workspace.webp", srcSet: "/assets/capture-illustrations/secure-workspace.webp 1x, /assets/capture-illustrations/secure-workspace.webp 2x" },
    { imgSrc: "/assets/capture-illustrations/care-coordination.webp", srcSet: "/assets/capture-illustrations/care-coordination.webp 1x, /assets/capture-illustrations/care-coordination.webp 2x" },
    { imgSrc: "/assets/capture-illustrations/connected-clinics.webp", srcSet: "/assets/capture-illustrations/connected-clinics.webp 1x, /assets/capture-illustrations/connected-clinics.webp 2x" }
];

export type LogosItem = {
  ariaLabel: string;
  style: import("react").CSSProperties;
  imgSrc: string;
  ariahidden?: import("react").AriaAttributes["aria-hidden"];
};
export const logos: LogosItem[] = [
    { ariaLabel: "Lovable", style: { maskImage: "url(\"/assets/capture-rebrand/capability-3.svg\")" }, imgSrc: "/assets/capture-rebrand/capability-3.svg" },
    { ariaLabel: "goop, Inc.", style: { maskImage: "url(\"/assets/capture-rebrand/capability-4.svg\")" }, imgSrc: "/assets/capture-rebrand/capability-4.svg" },
    { ariaLabel: "Discord", style: { maskImage: "url(\"/assets/capture-rebrand/capability-5.svg\")" }, imgSrc: "/assets/capture-rebrand/capability-5.svg" },
    { ariahidden: "true", ariaLabel: "Dolby Laboratories", style: { maskImage: "url(\"/assets/capture-rebrand/capability-6.svg\")" }, imgSrc: "/assets/capture-rebrand/capability-6.svg" },
    { ariahidden: "true", ariaLabel: "1Password", style: { maskImage: "url(\"/assets/capture-rebrand/capability-0.svg\")" }, imgSrc: "/assets/capture-rebrand/capability-0.svg" },
    { ariahidden: "true", ariaLabel: "L'Oreal", style: { maskImage: "url(\"/assets/capture-rebrand/capability-1.svg\")" }, imgSrc: "/assets/capture-rebrand/capability-1.svg" },
    { ariahidden: "true", ariaLabel: "Volvo", style: { maskImage: "url(\"/assets/capture-rebrand/capability-6.svg\")" }, imgSrc: "/assets/capture-rebrand/capability-6.svg" }
];

export type ProductsItem = {
  variant: string;
  eyebrow: string;
  title: string;
  href: string;
};
export const products: ProductsItem[] = [
    { variant: "bring-everything-into-one-system-of-record", eyebrow: (BRAND_NAME + " knowledge"), title: "Bring everything into one system of record.", href: "/product/features#capture" },
    { variant: "get-answers-instantly-with-citations", eyebrow: "Find answers", title: "Get answers, instantly—with citations.", href: "/product/features#find" },
    { variant: "keep-work-moving-24-7-with-agents", eyebrow: "Automate busywork", title: "Keep work moving 24/7 with agents.", href: "/product/features#automate" }
];

export type Products2Item = {
  variant: string;
  title: string;
  ariaLabel: string;
  href: string;
};
export const products2: Products2Item[] = [
    { variant: "triage-product-feedback", title: "Triage product feedback", ariaLabel: "Triage product feedback", href: "/product/features" },
    { variant: "resolve-support-tickets-in-slack", title: "Resolve support tickets in Slack", ariaLabel: "Resolve support tickets in Slack", href: "/product/features" },
    { variant: "respond-to-security-alerts-faster", title: "Respond to security alerts faster", ariaLabel: "Respond to security alerts faster", href: "/product/features" },
    { variant: "automate-weekly-reporting", title: "Automate weekly reporting", ariaLabel: "Automate weekly reporting", href: "/product/features" },
    { variant: "create-your-own-developer-tools", title: "Create your own developer tools", ariaLabel: "Create your own developer tools", href: "/product/features" }
];

export type ListRowDataItem = {
  href: string;
  label: string;
};
export const listRowData: ListRowDataItem[] = [
    { href: "/product/features", label: "Features" },
    { href: "/releases", label: "What's New" },
    { href: "/product/features", label: "AI reception" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact-sales", label: "Request a demo" },
    { href: "/product/features", label: "Download" }
];

export type ListRowData2Item = {
  href: string;
  label: string;
};
export const listRowData2: ListRowData2Item[] = [
    { href: "/product/features", label: "Customer stories" },
    { href: "/product/features", label: "Connections" },
    { href: "/product/features", label: "Marketplace" },
    { href: "/help", label: "Help Center" },
    { href: "/help", label: "Academy" },
    { href: "/product/features", label: "Community" }
];

export type ListRow2DataItem = {
  href: string;
  label: string;
};
export const listRow2Data: ListRow2DataItem[] = [
    { href: "/product/features", label: "About us" },
    { href: "/product/features", label: "Careers" },
    { href: "/product/features", label: "Security" },
    { href: "/product/features", label: "Status" },
    { href: "/product/features", label: "Terms & privacy" },
    { href: "/product/features", label: "Your privacy rights" }
];

export type ListRowData3Item = {
  href: string;
  label: string;
};
export const listRowData3: ListRowData3Item[] = [
    { href: "/enterprise", label: "For hospitals" },
    { href: "/teams", label: "For clinics" },
    { href: "/product/features", label: "Developers" }
];

export type CtaSectionContentAction = {
  label: string;
  href: string;
  ariaLabel?: string;
};

export type CtaSectionContent = {
  title?: string;
  actions: CtaSectionContentAction[];
};
export const ctaSectionContent: CtaSectionContent = {
  "title": "Get started today.",
  "actions": [
    {
      "label": "Request a demo",
      "href": "/contact-sales"
    }
  ]
};
