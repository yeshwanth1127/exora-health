"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { MapPin } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./local-rank-map.css";

export type RankHospital = { id: string; name: string; lat: number; lng: number; prominence: number };
export type RankPreview = { query: string; targetId: string; hospitals: RankHospital[] };

// A square grid of search points, like the geo-grid scans used by local rank tools.
const GRID = 9, SPACING = 500, DEPTH = 20;
const levels = [
  { id: "top", label: "Top 3", color: "#16a34a" },
  { id: "mid", label: "4–10", color: "#2563eb" },
  { id: "low", label: "11+ or not in top 20", color: "#dc2626" },
] as const;
const levelOf = (rank: number | null) => rank !== null && rank <= 3 ? levels[0] : rank !== null && rank <= 10 ? levels[1] : levels[2];
const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111.32, (a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180));
const compass = ["east", "northeast", "north", "northwest", "west", "southwest", "south", "southeast"];
const hash = (text: string) => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };

// ponytail: illustrative ranking model until a real scan exists; replace `order` with scan results per point.
function buildScan({ hospitals, targetId }: RankPreview) {
  const center = hospitals.find(h => h.id === targetId)!;
  const points = Array.from({ length: GRID * GRID }, (_, index) => {
    const row = Math.floor(index / GRID), column = index % GRID, half = (GRID - 1) / 2;
    const east = (column - half) * SPACING, north = (half - row) * SPACING;
    const lat = center.lat + north / 111320, lng = center.lng + east / (111320 * Math.cos(center.lat * Math.PI / 180));
    const order = hospitals.map(h => ({ id: h.id, score: h.prominence - 2.2 * kmBetween({ lat, lng }, h) + (hash(`${h.id}:${index}`) - 0.5) * 2.6 })).sort((a, b) => b.score - a.score).map(h => h.id);
    const km = Math.hypot(east, north) / 1000, angle = (Math.atan2(north, east) * 180 / Math.PI + 360) % 360;
    return { index, row, column, lat, lng, order, label: km < 0.01 ? "At your hospital" : `${km.toFixed(1)} km ${compass[Math.round(angle / 45) % 8]}` };
  });
  const rankOf = (id: string, point: typeof points[number]) => { const position = point.order.indexOf(id) + 1; return position && position <= DEPTH ? position : null; };
  const board = hospitals.map(h => {
    const ranks = points.map(point => rankOf(h.id, point)), found = ranks.filter((rank): rank is number => rank !== null);
    return { ...h, top3: found.filter(rank => rank <= 3).length, found: found.length, average: found.length ? found.reduce((a, b) => a + b, 0) / found.length : null, km: kmBetween(center, h) };
  }).sort((a, b) => b.top3 - a.top3 || (a.average ?? 99) - (b.average ?? 99));
  return { center, points, rankOf, board };
}

