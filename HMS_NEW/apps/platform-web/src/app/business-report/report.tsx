"use client";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowUpRight, CheckCircle2, CircleDashed, ChevronDown, CircleHelp, Search } from "lucide-react";
import { businessLookup } from "../../lib/business-lookup";
import type { CheckStatus, ReachCheck, ReachReport } from "../../lib/reach-report";
import { BRAND_NAME } from "../../lib/brand";
import { Gauge } from "../components/arc-report/gauge/gauge";
import { ProgressDonut } from "../components/arc-report/progress-donut/progress-donut";
import { BottomSheet } from "../components/arc-report/bottom-sheet/bottom-sheet";
import { Popover, PopoverTrigger, PopoverContent } from "../components/arc-report/popover/popover";
import type { ReactNode } from "react";
import PracticeCta from "../components/practice-cta";
import { ClinicWidget } from "./clinic-widget";
import "../components/arc-business/scope.css";
import LocalRankMap, { type RankPreview } from "./local-rank-map";
import "./report.css";

const labels = { pass: "Passed", review: "Needs attention", unknown: "Unassessed" };
const issueLabels: Record<string, string> = {
  google_name: "Business name not returned", google_category: "Business category not returned",
  google_address: "Public address not returned", google_phone: "Public phone not returned",
  google_hours: "Opening hours not returned", google_status: "Listing marked closed",
  https: "Website does not use HTTPS", available: "Homepage needs review",
  viewport: "No mobile viewport found", content: "Little readable text in homepage HTML",
  title: "No page title found", description: "No search description found",
  heading: "No main heading found", indexing: "Indexing restrictions found",
  phone_link: "No direct call or WhatsApp link found", booking: "No booking or enquiry link found",
  contact: "No contact route found",
};
function StatusIcon({ status }: { status: CheckStatus }) {
  const Icon = status === "pass" ? CheckCircle2 : status === "review" ? AlertCircle : CircleDashed;
  return <Icon size={17} aria-hidden="true" />;
}
function EvidenceRow({ item, example }: { item: ReachCheck; example: boolean }) {
  const evidence = example ? item.evidence.replace(/^Example: the /, "The ") : item.evidence;
  return <li className={`reach-check reach-state-${item.status}`}>
    <details>
      <summary>
        <span className="reach-check-icon"><StatusIcon status={item.status} /></span>
        <span className="reach-check-copy"><small className="reach-check-source">{item.category === "google" ? "Google profile" : "Website"}</small><strong>{item.status === "review" ? issueLabels[item.id] || item.label : item.label}</strong><span>{item.status === "review" ? item.fix : item.status === "unknown" ? "Not checked" : evidence}</span></span>
        <ChevronDown className="reach-check-chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="reach-check-detail">
        <p>{evidence}</p>
        <div className="reach-check-meta"><span>{labels[item.status]}</span><span>{item.status === "unknown" ? "Not included in score" : `${item.status === "pass" ? item.weight : 0} of ${item.weight} points`}</span>{item.sourceUrl && !example && <a href={item.sourceUrl} target="_blank" rel="noreferrer">View source <ArrowUpRight size={13} aria-hidden="true" /></a>}</div>
      </div>
    </details>
  </li>;
}

