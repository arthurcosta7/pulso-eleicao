import { test } from 'node:test';
import assert from 'node:assert/strict';
import reference from '../data/reference.json' with { type: 'json' };
import { snapshotFixture } from './fixtures/snapshot.mjs';
import {
  buildForecast,
  appendPaceSample,
  currentPoint,
  mergeHistory,
  selectHistoryThrough,
} from '../src/lib/forecast.js';

test('The forecast starts exactly at the current official point, even when regional sources lag BR', () => {
  const snapshot = snapshotFixture(reference.states, 0.48);
  snapshot.national.lula += 8000;
  snapshot.national.valid += 8000;
  const forecast = buildForecast(snapshot, reference.states);
  assert.equal(forecast.points[0].lula, snapshot.national.lula);
  assert.equal(forecast.points[0].flavio, snapshot.national.flavio);
  assert.equal(
    forecast.points[0].progress,
    (snapshot.national.counted / snapshot.national.sections) * 100,
  );
  assert.ok(Math.abs(forecast.final.valid - snapshot.national.valid - forecast.remaining) < 0.001);
});

test('The full projected path reaches 100%, conserves votes and never removes observed votes', () => {
  const snapshot = snapshotFixture(reference.states, 0.58);
  const previous = snapshotFixture(reference.states, 0.55);
  const forecast = buildForecast(snapshot, reference.states, { previous });
  assert.equal(forecast.method, 'observed-pace');
  assert.equal(forecast.final.progress, 100);
  assert.equal(forecast.points.length, 121);
  for (let i = 1; i < forecast.points.length; i++) {
    const p = forecast.points[i];
    const before = forecast.points[i - 1];
    assert.ok(p.progress > before.progress);
    assert.ok(p.lula >= before.lula && p.flavio >= before.flavio);
    assert.ok(Math.abs(p.lula + p.flavio - p.valid) < 0.001);
  }
});

test('Completed apuração makes the forecast identical to now, with no fictitious future', () => {
  const snapshot = snapshotFixture(reference.states, 1);
  const forecast = buildForecast(snapshot, reference.states);
  assert.equal(forecast.points.length, 1);
  assert.equal(forecast.final.lula, snapshot.national.lula);
  assert.equal(forecast.final.flavio, snapshot.national.flavio);
  assert.equal(forecast.remaining, 0);
});

test('No live votes or a missing UF means no forecast curve', () => {
  assert.equal(
    buildForecast(snapshotFixture(reference.states, 0), reference.states).available,
    false,
  );
  const snapshot = snapshotFixture(reference.states, 0.5);
  delete snapshot.states.ZZ;
  const forecast = buildForecast(snapshot, reference.states);
  assert.equal(forecast.available, false);
  assert.deepEqual(forecast.points, []);
});

test('Different observed regional coverage changes the raw national result', () => {
  const slow = snapshotFixture(reference.states, 0.58, { regionProgress: { Nordeste: 0.2 } });
  const fast = snapshotFixture(reference.states, 0.58, { regionProgress: { Nordeste: 0.8 } });
  assert.ok(fast.states.BA.counted > slow.states.BA.counted);
  assert.ok(fast.national.lula / fast.national.valid > slow.national.lula / slow.national.valid);
});

test('History deduplicates unchanged results, ignores invalid points and filters superseded totals', () => {
  const a = currentPoint(snapshotFixture(reference.states, 0.4));
  const b = currentPoint(snapshotFixture(reference.states, 0.5));
  a.at = '2026-10-25T20:00:00Z';
  b.at = '2026-10-25T20:01:00Z';
  const history = mergeHistory([a], [a, b, { valid: 0 }]);
  assert.equal(history.length, 2);
  assert.equal(selectHistoryThrough(history, a).length, 1);
});

test('Different regional advancement produces a curved path rather than a straight connection to the final total', () => {
  const snapshot = snapshotFixture(reference.states, 0.4, {
    regionProgress: { Nordeste: 0.12, Sudeste: 0.65, Sul: 0.8, Norte: 0.3 },
  });
  const forecast = buildForecast(snapshot, reference.states);
  assert.equal(forecast.method, 'cumulative-progress');
  assert.ok(forecast.arrivalRates.BA < forecast.arrivalRates.SP);
  assert.ok(forecast.arrivalRates.BA > 0);
  const deviations = forecast.points.slice(1, -1).map((point) => {
    const fraction =
      (point.progress - forecast.current.progress) / (100 - forecast.current.progress);
    const straightLine =
      forecast.current.lula + fraction * (forecast.final.lula - forecast.current.lula);
    return Math.abs(point.lula - straightLine);
  });
  assert.ok(Math.max(...deviations) > 100_000);
});

test('Arrival history changes the route while preserving the same observed start and estimated endpoint', () => {
  const snapshot = snapshotFixture(reference.states, 0.5);
  const earlierNortheast = snapshotFixture(reference.states, 0.49, {
    regionProgress: { Nordeste: 0.45 },
  });
  const earlierSoutheast = snapshotFixture(reference.states, 0.49, {
    regionProgress: { Sudeste: 0.45 },
  });
  const a = buildForecast(snapshot, reference.states, { previous: earlierNortheast });
  const b = buildForecast(snapshot, reference.states, { previous: earlierSoutheast });
  assert.ok(a.arrivalRates.BA > a.arrivalRates.SP);
  assert.ok(b.arrivalRates.SP > b.arrivalRates.BA);
  assert.equal(a.final.lula, b.final.lula);
  assert.equal(a.points[0].lula, b.points[0].lula);
  assert.ok(Math.abs(a.points[50].lula - b.points[50].lula) > 1000);
});

test('A poll with no new sections preserves several measured intervals instead of reverting to proportional allocation', () => {
  const snapshots = [0.4, 0.43, 0.46].map((p) => snapshotFixture(reference.states, p));
  let samples = [];
  for (const snapshot of snapshots) samples = appendPaceSample(samples, snapshot);
  const latest = snapshots.at(-1);
  const idle = {
    ...latest,
    checkedAt: new Date(Date.parse(latest.checkedAt) + 60_000).toISOString(),
  };
  assert.equal(appendPaceSample(samples, idle), samples);
  const before = buildForecast(latest, reference.states, { paceSamples: samples });
  const after = buildForecast(idle, reference.states, { paceSamples: samples });
  assert.equal(after.method, 'observed-pace');
  assert.equal(after.paceIntervals, 2);
  assert.equal(before.final.lula, after.final.lula);
  assert.ok(after.paceConfidence > 0);
});

test('Regional pace samples are bounded and reset after a correction to counted sections', () => {
  let samples = [];
  for (let i = 1; i <= 20; i++) {
    samples = appendPaceSample(samples, snapshotFixture(reference.states, i / 25));
  }
  assert.equal(samples.length, 12);
  const correction = snapshotFixture(reference.states, 0.79);
  correction.checkedAt = '2026-10-25T22:00:00Z';
  assert.equal(appendPaceSample(samples, correction).length, 1);
});
