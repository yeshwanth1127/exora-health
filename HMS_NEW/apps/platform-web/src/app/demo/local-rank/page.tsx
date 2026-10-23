import type { Metadata } from "next";
import LocalRankConcept from "./rank-concept";
export const metadata: Metadata = { title: "City visibility — design concept", robots: { index: false, follow: false } };
export default function Page() { return <LocalRankConcept />; }