type IssueScope = "all" | "google" | "website";
const scopeLabels = { all: "All sources", google: "Google profile", website: "Website" };
const inScope = (item: ReachCheck, scope: IssueScope) => scope === "all" || (scope === "google" ? item.category === "google" : item.category !== "google");
const byImpact = (a: ReachCheck, b: ReachCheck) => b.weight - a.weight;
function IssueScopes({ scope, onChange, checks }: { scope: IssueScope; onChange: (scope: IssueScope) => void; checks: ReachCheck[] }) {
  return <div className="reach-result-filters" role="group" aria-label="Filter checks by source">{(["all", "google", "website"] as IssueScope[]).map(value => <button key={value} type="button" aria-pressed={scope === value} onClick={() => onChange(value)}>{scopeLabels[value]}<span>{checks.filter(check => inScope(check, value)).length}</span></button>)}</div>;
}
function ChecksSheet({ report, trigger, initialStatus = "review", initialScope = "all" }: { report: ReachReport; trigger: ReactNode; initialStatus?: CheckStatus | "all"; initialScope?: IssueScope }) {
  const [status, setStatus] = useState<CheckStatus | "all">(initialStatus);
  const [scope, setScope] = useState<IssueScope>(initialScope);
  const checks = report.checks.filter(item => (status === "all" || item.status === status) && inScope(item, scope)).sort(byImpact);
  return <BottomSheet trigger={trigger} title="Your full checklist" description="Google profile and linked homepage" detents={[.68]} className="business-arc-scope reach-issues-sheet" onOpenChange={open => { if (open) { setStatus(initialStatus); setScope(initialScope); } }}>
    <div className="reach-result-filters" role="group" aria-label="Filter checks by result">{(["review", "pass", "unknown", "all"] as const).map(value => <button type="button" key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "all" ? "All checks" : value === "unknown" ? "Unavailable" : labels[value]}<span>{value === "all" ? report.totalChecks : report.counts[value]}</span></button>)}</div>
    <IssueScopes scope={scope} onChange={setScope} checks={report.checks.filter(item => status === "all" || item.status === status)} />
    {status === "unknown" && <div className="reach-unassessed-note"><p>{report.website.state !== "checked" ? report.website.message.replace(/^Example: the /, "The ") : "These signals were unavailable in the returned public data. Each row explains why."}</p><span>Excluded from your score · {report.coverage}% of the weighted checklist checked</span></div>}
    <ul className="reach-check-list">{checks.map(item => <EvidenceRow key={item.id} item={item} example={report.example} />)}</ul>
    {!checks.length && <p className="reach-empty">No checks in this group.</p>}
  </BottomSheet>;
}
function ScoreHelp({ report }: { report: ReachReport }) {
  return <div className="reach-score-caption">Reach readiness <Popover><PopoverTrigger className="reach-help-trigger" aria-label="How this score is calculated"><CircleHelp size={16} aria-hidden="true" /></PopoverTrigger><PopoverContent className="business-arc-scope reach-score-help" aria-label="How this score is calculated"><h2>How this score is calculated</h2><p>{report.methodology}</p><p>Unassessed checks are excluded. {report.coverage}% of the weighted checklist was checked.</p><p>Actual Google indexing is not verified.</p><p className="reach-help-date">Rubric {report.version} · Checked {new Date(report.checkedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST</p></PopoverContent></Popover></div>;
}

export default function BusinessReport({ initialReport, rankPreview }: { initialReport?: ReachReport; rankPreview?: RankPreview }) {
  const [report, setReport] = useState<ReachReport | null>(initialReport || null);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<IssueScope>("all");
  useEffect(() => {
    if (initialReport) return;
    const params = new URLSearchParams(window.location.search);
    const controller = new AbortController();
    const id = params.get("place");
    if (!id) { setError("Choose a business from the homepage search."); return; }
    businessLookup({ mode: "report", id, session: params.get("session") || "" }, controller.signal).then(data => {
      if (!data.report) throw new Error("The report could not be completed.");
      if (!controller.signal.aborted) setReport(data.report);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load this business."); });
    return () => controller.abort();
  }, [initialReport]);

  const profile = report?.profile;
  const issues = report?.checks.filter(check => check.status === "review").sort(byImpact) || [];
  const shownChecks = issues.filter(check => inScope(check, scope)).slice(0, 4);
  return <main className="business-report-page">
    <header className="reach-report-header"><a href="/" className="reach-report-brand">{BRAND_NAME}</a><a href="/#business-visibility"><ArrowLeft size={14} aria-hidden="true" /> Find another business</a></header>
    {!report || !profile ? <div className="reach-report-loading" role={error ? "alert" : "status"}>
      {error ? <AlertCircle size={28} aria-hidden="true" /> : <Search size={28} aria-hidden="true" />}
      <h1>{error ? "We couldn’t complete this report." : "Checking your public presence…"}</h1>
      <p>{error || "Looking at your Google profile and, if linked, your website’s homepage."}</p>
      {error && <a href="/#business-visibility">Return to search</a>}
    </div> : <div className="reach-report-content business-arc-scope">
      <section className="reach-report-intro" aria-labelledby="reach-report-name">
        <p className="reach-eyebrow">Your public presence, at a glance</p>
        <h1 id="reach-report-name">{profile.name}</h1>
        <p className="reach-report-location">{profile.address}</p>
        <div className="reach-report-scope"><span>{profile.category || "Public business profile"}</span><span>{report.website.state === "not_linked" ? "Google profile only" : "Google profile + linked website"}</span></div>
      </section>
      {report.websiteIssue && <aside className="reach-website-priority" aria-labelledby="reach-website-priority-title">
        <div><h2 id="reach-website-priority-title">{report.websiteIssue.title}</h2><p>{report.website.state === "not_linked" ? "Customers may miss a direct route to your services and booking." : "Review the linked homepage so customers can take the next step."}</p><details><summary>Why this matters</summary><p>{report.websiteIssue.message}</p><p>{report.websiteIssue.action}</p>{!report.example && <a href={profile.mapsUrl || "https://business.google.com/"} target="_blank" rel="noreferrer">Review your Google profile<ArrowUpRight size={13} aria-hidden="true" /></a>}</details></div>
      </aside>}
      <section className="reach-total" aria-label="Overall reach readiness">
        <ScoreHelp report={report} />
        {report.score !== null ? <Gauge variant="scale" value={report.score} label={report.scoreLabel} detail={`${report.assessedChecks} checks completed`} thresholds={[{ from: 0, tone: "danger", label: "Needs work" }, { from: 50, tone: "warning", label: "Room to improve" }, { from: 80, tone: "success", label: "Good foundations" }]} /> : <p className="reach-score-unknown">Score unavailable</p>}
        <p className="reach-total-note">How easy is it to find your business and take the next step?</p>
        {report.partial && <ChecksSheet report={report} initialStatus="unknown" trigger={<button className="reach-unassessed-link" type="button"><CircleDashed size={14} aria-hidden="true" />{report.counts.unknown} checks unavailable <span>See why<ArrowUpRight size={12} aria-hidden="true" /></span></button>} />}
      </section>
      <section className="reach-category-progress" aria-label="Category scores">
        {report.categories.map(category => <ProgressDonut key={category.key} value={category.score} label={category.label} detail={category.score === null ? "Not checked" : `${category.assessedChecks}/${category.totalChecks} checks completed`} />)}
      </section>
      <div className="reach-findings">
        <section className="reach-evidence" aria-labelledby="reach-evidence-title">
          <div className="reach-evidence-heading"><div><h2 id="reach-evidence-title">{issues.length ? "What to improve" : "Your assessed checks look good"}</h2><p>{issues.length > 4 ? `Top 4 of ${issues.length} issues. Highest impact first.` : "Highest impact first. Expand a row for the evidence."}</p></div><ChecksSheet report={report} initialScope={scope} trigger={<button type="button">Read all</button>} /></div>
          <IssueScopes scope={scope} onChange={setScope} checks={issues} />
          <ul className="reach-check-list">{shownChecks.map(item => <EvidenceRow key={item.id} item={item} example={report.example} />)}</ul>
          {!shownChecks.length && <p className="reach-empty">{scope === "website" && report.website.state !== "checked" ? "Website checks were unavailable. Open the full checklist to see why." : "No issues found in the assessed checks in this group."}</p>}
          {scope === "website" && <p className="reach-indexing-note">Indexing checks detect visible crawl or noindex restrictions; actual Google index status needs Search Console access.</p>}
        </section>
        <ClinicWidget profile={profile} preview={report.example} />
      </div>
      {rankPreview && <LocalRankMap preview={rankPreview} />}
    </div>}
    {report && profile && <PracticeCta text={`See how ${BRAND_NAME} fits your patients, your team and your everyday workflow.`} className="max-w-240 mx-auto mt-16 rounded-2xl" />}
  </main>;
}
