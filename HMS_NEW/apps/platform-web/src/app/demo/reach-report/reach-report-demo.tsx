"use client";
import { useEffect, useState } from "react";
import BusinessReport from "../../business-report/report";
import type { ReachReport } from "../../../lib/reach-report";
import example from "./example-report.json";
import partial from "./partial-report.json";
import missing from "./no-website-report.json";
import { rankPreview } from "./rank-preview";
export default function ReachReportDemo() {
  const [state, setState] = useState("");
  useEffect(() => { setState(new URLSearchParams(window.location.search).get("state") || ""); }, []);
  return <BusinessReport key={state} rankPreview={rankPreview} initialReport={(state === "partial" ? partial : state === "no-website" ? missing : example) as ReachReport} />;
}
