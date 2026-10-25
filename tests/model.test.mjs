import { test } from 'node:test';
import assert from 'node:assert/strict';
import referenceData from '../data/reference.json' with { type: 'json' };
import { normalize, project, STATES, groupRows } from '../src/lib/model.js';
import { snapshotFixture } from './fixtures/snapshot.mjs';

const reference = referenceData.states;

test('Before live votes the regional preference is exactly the real first-round reference', () => {
  const { states } = snapshotFixture(reference, 0);
  const result = project(states, reference);
  assert.equal(result.available, false);
  assert.equal(result.unknown, 0);
  for (const row of result.rows) {
    const baseline = reference[row.uf];
    assert.equal(row.share, baseline.lula / (baseline.lula + baseline.flavio));
    assert.equal(row.credibility, 0);
  }
});

test('Completed sections converge to observed votes', () => {
  const { states, national } = snapshotFixture(reference, 1);
  const result = project(states, reference);
  assert.equal(result.remaining, 0);
  assert.equal(result.lula, national.lula);
  assert.equal(result.flavio, national.flavio);
});

test('Exterior and regional aggregates conserve votes and historical reference totals', () => {
  const { states, national } = snapshotFixture(reference, 0.58);
  const result = project(states, reference);
  const groups = groupRows(result.rows);
  assert.equal(result.rows.length, 28);
  assert.equal(result.rows.filter((row) => row.uf === 'ZZ').length, 1);
  assert.equal(result.observed, national.lula + national.flavio);
  assert.equal(
    groups.reduce((sum, group) => sum + group.lula, 0),
    national.lula,
  );
  assert.equal(groups.find((group) => group.name === 'Exterior').states, 1);
  assert.equal(
    groups.reduce((sum, group) => sum + group.referenceLula, 0),
    Object.values(reference).reduce((sum, value) => sum + value.lula, 0),
  );
});

test('A missing UF suppresses the national projection', () => {
  const { states } = snapshotFixture(reference, 0.5);
  delete states.BA;
  const result = project(states, reference);
  assert.equal(result.available, false);
  assert.equal(result.unknown, 1);
});

test('More local counted votes replace historical preference with the observed preference', () => {
  const early = project(
    snapshotFixture(reference, 0.01, { shares: { BA: 0.2 } }).states,
    reference,
  );
  const later = project(snapshotFixture(reference, 0.8, { shares: { BA: 0.2 } }).states, reference);
  const first = early.rows.find((row) => row.uf === 'BA');
  const last = later.rows.find((row) => row.uf === 'BA');
  assert.ok(Math.abs(last.share - 0.2) < Math.abs(first.share - 0.2));
  assert.ok(last.credibility > first.credibility);
  assert.equal(last.referenceLula, reference.BA.lula);
});

test('Expected remaining volume adapts to actual votes per counted section', () => {
  const regular = project(snapshotFixture(reference, 0.5).states, reference);
  const lowerTurnout = project(snapshotFixture(reference, 0.5, { volume: 0.7 }).states, reference);
  assert.ok(lowerTurnout.remaining < regular.remaining * 0.85);
  assert.ok(lowerTurnout.remaining > 0);
  for (const row of lowerTurnout.rows) assert.ok(row.estimatedLula >= row.lula);
});

test('Underrepresented regions retain their real historical weight in the final projection', () => {
  const snapshot = snapshotFixture(reference, 0.5, {
    regionProgress: { Nordeste: 0.2, Sudeste: 0.7, Sul: 0.8 },
  });
  const result = project(snapshot.states, reference);
  assert.ok(result.share > snapshot.national.lula / snapshot.national.valid + 0.01);
});

test('Nested EA20 parsing rejects missing candidates and inconsistent totals', () => {
  const fixture = {
    carg: [
      {
        cd: '1',
        agr: [
          {
            par: [
              {
                cand: [
                  { n: '13', vap: '60' },
                  { n: '22', vap: '40' },
                ],
              },
            ],
          },
        ],
      },
    ],
    s: { ts: '20', st: '10' },
    v: { vv: '100', vb: '3', tvn: '2' },
    e: { te: '1000' },
    dg: '25/10/2026',
    hg: '18:00:00',
    idg: 'test',
  };
  assert.equal(normalize(fixture).lula, 60);
  assert.equal(normalize(fixture).flavio, 40);
  assert.throws(() => normalize({}));
  assert.throws(() => normalize({ ...fixture, v: { vv: '99' } }));
  assert.throws(() => normalize({ ...fixture, s: { ts: '20', st: '21' } }));
});

test('The first-round reference covers every UF and the exterior with official source URLs', () => {
  assert.deepEqual(Object.keys(reference).sort(), STATES.map((state) => state.uf).sort());
  for (const state of Object.values(reference)) {
    assert.ok(state.sections > 0);
    assert.ok(state.valid >= state.lula + state.flavio);
    assert.ok(state.source.startsWith('https://resultados.tse.jus.br/oficial/ele2026/6257/'));
  }
});
