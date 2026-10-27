import type { PublicBusiness } from "./business-lookup";
import type { RankScan } from "./local-ranking";
export type CheckStatus = "pass" | "review" | "unknown";
export type ReachCheck = {
  id: string; category: string; label: string; weight: number;
  status: CheckStatus; severity?: "high" | "normal"; issueTitle?: string; evidence: string; fix: string; sourceUrl: string;
};
export type ReachCategory = {
  key: string; label: string; score: number | null; weight: number;
  assessedWeight: number; earnedWeight: number; assessedChecks: number; totalChecks: number;
};
export type ReachReport = {
  version: string; example: boolean; checkedAt: string; profile: PublicBusiness;
  website: { state: string; url: string; finalUrl: string; message: string; checkedAt?: string; cacheStatus?: string; cacheTtlDays?: number };
  websiteIssue?: { severity: "high"; title: string; message: string; action: string } | null;
  score: number | null; scoreLabel: string; partial: boolean; coverage: number;
  assessedChecks: number; totalChecks: number;
  counts: Record<CheckStatus, number>;
  categories: ReachCategory[]; checks: ReachCheck[]; priorities: ReachCheck[]; methodology: string;
  ranking?: RankScan;
};
