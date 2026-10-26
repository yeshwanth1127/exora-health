import type { Metadata } from "next";
import BusinessReport from "./report";
export const metadata: Metadata = { title: "Business report", robots: { index: false, follow: false } };
export default function Page() { return <BusinessReport />; }
