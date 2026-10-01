/**
 * The geometry behind the field map.
 *
 * Pure module, no React Native imports, so it runs under `node --test`. That
 * separation is the point: this is the only part of the map that can be
 * *silently* wrong. A mark in the wrong place still looks like a map, and a
 * clustering verdict computed from a bad projection reads exactly as confidently
 * as a good one — which is the failure this whole project is organised against.
 */

/** Metres per degree of latitude. Close enough at any Indian latitude. */
export const M_PER_DEG_LAT = 111_320;

export type LatLon = { lat: number; lon: number };
export type Metres = { xm: number; ym: number };

/**
 * Projects lat/lon to metres east/north of the set's own centre.
 *
 * An equirectangular projection about the centre latitude. Over a field — tens
 * of metres — the error against a proper geodesic is far below the receiver's
 * own 2.5 m, so the simple thing is the honest thing here.
 */
export function toMetres(points: LatLon[]): { metres: Metres[]; centre: LatLon } {
  if (points.length === 0) return { metres: [], centre: { lat: 0, lon: 0 } };

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  // Longitude degrees shrink toward the poles; without this the plot is
  // stretched east-west by about 12% at Delhi's latitude.
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);

  return {
    metres: points.map((p) => ({
      xm: (p.lon - midLon) * mPerDegLon,
      ym: (p.lat - midLat) * M_PER_DEG_LAT,
    })),
    centre: { lat: midLat, lon: midLon },
  };
}

/**
 * The width of the plot, in metres.
 *
 * Floored at 10 m because below that the receiver's own error dominates:
 * stretching a cluster that is really "all in one spot" to fill the plot would
 * invent a spread the GPS cannot resolve.
 */
export function extentMetres(metres: Metres[], floor = 10): number {
  if (metres.length === 0) return floor;
  const widest = Math.max(
    Math.max(...metres.map((m) => Math.abs(m.xm))) * 2,
    Math.max(...metres.map((m) => Math.abs(m.ym))) * 2,
  );
  return Math.max(widest, floor);
}

/** Maps a point in metres to the unit square, north up. */
export function toUnitSquare(m: Metres, span: number): { x: number; y: number } {
  return { x: 0.5 + m.xm / span, y: 0.5 - m.ym / span };
}

/**
 * Chooses a round scale-bar length that sits comfortably inside the plot.
 *
 * The largest round step that fits within a third of the width — taking the
 * *smallest step at least that long* instead lets the bar jump to nearly half
 * the plot (a 107 m field would get a 50 m bar), which reads as a measurement
 * of the field rather than as a key to it.
 */
export function pickScaleMetres(spanMetres: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  const target = spanMetres / 3;
  const fitting = steps.filter((x) => x <= target);
  return fitting.length > 0 ? fitting[fitting.length - 1] : steps[0];
}

export type Spread = {
  verdict: 'Clustered' | 'Loosely grouped' | 'Spread out';
  meanSeparationM: number;
};

/**
 * Hotspot, or scattered?
 *
 * Compares the mean distance between points against what that distance would be
 * for the same number of points spread evenly over the same extent. For a
 * uniform scatter over a square of side s, the mean pairwise distance is about
 * 0.52 s; well under that is clustering, near or over it is not.
 *
 * It is a coarse read and the UI describes it as one. But "these are all in one
 * corner" is the single most actionable thing a map of a field can say, and
 * leaving the reader to infer it from dot positions wastes the plot.
 *
 * Returns null below three points, where the question is not meaningful — two
 * points are always exactly as far apart as they are.
 */
export function describeSpread(metres: Metres[], spanMetres: number): Spread | null {
  if (metres.length < 3) return null;

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < metres.length; i++) {
    for (let j = i + 1; j < metres.length; j++) {
      total += Math.hypot(metres[i].xm - metres[j].xm, metres[i].ym - metres[j].ym);
      pairs++;
    }
  }
  const mean = total / pairs;
  const expected = 0.52 * spanMetres;
  const ratio = mean / (expected || 1);

  const verdict: Spread['verdict'] =
    ratio < 0.6 ? 'Clustered' : ratio > 0.95 ? 'Spread out' : 'Loosely grouped';

  return { verdict, meanSeparationM: mean };
}
