"use client";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import "./rank-concept.css";

// Pointy-top axial hex grid. One step between search points is ~0.5 km.
const RADIUS = 5, STEP_KM = 0.5, SIZE = 26, CX = 340, CY = 275;
const position = (q: number, r: number) => ({ x: CX + Math.sqrt(3) * SIZE * (q + r / 2), y: CY + 1.5 * SIZE * r });
// Distance in search-point steps, used to trim the grid into a rounded area.
const steps = (q: number, r: number) => Math.hypot(q + r / 2, r * Math.sqrt(3) / 2);
const cells = Array.from({ length: 2 * RADIUS + 3 }, (_, row) => Array.from({ length: 2 * RADIUS + 3 }, (_, column) => ({ q: column - RADIUS - 1, r: row - RADIUS - 1 }))).flat().filter(({ q, r }) => steps(q, r) <= RADIUS + 0.25);
const cellKeys = new Set(cells.map(({ q, r }) => `${q},${r}`));

const keywords = ["clinic near me", "dentist near me", "hospital near me"];
const levels = [
  { id: "top", label: "Top 3", hint: "Seen first", color: "#c5f82a", ink: "#24311a" },
  { id: "page", label: "4–10", hint: "Seen with a scroll", color: "#6a3be0", ink: "#fff" },
  { id: "low", label: "11–20", hint: "Easy to miss", color: "#b29df2", ink: "#2f1a5c" },
  { id: "none", label: "Not in top 20", hint: "Not shown", color: "#efebfa", ink: "#8f84a6" },
] as const;
type Level = typeof levels[number];
const levelOf = (rank: number | null): Level => rank === null ? levels[3] : rank <= 3 ? levels[0] : rank <= 10 ? levels[1] : levels[2];

// Illustrative only: rank worsens with distance, with a competitor cluster to the west.
function sampleRank(q: number, r: number, keyword: number): number | null {
  const dx = q + r / 2, dy = r * Math.sqrt(3) / 2;
  const competitor = Math.max(0, 1.8 - Math.hypot(dx + 3, dy + 0.6)) * 3;
  const noise = ((q * 7 + r * 13 + keyword * 5 + 60) % 5) - 2;
  const rank = Math.round(0.6 + Math.hypot(dx - 0.4, dy + 0.2) ** 1.6 * (1.5 + keyword * 0.3) + competitor + noise * 0.8);
  return rank > 20 ? null : Math.max(1, rank);
}

// Hexagon with softened corners, so the grid reads as friendly tiles rather than a hard lattice.
function roundedHex(radius: number, corner: number) {
  const points = Array.from({ length: 6 }, (_, i) => { const a = (i * 60 - 90) * Math.PI / 180; return [radius * Math.cos(a), radius * Math.sin(a)]; });
  const t = corner / radius;
  const along = (from: number[], to: number[]) => `${(from[0] + (to[0] - from[0]) * t).toFixed(2)} ${(from[1] + (to[1] - from[1]) * t).toFixed(2)}`;
  return points.map((point, i) => { const previous = points[(i + 5) % 6], next = points[(i + 1) % 6]; return `${i ? "L" : "M"}${along(point, previous)} Q${point[0].toFixed(2)} ${point[1].toFixed(2)} ${along(point, next)}`; }).join(" ") + " Z";
}
const hexPath = roundedHex(SIZE - 2.5, 7);

const compass = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
function placeLabel(q: number, r: number) {
  if (!q && !r) return "At your clinic";
  const angle = (Math.atan2(r * Math.sqrt(3) / 2, q + r / 2) * 180 / Math.PI + 360) % 360;
  const km = steps(q, r) * STEP_KM;
  return `${km.toFixed(1)} km ${compass[Math.round(angle / 45) % 8]}`;
}

