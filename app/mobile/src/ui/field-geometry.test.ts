/**
 * The map is the one chart here that can be silently wrong.
 *
 * A mark in the wrong place still looks like a map, and a clustering verdict
 * computed from a bad projection reads exactly as confidently as a good one.
 * These pin the geometry so that cannot happen quietly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeSpread,
  extentMetres,
  pickScaleMetres,
  toMetres,
  toUnitSquare,
} from './field-geometry.ts';

const DELHI = { lat: 28.6139, lon: 77.209 };

test('a degree of latitude is about 111 km', () => {
  const { metres } = toMetres([DELHI, { lat: DELHI.lat + 1, lon: DELHI.lon }]);
  const northward = metres[1].ym - metres[0].ym;
  assert.ok(Math.abs(northward - 111_320) < 1, `got ${northward}`);
});

test('longitude is compressed by latitude, not treated as equal to latitude', () => {
  // The bug this catches: using 111320 for both axes stretches the plot
  // east-west by ~12% at Delhi, which would skew every clustering verdict.
  const { metres } = toMetres([DELHI, { lat: DELHI.lat, lon: DELHI.lon + 1 }]);
  const eastward = metres[1].xm - metres[0].xm;
  const expected = 111_320 * Math.cos((DELHI.lat * Math.PI) / 180);
  assert.ok(Math.abs(eastward - expected) < 1, `got ${eastward}, expected ~${expected}`);
  assert.ok(eastward < 111_320 * 0.9, 'longitude must be compressed at this latitude');
});

test('points are centred on their own bounding box', () => {
  const { metres } = toMetres([
    { lat: 28.6, lon: 77.2 },
    { lat: 28.602, lon: 77.202 },
  ]);
  assert.ok(Math.abs(metres[0].xm + metres[1].xm) < 1e-6, 'x should be symmetric about 0');
  assert.ok(Math.abs(metres[0].ym + metres[1].ym) < 1e-6, 'y should be symmetric about 0');
});

test('north is up: a more northerly point plots higher', () => {
  const { metres } = toMetres([
    { lat: 28.6, lon: 77.2 },
    { lat: 28.601, lon: 77.2 },
  ]);
  const span = extentMetres(metres);
  const south = toUnitSquare(metres[0], span);
  const north = toUnitSquare(metres[1], span);
  assert.ok(north.y < south.y, 'a northerly point must have a smaller y (higher on screen)');
});

test('projected points land inside the unit square', () => {
  const pts = [
    { lat: 28.6139, lon: 77.209 },
    { lat: 28.6142, lon: 77.2094 },
    { lat: 28.6137, lon: 77.2101 },
  ];
  const { metres } = toMetres(pts);
  const span = extentMetres(metres);
  for (const m of metres) {
    const u = toUnitSquare(m, span);
    assert.ok(u.x >= 0 && u.x <= 1, `x out of range: ${u.x}`);
    assert.ok(u.y >= 0 && u.y <= 1, `y out of range: ${u.y}`);
  }
});

test('a tight cluster is floored, not stretched to fill the plot', () => {
  // Three points within a couple of metres. The GPS cannot resolve that, so
  // the extent must not zoom in and invent a spread.
  const { metres } = toMetres([
    { lat: 28.6139, lon: 77.209 },
    { lat: 28.61391, lon: 77.20901 },
    { lat: 28.61389, lon: 77.20899 },
  ]);
  assert.equal(extentMetres(metres), 10, 'extent must floor at 10 m');
});

test('the scale bar is a round number that fits in the plot', () => {
  for (const span of [10, 37, 120, 460, 2000]) {
    const bar = pickScaleMetres(span);
    assert.ok(bar <= span, `bar ${bar} does not fit in span ${span}`);
    assert.ok([1, 2, 5, 10, 20, 50, 100, 200, 500].includes(bar), `${bar} is not a round step`);
  }
});

// ---- The clustering verdict ----------------------------------------------

test('points in one corner read as clustered', () => {
  const metres = [
    { xm: -20, ym: -20 },
    { xm: -19, ym: -21 },
    { xm: -21, ym: -19 },
    { xm: -20, ym: -22 },
  ];
  const spread = describeSpread(metres, 50);
  assert.equal(spread?.verdict, 'Clustered');
});

test('points at the corners of the extent read as spread out', () => {
  const metres = [
    { xm: -25, ym: -25 },
    { xm: 25, ym: -25 },
    { xm: -25, ym: 25 },
    { xm: 25, ym: 25 },
  ];
  const spread = describeSpread(metres, 50);
  assert.equal(spread?.verdict, 'Spread out');
});

test('fewer than three points gets no verdict rather than a guess', () => {
  // Two points are always exactly as far apart as they are; there is no
  // clustering question to answer, so none is answered.
  assert.equal(describeSpread([{ xm: 0, ym: 0 }], 50), null);
  assert.equal(describeSpread([{ xm: 0, ym: 0 }, { xm: 10, ym: 10 }], 50), null);
});

test('mean separation is a real distance, not a normalised score', () => {
  const metres = [
    { xm: 0, ym: 0 },
    { xm: 10, ym: 0 },
    { xm: 20, ym: 0 },
  ];
  // Pairs are 10, 20 and 10 apart -> mean 13.33 m.
  const spread = describeSpread(metres, 20);
  assert.ok(Math.abs((spread?.meanSeparationM ?? 0) - 40 / 3) < 1e-9);
});

test('the scale bar stays a key, not a second measurement of the field', () => {
  // It jumped to 47% of the plot width before this was pinned, which reads as
  // "the field is about this wide" rather than as a scale.
  for (const span of [10, 37, 107.5, 460, 2000]) {
    const frac = pickScaleMetres(span) / span;
    assert.ok(frac <= 0.34, `bar is ${(frac * 100).toFixed(0)}% of the plot at span ${span}`);
    assert.ok(frac >= 0.1, `bar is only ${(frac * 100).toFixed(0)}% of the plot at span ${span}`);
  }
});
