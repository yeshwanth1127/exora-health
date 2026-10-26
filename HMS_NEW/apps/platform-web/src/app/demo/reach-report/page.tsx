import type { Metadata } from "next";
import ReachReportDemo from "./reach-report-demo";
import BusinessReport from "../../business-report/report";
import type { ReachReport } from "../../../lib/reach-report";
import example from "./example-report.json";
import partial from "./partial-report.json";
import missing from "./no-website-report.json";
import { rankPreview } from "./rank-preview";
export const metadata: Metadata = { title: "Reach report preview", robots: { index: false, follow: false } };
export default async function Page({searchParams}: {searchParams: Promise<{state?:string}>}) {
  if (process.env.CAPTURE_STATIC_EXPORT === "1") return <ReachReportDemo />;
  const {state}=await searchParams;
  return <BusinessReport rankPreview={rankPreview} initialReport={(state === "partial" ? partial : state === "no-website" ? missing : example) as ReachReport} />;
}
