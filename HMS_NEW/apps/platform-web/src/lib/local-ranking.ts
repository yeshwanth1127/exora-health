export type RankResult = { id: string; name: string; position: number; mapsUrl: string; attributions?: { provider?: string; providerUri?: string }[] };
export type RankPoint = { id: string; label: string; latitude: number; longitude: number; status: "checked" | "unavailable" | "not_checked"; results: RankResult[]; targetPosition?: number | null; resultsAbove?: number | null; distanceKm?: number; checkedAt?: string; error?: { code: string; message: string } | null };
export type RankScan = {
  provider: "google_places"; measurement: string; depth: number; checkedAt: string;
  targetId: string; category?: string; city?: string; cityName?: string; query?: string;
  status: "complete" | "sampled" | "partial" | "unavailable" | "unsupported";
  message: string; sampleDescription?: string; methodology: string; points: RankPoint[]; checkedPoints?: number; totalPoints?: number;
  leaderboard: { id: string; name: string; mapsUrl: string; found: number; top3: number; top3Share: number; averagePosition: number; visibility: number; target: boolean }[];
  map?: { image: string; center: { latitude: number; longitude: number }; zoom: number; width: number; height: number };
  mapError?: string;
};

export function rankLeaderboard(points: RankPoint[], targetId: string, depth = 20): RankScan["leaderboard"] {
  const checked = points.filter(point => point.status === "checked");
  const businesses = new Map(checked.flatMap(point => point.results.map(result => [result.id, result] as const)));
  return [...businesses.values()].map(business => {
    const ranks = checked.map(point => point.results.find(result => result.id === business.id)?.position ?? null);
    const found = ranks.filter((rank): rank is number => rank !== null);
    const top3 = found.filter(rank => rank <= 3).length;
    return { id: business.id, name: business.name, mapsUrl: business.mapsUrl, found: found.length, top3,
      top3Share: Math.round(top3 / checked.length * 100), averagePosition: Math.round(found.reduce((sum, rank) => sum + rank, 0) / found.length * 10) / 10,
      visibility: Math.round(ranks.reduce<number>((sum, rank) => sum + (rank === null ? 0 : (depth + 1 - rank) / depth), 0) / checked.length * 1000) / 10, target: business.id === targetId };
  }).sort((a, b) => b.visibility - a.visibility || b.top3Share - a.top3Share || a.id.localeCompare(b.id));
}
