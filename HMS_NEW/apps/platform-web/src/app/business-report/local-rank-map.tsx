"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { motionTokens } from "../components/arc-business/motion-tokens";
import { createTerrain, type TerrainHandle, type TerrainTile } from "./rank-terrain";
import RankWards from "./rank-wards";
import type { RankScan } from "../../lib/local-ranking";
import { observedSpots, observationHexes, mapWorld, regionContains } from "../../lib/rank-explorer-model";
import geometry from "./bengaluru-regions.json";
import "./local-rank-map.css";

export type RankHospital = { id: string; name: string; lat: number; lng: number; prominence: number };
// `regions` are named areas such as neighbourhoods: [unique name, SVG path in view box units, centre lat, centre lng, short note like "3 wards"].
export type RankCity = { name: string; noun: string; viewBox: [number, number]; projection: { lat0: number; minx: number; miny: number; scale: number }; regions: [name: string, path: string, lat: number, lng: number, note: string][] };
export type RankPreview = { query: string; targetId: string; hospitals: RankHospital[]; areas?: [name: string, lat: number, lng: number][]; city?: RankCity };

// Hexagonal search spots: every centre within 9.6 km of the clinic, 1.5 km apart.
const SPACING = 1.5, REACH = 9.6, DEPTH = 20;
// Least to most visible, matching the legend.
const levels = [
  { label: "Not assessed", rgb: [222, 224, 229] },
  { label: "Not returned", rgb: [236, 232, 247] },
  { label: `11–${DEPTH}`, rgb: [196, 184, 244] },
  { label: "4–10", rgb: [151, 124, 236] },
  { label: "2–3", rgb: [94, 52, 224] },
  { label: "#1", rgb: [43, 18, 104] },
] as const;
const fillOf = (level: number) => `rgb(${levels[level].rgb.join(" ")})`;
const levelOf = (rank: number | null | undefined) => rank === undefined ? 0 : rank === null ? 1 : rank === 1 ? 5 : rank <= 3 ? 4 : rank <= 10 ? 3 : 2;
const normOf = (rank: number | null | undefined) => rank == null ? 0 : (DEPTH + 1 - rank) / DEPTH;
const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111.32, (a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180));
const compass = ["east", "northeast", "north", "northwest", "west", "southwest", "south", "southeast"];
const bearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => compass[Math.round(((Math.atan2(to.lat - from.lat, (to.lng - from.lng) * Math.cos(from.lat * Math.PI / 180)) * 180 / Math.PI + 360) % 360) / 45) % 8];
const hash = (text: string) => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };

type Spot = { lat: number; lng: number; km: number; top: string[]; area: string; where: string; positions?:Record<string,number>; status?:"checked"|"not_checked"|"unavailable"; pointId?:string; error?:string };
// ponytail: illustrative ranking model until a real scan exists; replace `top` with scan results per spot.
function searchFrom(hospitals: RankHospital[], lat: number, lng: number, salt: string) {
  return hospitals.map(h => ({ id: h.id, score: h.prominence - 0.5 * kmBetween({ lat, lng }, h) + (hash(`${h.id}:${salt}`) - 0.5) * 2 }))
    .sort((a, b) => b.score - a.score).slice(0, DEPTH).map(h => h.id);
}
function spotAt(center: RankHospital, lat: number, lng: number, top: string[], area: string): Spot {
  const km = kmBetween(center, { lat, lng });
  return { lat, lng, km, top, area, where: km < 0.75 ? "Where your hospital is" : `${km.toFixed(1)} km ${bearing(center, { lat, lng })} of your hospital` };
}
function buildHexes({ hospitals, targetId, areas = [] }: RankPreview) {
  const center = hospitals.find(h => h.id === targetId)!;
  const kmPerLng = 111.32 * Math.cos(center.lat * Math.PI / 180), steps = Math.ceil(REACH / SPACING) + 1;
  const cells = [];
  for (let q = -steps; q <= steps; q++) for (let r = -steps; r <= steps; r++) {
    const x = SPACING * (q + r / 2), z = SPACING * Math.sqrt(3) / 2 * r;
    if (Math.hypot(x, z) > REACH) continue;
    const lat = center.lat - z / 111.32, lng = center.lng + x / kmPerLng;
    const near = areas.map(([name, aLat, aLng]) => ({ name, km: kmBetween({ lat, lng }, { lat: aLat, lng: aLng }) })).sort((a, b) => a.km - b.km)[0];
    const spot = spotAt(center, lat, lng, searchFrom(hospitals, lat, lng, `${q}:${r}`), "");
    spot.area = near && near.km < 1.6 ? near.name : spot.km < 0.75 ? center.name : `Spot ${spot.km.toFixed(1)} km ${bearing(center, spot)}`;
    cells.push({ x, z, q, r, ...spot });
  }
  return { center, cells, home: cells.findIndex(c => c.q === 0 && c.r === 0), spacing:SPACING };
}
function buildAreas({ hospitals, targetId, city }: RankPreview) {
  if (!city) return null;
  const center = hospitals.find(h => h.id === targetId)!, k = Math.cos(city.projection.lat0 * Math.PI / 180);
  const spots = city.regions.map(([name, , lat, lng]) => spotAt(center, lat, lng, searchFrom(hospitals, lat, lng, `a${name}`), name));
  const shapes = city.regions.map(([name, path, , , note]) => ({ name, path, note }));
  const home: [number, number] = [(center.lng * k - city.projection.minx) * city.projection.scale, (-center.lat - city.projection.miny) * city.projection.scale];
  return { city, spots, shapes, home };
}
const rankIn = (spot: Spot, id: string) => spot.status && spot.status !== "checked" ? undefined : spot.positions ? spot.positions[id] ?? null : spot.top.indexOf(id) + 1 || null;
const rankText = (rank:number|null|undefined) => rank === undefined ? "Not checked" : rank === null ? "Not returned" : `#${rank}`;

