import { test } from 'node:test';
import assert from 'node:assert/strict';
import reference from '../data/reference.json' with { type: 'json' };
import { snapshotFixture } from './fixtures/snapshot.mjs';
import {
  buildForecast,
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
  assert.equal(forecast.points.length, 41);
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
