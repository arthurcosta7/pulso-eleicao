import { test } from 'node:test';
import assert from 'node:assert/strict';
import reference from '../data/reference.json' with { type: 'json' };
import { snapshotFixture } from './fixtures/snapshot.mjs';
import { buildForecast } from '../src/lib/forecast.js';
import { project } from '../src/lib/model.js';

test('At 0.25% even extreme early preferences publish no final percentage or forecast curve', () => {
  for (const share of [0.01, 0.99]) {
    const shares = Object.fromEntries(Object.keys(reference.states).map((uf) => [uf, share]));
    const snapshot = snapshotFixture(reference.states, 0.0025, { shares });
    const forecast = buildForecast(snapshot, reference.states);
    assert.ok(forecast.current.valid > 0);
    assert.equal(forecast.available, false);
    assert.equal(forecast.readiness.status, 'insufficient-data');
    assert.equal(forecast.final, null);
    assert.equal(forecast.share, null);
    assert.deepEqual(forecast.points, []);
  }
});

test('Many counted sections do not compensate for a macroregion still missing from the sample', () => {
  const snapshot = snapshotFixture(reference.states, 0.7, { regionProgress: { Nordeste: 0 } });
  const forecast = buildForecast(snapshot, reference.states);
  assert.ok(forecast.readiness.nationalProgress > 0.05);
  assert.equal(forecast.readiness.regionalProgress.Nordeste, 0);
  assert.equal(forecast.available, false);
});

test('Geographic presence alone is insufficient when large electoral strata are still unobserved', () => {
  const snapshot = snapshotFixture(reference.states, 0);
  const observed = snapshotFixture(reference.states, 0.9);
  for (const uf of ['AC', 'AL', 'DF', 'ES', 'RS']) snapshot.states[uf] = observed.states[uf];
  for (const key of ['lula', 'flavio', 'valid', 'counted']) {
    snapshot.national[key] = Object.values(snapshot.states).reduce(
      (sum, state) => sum + state[key],
      0,
    );
  }
  const forecast = buildForecast(snapshot, reference.states);
  assert.ok(forecast.readiness.representedElectorate < 0.8);
  assert.equal(forecast.available, false);
});

test('Substantial disagreement between national and regional files blocks the forecast', () => {
  const snapshot = snapshotFixture(reference.states, 0.2);
  snapshot.national.lula += 10_000_000;
  snapshot.national.valid += 10_000_000;
  const forecast = buildForecast(snapshot, reference.states);
  assert.ok(forecast.readiness.aggregateDifference > 0.02);
  assert.equal(forecast.available, false);
});

test('Balanced coverage releases an experimental forecast and genuine later votes can still change its leader', () => {
  for (const [share, leader] of [
    [0.35, 'flavio'],
    [0.65, 'lula'],
  ]) {
    const shares = Object.fromEntries(Object.keys(reference.states).map((uf) => [uf, share]));
    const forecast = buildForecast(
      snapshotFixture(reference.states, 0.2, { shares }),
      reference.states,
    );
    assert.equal(forecast.available, true);
    assert.equal(forecast.readiness.eligible, true);
    assert.deepEqual(forecast.readiness.reasons, []);
    assert.ok(forecast.final[leader] > forecast.final[leader === 'lula' ? 'flavio' : 'lula']);
  }
});

test('Tiny vote batches cannot stand in for the much larger electorate through local shrinkage weights', () => {
  const shares = Object.fromEntries(
    Object.entries(reference.states).map(([uf, baseline]) => [
      uf,
      Math.min(0.99, baseline.lula / (baseline.lula + baseline.flavio) + 0.1),
    ]),
  );
  const snapshot = snapshotFixture(reference.states, 0.0025, { shares });
  Object.assign(snapshot.states.SP, { lula: 0, flavio: 0, counted: 0, valid: 0 });
  const result = project(snapshot.states, reference.states);
  const sp = result.rows.find((row) => row.uf === 'SP');
  assert.ok(sp.learnedShift > 0);
  assert.ok(sp.learnedShift < 0.02);
});