export default function LocalRankMap({ preview, example }: { preview: RankPreview; example: boolean }) {
  const scan = useMemo(() => buildScan(preview), [preview]);
  const { center, points, rankOf, board } = scan;
  const [focusId, setFocusId] = useState(preview.targetId);
  const [selected, setSelected] = useState(Math.floor(GRID * GRID / 2) - GRID + 2);
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  const focus = board.find(h => h.id === focusId)!;
  const point = points[selected];
  const rank = rankOf(focusId, point);
  const position = board.findIndex(h => h.id === preview.targetId) + 1;
  const shown = board.slice(0, 8);
  if (!shown.some(h => h.id === preview.targetId)) shown.push(board[position - 1]);

  // Real map tiles: OpenFreeMap's Positron style (OpenStreetMap data, free, no key). Pins are placed by latitude and longitude.
  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !container.current) return;
      const instance = new maplibregl.Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/positron", center: [center.lng, center.lat], zoom: 13.4, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true } });
      instance.touchZoomRotate.disableRotation();
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
      // Refit whenever the box changes size so the whole grid stays in view; the bottom padding clears the attribution.
      const fit = () => instance.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 28, right: 56, bottom: 48, left: 28 }, animate: false });
      fit();
      instance.on("resize", fit);
      instance.on("load", () => {
        fit();
        const empty = { type: "FeatureCollection" as const, features: [] };
        instance.addSource("rank-grid", { type: "geojson", data: empty });
        instance.addSource("rank-hospital", { type: "geojson", data: empty });
        const radius = (extra: number) => ["interpolate", ["linear"], ["zoom"], 11, 6 + extra, 13.4, 14 + extra, 16, 24 + extra] as unknown as number;
        instance.addLayer({ id: "rank-selected", type: "circle", source: "rank-grid", filter: ["==", ["get", "selected"], true], paint: { "circle-radius": radius(5), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#111827", "circle-stroke-width": 2.5 } });
        instance.addLayer({ id: "rank-pins", type: "circle", source: "rank-grid", paint: { "circle-radius": radius(0), "circle-color": ["get", "color"], "circle-opacity": 0.92, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
        instance.addLayer({ id: "rank-labels", type: "symbol", source: "rank-grid", layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 11, 0, 12.4, 9, 13.4, 12, 16, 15], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#ffffff" } });
        instance.addLayer({ id: "rank-hospital-dot", type: "circle", source: "rank-hospital", paint: { "circle-radius": 7, "circle-color": "#111827", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
        instance.addLayer({ id: "rank-hospital-name", type: "symbol", source: "rank-hospital", layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.1], "text-anchor": "top", "text-allow-overlap": true }, paint: { "text-color": "#111827", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
        instance.on("click", "rank-pins", event => { const index = event.features?.[0]?.properties?.index; if (typeof index === "number") setSelected(index); });
        instance.on("mouseenter", "rank-pins", () => { instance.getCanvas().style.cursor = "pointer"; });
        instance.on("mouseleave", "rank-pins", () => { instance.getCanvas().style.cursor = ""; });
        setReady(true);
      });
      map.current = instance;
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; setReady(false); };
  }, [center, points]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    (instance.getSource("rank-grid") as GeoJSONSource).setData({ type: "FeatureCollection", features: points.map(p => {
      const value = rankOf(focusId, p);
      return { type: "Feature", geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: { index: p.index, label: value === null ? "20+" : String(value), color: levelOf(value).color, selected: p.index === selected } };
    }) });
    (instance.getSource("rank-hospital") as GeoJSONSource).setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [focus.lng, focus.lat] }, properties: { name: focus.name } }] });
  }, [ready, focusId, selected, focus, points, rankOf]);

  const move = (event: KeyboardEvent) => {
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = delta[event.key]; if (!step) return;
    event.preventDefault();
    const row = Math.min(GRID - 1, Math.max(0, point.row + step[0])), column = Math.min(GRID - 1, Math.max(0, point.column + step[1]));
    setSelected(row * GRID + column);
  };

  const share = (h: { top3: number }) => Math.round(h.top3 / points.length * 100);
  return <section className="rank-map" aria-labelledby="rank-map-title">
    <div className="rank-map-heading">
      <div><h2 id="rank-map-title">Where patients can find you</h2><p>Each pin is one Google Maps search for “{preview.query}”, made from that spot. {points.length} spots, {SPACING / 1000} km apart, centred on {center.name}.</p></div>
      {example && <span className="rank-map-badge">Illustrative ranks · no scan run</span>}
    </div>

    <dl className="rank-map-stats">
      <div><dt>Showing</dt><dd>{focus.name}</dd></div>
      <div><dt>Top 3 share</dt><dd>{share(focus)}%</dd></div>
      <div><dt>Average rank</dt><dd>{focus.average === null ? "—" : focus.average.toFixed(1)}</dd></div>
      <div><dt>Found in top {DEPTH}</dt><dd>{focus.found}<small>/{points.length}</small></dd></div>
    </dl>

    <div className="rank-map-body">
      <div className="rank-map-stage">
        <div ref={container} className="rank-map-canvas" tabIndex={0} onKeyDown={move} aria-label={`Map of ${points.length} search spots. Arrow keys move between spots; details appear beside the map.`} />
        <div className="rank-map-legend" aria-label="Legend">{levels.map(level => <span key={level.id}><i style={{ background: level.color }} />{level.label}</span>)}</div>
      </div>
      <aside className="rank-map-point" aria-live="polite">
        <span className="rank-map-eyebrow"><MapPin size={13} aria-hidden="true" /> Searching from</span>
        <h3>{point.label}</h3>
        <p className="rank-map-coords">{point.lat.toFixed(4)}, {point.lng.toFixed(4)}</p>
        <div className="rank-map-rank" style={{ color: levelOf(rank).color }}><small>#</small>{rank ?? "20+"}</div>
        <p className="rank-map-label">Top results here</p>
        <ol className="rank-map-results">
          {point.order.slice(0, 3).map((id, index) => { const h = board.find(item => item.id === id)!; return <li key={id} className={id === focusId ? "is-focus" : ""}><span>{index + 1}</span>{h.name}</li>; })}
          {rank !== null && rank > 3 && <><li className="rank-map-gap" aria-hidden="true">{rank > 4 ? `${rank - 4} more` : ""}</li><li className="is-focus"><span>{rank}</span>{focus.name}</li></>}
          {rank === null && <li className="rank-map-gap">{focus.name} is not in the top {DEPTH}</li>}
        </ol>
      </aside>
    </div>

    <div className="rank-board" aria-labelledby="rank-board-title">
      <div className="rank-board-heading"><h3 id="rank-board-title">Top hospitals in this area</h3><p>Ranked by how often they appear in the top 3 across all {points.length} spots. Select one to see its map.</p></div>
      <div className="rank-board-columns" aria-hidden="true"><span>#</span><span>Hospital</span><span>Top 3 share</span><span>Avg. rank</span><span>Distance</span></div>
      <ol className="rank-board-list">
        {shown.map(h => { const place = board.indexOf(h) + 1, you = h.id === preview.targetId; return <li key={h.id}>
          <button type="button" aria-pressed={h.id === focusId} className={`${h.id === focusId ? "is-focus" : ""}${you ? " is-you" : ""}`} onClick={() => setFocusId(h.id)}>
            <span className="rank-board-place">{place}</span>
            <span className="rank-board-name">{h.name}{you && <em>You</em>}</span>
            <span className="rank-board-share"><span><i style={{ width: `${share(h)}%` }} /></span>{share(h)}%</span>
            <span className="rank-board-average">{h.average === null ? "—" : h.average.toFixed(1)}</span>
            <span className="rank-board-distance">{you ? "—" : `${h.km.toFixed(1)} km`}</span>
          </button>
        </li>; })}
      </ol>
      <p className="rank-board-note">Hospital names and locations from OpenStreetMap. Rankings are illustrative until a live scan runs.</p>
    </div>
  </section>;
}