function summarise(keyword: number) {
  const byRing = Array.from({ length: RADIUS + 1 }, (_, ring) => cells.filter(c => Math.round(steps(c.q, c.r)) === ring).map(c => sampleRank(c.q, c.r, keyword)));
  const share = (ranks: (number | null)[], test: (rank: number | null) => boolean) => ranks.filter(test).length / ranks.length;
  let strong = 0; while (strong < RADIUS && share(byRing[strong + 1], rank => rank !== null && rank <= 3) >= 0.5) strong++;
  const weak = byRing.findIndex(ranks => share(ranks, rank => rank === null || rank > 10) >= 0.5);
  return { strongKm: Math.max(strong, 1) * STEP_KM, weakKm: weak < 0 ? null : weak * STEP_KM };
}

export default function LocalRankConcept() {
  const [keyword, setKeyword] = useState(0);
  const [selected, setSelected] = useState({ q: 1, r: -1 });
  const [hovered, setHovered] = useState<{ q: number; r: number } | null>(null);
  const [focusLevel, setFocusLevel] = useState<Level["id"] | null>(null);

  const ranks = new Map(cells.map(c => [`${c.q},${c.r}`, sampleRank(c.q, c.r, keyword)]));
  const rankAt = (q: number, r: number) => ranks.get(`${q},${r}`) ?? null;
  const counts = levels.map(level => cells.filter(c => levelOf(rankAt(c.q, c.r)).id === level.id).length);
  const { strongKm, weakKm } = summarise(keyword);
  const rank = rankAt(selected.q, selected.r);
  const level = levelOf(rank);
  const tip = hovered && { ...position(hovered.q, hovered.r), rank: rankAt(hovered.q, hovered.r), label: placeLabel(hovered.q, hovered.r) };

  const move = (event: KeyboardEvent, q: number, r: number) => {
    const delta: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected({ q, r }); return; }
    if (event.key === "Escape") { setHovered(null); return; }
    const step = delta[event.key]; if (!step) return;
    event.preventDefault();
    const next = { q: q + step[0], r: r + step[1] };
    if (!cellKeys.has(`${next.q},${next.r}`)) return;
    setSelected(next); setHovered(next);
    (event.currentTarget.parentElement?.querySelector(`[data-cell="${next.q},${next.r}"]`) as SVGElement | null)?.focus();
  };

  return <main className="city-concept">
    <header><a href="/demo/reach-report"><ArrowLeft size={15} /> Reach report</a><span>Design concept · Illustrative data</span></header>
    <div className="city-intro"><p>Google Maps ranking</p><h1>Where patients can find you.</h1><p>We search from points across your area, the way a nearby patient would.</p></div>

    <section className="city-panel" aria-label="Illustrative local ranking map">
      <div className="city-toolbar">
        <p className="city-headline" aria-live="polite">You’re a <mark>top 3</mark> pick up to <strong>{strongKm} km</strong> from your clinic{weakKm !== null && <>, and hard to find beyond <strong>{weakKm} km</strong></>}.</p>
        <label><span>Patients searching</span><select value={keyword} onChange={event => setKeyword(Number(event.target.value))}>{keywords.map((term, index) => <option key={term} value={index}>“{term}”</option>)}</select></label>
      </div>

      <div className="city-body">
        <div className="city-map" data-focus={focusLevel ?? undefined}>
          <div className="city-stage">
          <svg className="city-grid" viewBox="0 0 680 550" role="grid" aria-label="Ranking at each search point around your clinic">
            <defs><radialGradient id="city-fade"><stop offset=".55" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient><mask id="city-fade-mask"><rect width="680" height="550" fill="url(#city-fade)" /></mask><pattern id="city-blocks" width="96" height="78" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)"><rect x="6" y="6" width="84" height="66" rx="14" fill="#f6f4f9" /></pattern></defs>
            <g mask="url(#city-fade-mask)"><rect width="680" height="550" fill="url(#city-blocks)" />
            <path d="M -20 380 C150 290 230 480 380 360 S570 210 710 250" fill="none" stroke="#e3edf6" strokeWidth="30" strokeLinecap="round" /></g>
            {cells.map(({ q, r }) => {
              const value = rankAt(q, r), cellLevel = levelOf(value), active = q === selected.q && r === selected.r, { x, y } = position(q, r);
              return <g key={`${q},${r}`} data-cell={`${q},${r}`} data-level={cellLevel.id} role="gridcell" tabIndex={active ? 0 : -1} aria-selected={active}
                aria-label={`${placeLabel(q, r)}: ${value === null ? "not in the top 20" : `rank ${value}`}`}
                className={`city-hex${active ? " is-selected" : ""}`} style={{ "--x": `${x}px`, "--y": `${y}px`, "--d": Math.round(steps(q, r)) } as CSSProperties}
                onClick={() => setSelected({ q, r })} onKeyDown={event => move(event, q, r)}
                onPointerEnter={() => setHovered({ q, r })} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered({ q, r })} onBlur={() => setHovered(null)}>
                <path d={hexPath} fill={cellLevel.color} />
                {active && <text dy=".36em" textAnchor="middle" fill={cellLevel.ink}>{value ?? "–"}</text>}
              </g>;
            })}
            {[2, 4].map(ring => <g key={ring} className="city-ring" aria-hidden="true"><circle cx={CX} cy={CY} r={ring * Math.sqrt(3) * SIZE} /><text x={CX} y={CY - ring * Math.sqrt(3) * SIZE + 4} textAnchor="middle">{ring * STEP_KM} km</text></g>)}
            <g className="city-clinic" transform={`translate(${CX} ${CY})`} aria-hidden="true">
              <circle className="city-clinic-pulse" r="18" />
              <path d="M0 6 C-9 -3 -12 -8 -12 -14 A12 12 0 1 1 12 -14 C12 -8 9 -3 0 6 Z" fill="#24113f" stroke="#fff" strokeWidth="2.5" transform="translate(0 -4)" />
              <circle cx="0" cy="-18" r="4.2" fill="#c5f82a" />
            </g>
          </svg>
          {tip && <div className="city-tip" aria-hidden="true" style={{ "--tx": `${tip.x / 680 * 100}%`, "--ty": `${tip.y / 550 * 100}%` } as CSSProperties}><strong>{tip.rank === null ? "Not in top 20" : `#${tip.rank}`}</strong><span>{tip.label}</span></div>}
          </div>
          <div className="city-legend" role="group" aria-label="Highlight a ranking level">
            {levels.map((item, index) => <button key={item.id} type="button" aria-pressed={focusLevel === item.id} onClick={() => setFocusLevel(focusLevel === item.id ? null : item.id)} onPointerEnter={() => setFocusLevel(item.id)} onPointerLeave={() => setFocusLevel(null)}>
              <i style={{ background: item.color }} /><span><b>{item.label}</b>{item.hint}</span><em>{counts[index]}</em>
            </button>)}
          </div>
        </div>

        <aside className="city-point" aria-live="polite">
          <span className="city-point-eyebrow"><MapPin size={13} /> Searching from</span>
          <h2>{placeLabel(selected.q, selected.r)}</h2>
          <div className="city-rank"><span className="city-rank-number"><small>#</small>{rank ?? "20+"}</span><span className="city-rank-chip" style={{ background: level.color, color: level.ink }}>{level.hint}</span></div>
          <p className="city-point-label">What a patient here sees</p>
          <ol className="city-results">
            {[1, 2, 3].map(slot => <li key={slot} className={rank === slot ? "is-you" : ""}><span>{slot}</span>{rank === slot ? "Your clinic" : "Another clinic"}</li>)}
            {rank !== null && rank > 3 && <><li className="city-results-gap" aria-hidden="true">{rank > 4 ? `${rank - 4} more` : ""}</li><li className="is-you"><span>{rank}</span>Your clinic</li></>}
            {rank === null && <li className="city-results-gap">You’re not in the first 20</li>}
          </ol>
          <dl><div><dt>Search</dt><dd>“{keywords[keyword]}” on Google Maps</dd></div><div><dt>Data</dt><dd>Illustrative · no scan run</dd></div></dl>
        </aside>
      </div>
      <footer><p><strong>{counts[0]}</strong> of {cells.length} search points show you in the top 3.</p><p>Hover or tab through the map · Arrow keys move between points</p></footer>
    </section>
    <p className="city-disclosure">Design exploration only. No live rankings, competitor data or Google API calls are used. A live scan would record coordinates, language, device and time for every point.</p>
  </main>;
}