export default function LocalRankMap({ preview, scan, onCheck, busy = false }: { preview: RankPreview; scan?:RankScan; onCheck?(ids:string[]):void; busy?:boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const liveSpots = useMemo(() => scan ? observedSpots(scan) : null, [scan]);
  const hexes = useMemo(() => {
    if(!liveSpots)return buildHexes(preview);
    const center=preview.hospitals.find(h=>h.id===preview.targetId)!;
    const {lat0,minx,miny,scale}=geometry.projection;
    const x=(center.lng*Math.cos(lat0*Math.PI/180)-minx)*scale,y=(-center.lat-miny)*scale;
    const homeId=scan?.city==='bengaluru'?geometry.regions.find(region=>regionContains(region.path,x,y))?.id:undefined;
    return {center,...observationHexes(liveSpots,center,homeId)};
  }, [preview,liveSpots,scan?.city]);
  const areas = useMemo(() => {
    if (!scan) return buildAreas(preview);
    if (!scan.map || scan.city !== "bengaluru" || !liveSpots) return null;
    const map=scan.map, center=mapWorld(map.center.latitude,map.center.longitude),size=256*2**map.zoom;
    const project=(lat:number,lng:number):[number,number]=>{const [x,y]=mapWorld(lat,lng);return [map.width/2+(x-center[0])*size,map.height/2+(y-center[1])*size];};
    const {lat0,minx,miny,scale}=geometry.projection,k=Math.cos(lat0*Math.PI/180);
    const shapes=scan.points.map(p=>{const region=geometry.regions.find(r=>r.id===p.id);return {name:p.label,note:"Neighbourhood sample",path:region?.path.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g,(_,cmd,sx,sy)=>{const [x,y]=project(-(Number(sy)/scale+miny),(Number(sx)/scale+minx)/k);return `${cmd}${x.toFixed(2)} ${y.toFixed(2)}`;}) || ""};});
    const home=project(hexes.center.lat,hexes.center.lng);
    return {city:{name:scan.cityName || "Bengaluru",noun:"neighbourhoods",viewBox:[map.width,map.height] as [number,number]},spots:liveSpots,shapes,home};
  }, [preview,scan,liveSpots,hexes.center]);
  const { center, cells, home } = hexes;
  const byId = useMemo(() => new Map(preview.hospitals.map(h => [h.id, h])), [preview]);
  const [view, setView] = useState<"hexes" | "areas">("hexes");
  const [focusId, setFocusId] = useState(preview.targetId);
  const focusHospital = byId.get(focusId)!, you = focusId === preview.targetId;

  // Leaderboard across the hex region: how often each hospital is in the top 3, and its average rank where found.
  const board = useMemo(() => {
    if(scan)return scan.leaderboard.map(b=>({...byId.get(b.id)!,top3:b.top3,average:b.averagePosition,km:0,share:b.top3Share,found:b.found}));
    const found = new Map<string, number[]>();
    for (const cell of cells) cell.top.forEach((hid, index) => { const list = found.get(hid) ?? []; list.push(index + 1); found.set(hid, list); });
    return [...found].map(([hid, list]) => ({ ...byId.get(hid)!, top3: list.filter(rank => rank <= 3).length, average: list.reduce((a, b) => a + b, 0) / list.length, km: kmBetween(center, byId.get(hid)!) }))
      .sort((a, b) => b.top3 - a.top3 || a.average - b.average).map(b=>({...b,share:Math.round(b.top3/cells.length*100),found:0}));
  }, [cells, byId, center,scan]);

  const spots: Spot[] = view === "areas" && areas ? areas.spots : cells;
  const noun = view === "areas" && areas ? areas.city.noun : "spots";
  const ranks = useMemo(() => spots.map(spot => rankIn(spot, focusId)), [spots, focusId]);
  const counts = levels.map((_, level) => ranks.filter(rank => levelOf(rank) === level).length);
  const found = ranks.filter(rank => typeof rank === "number").length;
  const assessed = spots.filter(p=>!p.status || p.status === "checked").length;
  const best = ranks.reduce<number | null>((pick, rank, i) => rank != null && (pick === null || rank < ranks[pick]! || (rank === ranks[pick] && spots[i].km < spots[pick].km)) ? i : pick, null);
  const wins = new Map<string, number>(); for (const spot of spots) wins.set(spot.top[0], (wins.get(spot.top[0]) ?? 0) + 1);
  const [usualLeader, usualWins] = [...wins].filter(([id])=>!!id).sort((a, b) => b[1] - a[1])[0] || [preview.targetId,0];
  const subject = you ? "you" : focusHospital.name;

  const nearestFound = (i: number) => ranks.reduce<number | null>((pick, rank, j) => rank != null && j !== i && (pick === null || kmBetween(spots[i], spots[j]) < kmBetween(spots[i], spots[pick])) ? j : pick, null);
  function card(i: number) {
    const spot = spots[i], rank = ranks[i], leader = byId.get(spot.top[0])!, near = rank === null ? nearestFound(i) : null;
    return <div className="rank-card">
      <div className="rank-card-head">
        <p className="rank-card-place">{spot.area}</p>
        <p className="rank-card-where">{view === "areas" && areas ? `${areas.shapes[i].note} · ` : ""}{spot.where}</p>
      </div>
      <dl className="rank-card-rows">
        <div data-tone={rank == null ? "none" : rank <= 3 ? "good" : undefined}><dt>{you ? "Your rank" : "Rank"}</dt><dd>{spot.status === "unavailable" ? "Unavailable" : rankText(rank)}</dd></div>
        <div><dt>Ranks first</dt><dd>{leader ? leader.id === preview.targetId ? "You" : leader.name : "—"}</dd></div>
        {rank != null && rank > 1 && <div><dt>Gap to #1</dt><dd>{rank - 1} {rank === 2 ? "place" : "places"}</dd></div>}
        {near !== null && <div><dt>Nearest with {you ? "you" : "them"}</dt><dd>{spots[near].area} · #{ranks[near]}</dd></div>}
      </dl>
    </div>;
  }

  const summary = <div className="rank-summary">
    <p className="rank-summary-place">{view === "areas" && areas ? `${areas.city.name} · all ${spots.length} ${noun}` : scan ? `${scan.cityName} · neighbourhood observations` : `${spots.length} spots within ${REACH} km`}</p>
    <p className="rank-summary-total"><span className="rank-summary-value">{found}<small> of {assessed} checked</small></span><span className="rank-summary-label">{noun} show {subject} in the top {DEPTH}</span></p>
    <p className="rank-summary-note">{best === null
      ? !assessed ? "Choose a neighbourhood to run its search." : `${you ? "You're" : `${focusHospital.name} is`} not returned in any of these ${assessed} sampled searches. ${(byId.get(usualLeader)?.name || "No business")} was first in ${usualWins} of these responses.`
      : `Strongest in ${spots[best].area} at #${ranks[best]}.${assessed > 0 && found / assessed < 0.25 ? ` Not returned in ${assessed - found} checked ${noun}.` : ""}`}</p>
  </div>;

  const position = board.findIndex(h => h.id === preview.targetId) + 1;
  const leaders = board.slice(0, 8);
  if (position > 8) leaders.push(board[position - 1]);
  const share = (h: { share:number }) => h.share;
  const views: { id: "hexes" | "areas"; label: string }[] = [{ id: "hexes", label: "Heatmap" }, ...(areas ? [{ id: "areas" as const, label: "Choropleth explorer" }] : [])];

  return <section className="rank-terrain" aria-labelledby={`${id}-title`}>
    <header className="rank-terrain-top">
      <div className="rank-terrain-header">
        <h2 id={`${id}-title`}>Where patients can find you</h2>
        <p>{scan ? view === "areas" ? `Places search sample for “${preview.query}”. The Google map is a static overview; unchecked areas have no rank.` : `Each tile represents one neighbourhood observation for “${preview.query}”. North is up. The centre hex is your hospital’s neighbourhood; surrounding hexes follow their geographic locations.` : view === "areas" && areas ? `Design preview · illustrative rankings. Each area previews a search for “${preview.query}” from its centre.` : `Design preview · illustrative rankings. Each tile previews a search for “${preview.query}” from that spot, ${SPACING} km apart.`} Colour shows where {focusHospital.name} appears.</p>
      </div>
      {views.length > 1 && <div className="rank-switch" role="group" aria-label="Map view"><div className="rank-switch-track">
        {views.map(option => <button key={option.id} type="button" className="rank-switch-button" aria-pressed={view === option.id} onClick={() => setView(option.id)}>
          {view === option.id && <motion.span layoutId={`${id}-switch`} className="rank-switch-selection" transition={motionTokens.spring.snappy} />}
          <span className="rank-switch-label">{option.label}</span>
        </button>)}
      </div></div>}
    </header>

    {view === "areas" && areas ? <RankWards
      viewBox={areas.city.viewBox} home={areas.home} noun={noun} shapes={areas.shapes}
      label={`Map of ${spots.length} ${areas.city.name} ${noun} coloured by where ${focusHospital.name} ranks for “${preview.query}”. ${levels.map((level, i) => `${counts[i]} ${level.label}`).join(", ")}. The ranked list that follows has every area.`}
      fills={ranks.map(rank => scan ? fillOf(levelOf(rank)).replace("rgb(","rgb(").replace(")"," / .58)") : fillOf(levelOf(rank)))} bins={ranks.map(levelOf)} norms={ranks.map(normOf)}
      values={ranks.map((rank,i)=>spots[i].status === "unavailable" ? "Unavailable" : rankText(rank))}
      mapImage={scan?.map?.image}
      order={spots.map((_, i) => i).sort((a, b) => (ranks[a] === undefined ? 101 : ranks[a] ?? 100) - (ranks[b] === undefined ? 101 : ranks[b] ?? 100) || spots[a].km - spots[b].km)}
      legend={levels.map((level, i) => ({ label: level.label, fill: fillOf(i), count: counts[i] }))}
      legendNote={`Shaded by observed position. Unchecked areas have no rank.`}
      listMeta={`Ranked by ${you ? "your" : "their"} position`}
      summary={summary}
      openSummary={i => <div className="rank-summary">
        <p className="rank-summary-place">{areas.shapes[i].note} · {spots[i].where}</p>
        <p className="rank-summary-total"><span className="rank-summary-value">{areas.shapes[i].name}</span></p>
        <p className="rank-summary-note">{ranks[i] === null ? !assessed ? "Choose a neighbourhood to run its search." : `${you ? "You're" : "They're"} not in the top ${DEPTH} here.` : `${you ? "Your position" : "Position"}: ${rankText(ranks[i])}.`}</p>
      </div>}
      card={card}
      detail={i => { const near = ranks[i] === null ? nearestFound(i) : null; return <>
        <p className="rank-wards-detail-title">{spots[i].status && spots[i].status !== "checked" ? "Search not completed" : "Top results"} in {spots[i].area}</p>
        {spots[i].pointId && spots[i].status !== "checked" && onCheck && <><p className="rank-wards-detail-text">{spots[i].where}</p><button className="rank-wards-back" disabled={busy} onClick={()=>onCheck([spots[i].pointId!])}>{busy ? "Checking…" : "Check this neighbourhood"}</button></>}
        <ol className="rank-wards-results">
          {spots[i].top.slice(0, 5).map((hid, index) => <li key={hid} data-on={hid === focusId || undefined}><span>{spots[i].positions?.[hid] || index + 1}</span>{byId.get(hid)?.name || hid}</li>)}
          {ranks[i] !== null && ranks[i]! > 5 && <li data-on><span>{ranks[i]}</span>{focusHospital.name}</li>}
        </ol>
        {ranks[i] === null && <p className="rank-wards-detail-text">{focusHospital.name} is not in the top {DEPTH} in this response.{near !== null && ` Nearest area where ${you ? "you" : "they"} appear: ${spots[near].area} (#${ranks[near]}).`}</p>}
      </>; }}
    /> : <HexView cells={cells} home={home} spacing={hexes.spacing} ranks={ranks} summary={summary} card={card} counts={counts}
      label={`Hex heatmap of ${cells.length} ${scan ? "neighbourhood observations" : "illustrative searches"} for “${preview.query}” for ${center.name}, coloured by where ${focusHospital.name} ranks. ${levels.map((level, i) => `${counts[i]} ${level.label}`).join(", ")}. The table that follows ranks hospitals across all spots.`} />}

    <div className="rank-board" aria-labelledby={`${id}-board`}>
      <div className="rank-board-heading"><h3 id={`${id}-board`}>{scan ? "Businesses across these searches" : "Top hospitals in your region"}</h3><p>Compared across {scan ? `${scan.checkedPoints} checked neighbourhoods` : `${cells.length} illustrative spots`}. Select one to see its map.</p></div>
      <div className="rank-board-columns" aria-hidden="true"><span>#</span><span>{scan ? "Business" : "Hospital"}</span><span>Top 3 share</span><span>Avg. rank</span><span>{scan ? "Areas" : "Distance"}</span></div>
      <ol className="rank-board-list">
        {leaders.map(h => { const place = board.indexOf(h) + 1, mine = h.id === preview.targetId; return <li key={h.id}>
          <button type="button" aria-pressed={h.id === focusId} className={h.id === focusId ? "is-focus" : undefined} onClick={() => setFocusId(h.id)}>
            <span className="rank-board-place">{place}</span>
            <span className="rank-board-name">{h.name}{mine && <em>You</em>}</span>
            <span className="rank-board-share"><span><i style={{ width: `${share(h)}%` }} /></span>{share(h)}%</span>
            <span className="rank-board-average">{h.average.toFixed(1)}</span>
            <span className="rank-board-distance">{scan ? `${h.found}/${scan.checkedPoints}` : mine ? "—" : `${h.km.toFixed(1)} km`}</span>
          </button>
        </li>; })}
      </ol>
      {scan?.map && view === "hexes" && <div className="rank-chart-google-credit" aria-label="Google Maps attribution"><div style={{aspectRatio:`${scan.map.width} / ${scan.map.height}`,backgroundImage:`url("${scan.map.image}")`}} /></div>}
      <p className="rank-board-note">{scan ? "Google Places observations; public search order can vary. Neighbourhood boundaries © OpenStreetMap contributors (ODbL)." : "Design preview · illustrative rankings. Hospital, place and ward boundaries © OpenStreetMap contributors (ODbL)."}</p>
    </div>
  </section>;
}

type Cell = Spot & { x: number; z: number; q: number; r: number };
function HexView({ cells, home, spacing, ranks, summary, card, counts, label }: { cells: Cell[]; home: number; spacing:number; ranks: (number | null | undefined)[]; summary: ReactNode; card(i: number): ReactNode; counts: number[]; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [live, setLive] = useState("");
  const plot = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), panel = useRef<HTMLDivElement>(null);
  const engine = useRef<TerrainHandle | null>(null);
  const tiles: TerrainTile[] = useMemo(() => ranks.map(rank => ({ rgb: levels[levelOf(rank)].rgb, norm: normOf(rank) })), [ranks]);
  const firstTiles = useRef(tiles);
  firstTiles.current = tiles;
  const describe = (i: number) => `${cells[i].area}, ${cells[i].where}: ${rankText(ranks[i])}.`;

  function fly(i: number | null) {
    const next = i !== null && i === focus ? null : i;
    setFocus(next); engine.current?.setFocus(next);
    if (next !== null) { setShown(next); setLive(`Flew to ${describe(next)}`); } else if (focus !== null) setLive("Back to the whole area.");
  }
  const pick = useRef(fly);
  useEffect(() => { pick.current = fly; });
  useEffect(() => {
    if (!plot.current || !canvas.current || !panel.current) return;
    const handle = createTerrain({ plot: plot.current, canvas: canvas.current, panel: panel.current }, cells, firstTiles.current, home, spacing, {
      onHover(i) { setHover(i); if (i !== null) setShown(i); },
      onPick(i) { pick.current(i); },
    });
    engine.current = handle;
    return () => { handle.destroy(); engine.current = null; };
  }, [cells, home, spacing]);
  const seeded = useRef(false);
  useEffect(() => { if (!seeded.current) { seeded.current = true; return; } engine.current?.setTiles(tiles, focus ?? hover); }, [tiles]); // eslint-disable-line react-hooks/exhaustive-deps

  function activate(i: number | null) { setHover(i); if (i !== null) setShown(i); engine.current?.setActive(i); }
  const keys = (event: KeyboardEvent) => {
    const step: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (event.key === "Escape") { if (focus !== null) fly(null); else if (hover !== null) { activate(null); setLive(""); } else return; event.preventDefault(); return; }
    if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") { event.preventDefault(); engine.current?.zoom(event.key === "+" || event.key === "=" ? 1.25 : 0.8); return; }
    if ((event.key === "Enter" || event.key === " ") && (hover ?? focus) !== null) { event.preventDefault(); fly(hover ?? focus); return; }
    const move = step[event.key]; if (!move) return;
    event.preventDefault();
    const from = hover ?? focus ?? home, here = cells[from];
    // The neighbour whose direction best matches the arrow.
    const next = cells.map((c, i) => ({ i, dx: c.x - here.x, dz: c.z - here.z })).filter(c => c.i !== from && (c.dx * move[0] + c.dz * move[1]) > 0)
      .sort((a,b)=> Math.hypot(a.dx,a.dz)**2/(a.dx*move[0]+a.dz*move[1])-Math.hypot(b.dx,b.dz)**2/(b.dx*move[0]+b.dz*move[1]))[0];
    if (next && next.dx * move[0] + next.dz * move[1] > 0) { activate(next.i); setLive(describe(next.i)); }
  };

  return <>
    {summary}
    <div className="rank-terrain-viewport">
      <div ref={plot} className="rank-terrain-plot" tabIndex={0} role="group" aria-label="Search spots" aria-describedby={`${id}-hint`} onKeyDown={keys}
        onFocus={event => { if (hover === null && focus === null && event.currentTarget.matches(":focus-visible")) { activate(home); setLive(describe(home)); } }}
        onBlur={() => { if (hover !== null && focus === null) activate(null); }}>
        <canvas ref={canvas} className="rank-terrain-canvas" role="img" aria-label={label} />
        <div ref={panel} className="rank-terrain-panel" data-show={hover !== null || focus !== null ? "" : undefined} aria-hidden="true">{card(shown ?? home)}</div>
      </div>
      <button type="button" className="rank-terrain-reset" onClick={() => fly(null)} data-hidden={focus === null ? "" : undefined} aria-hidden={focus === null || undefined} tabIndex={focus === null ? -1 : undefined}>
        <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />Reset view
      </button>
    </div>
    <div className="rank-terrain-legend">
      <ol aria-label="Legend">{levels.map((level, i) => <li key={level.label}><i style={{ background: fillOf(i) }} />{level.label}<b>{counts[i]}</b></li>)}</ol>
      <p id={`${id}-hint`} className="rank-terrain-hint">
        <span className="rank-terrain-hint-fine">Hover a tile for details. Click to fly in.</span>
        <span className="rank-terrain-hint-touch">Tap a tile to fly in.</span>
        <span className="rank-terrain-sr"> Arrow keys move between spots, Enter flies in, plus and minus zoom, Escape returns.</span>
      </p>
    </div>
    <p className="rank-terrain-sr" aria-live="polite">{live}</p>
  </>;
}
