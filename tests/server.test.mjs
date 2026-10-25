import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElectionService, REFRESH_INTERVAL } from '../src/server/tse.js';

function fixture(uf) {
  return {
    ele: '6258', t: '2', idg: `fixture-${uf}`, dg: '25/10/2026', hg: '19:00:00',
    carg: [{ cd: '1', agr: [{ par: [{ cand: [{ n: '13', vap: '60' }, { n: '22', vap: '40' }] }] }] }],
    s: { ts: '20', st: '10' }, v: { vv: '100' }, e: { te: '1000' },
  };
}

test('Backend deduplicates concurrent requests, caps concurrency at four and caches for 60 seconds', async () => {
  let calls = 0;
  let active = 0;
  let peak = 0;
  let currentTime = 0;
  const service = createElectionService({
    now: () => currentTime,
    fetcher: async url => {
      calls++; active++; peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return Response.json(fixture(url));
    },
  });
  const [a, b] = await Promise.all([service.get(), service.get()]);
  assert.equal(a, b);
  assert.equal(calls, 29);
  assert.ok(peak <= 4);
  currentTime = REFRESH_INTERVAL - 1;
  await service.get();
  assert.equal(calls, 29);
  currentTime = REFRESH_INTERVAL;
  await service.get();
  assert.equal(calls, 58);
});

test('A failed refresh preserves the previous complete snapshot and its original collection time', async () => {
  let fail = false;
  let currentTime = 0;
  const service = createElectionService({
    now: () => currentTime,
    fetcher: async url => fail && url.includes('/ba/')
      ? new Response('Unavailable', { status: 503 }) : Response.json(fixture(url)),
  });
  const first = await service.get();
  currentTime = REFRESH_INTERVAL;
  fail = true;
  const next = await service.get();
  assert.equal(next.stale, true);
  assert.equal(next.snapshot, first.snapshot);
  assert.notEqual(next.attemptedAt, next.snapshot.checkedAt);
  assert.equal(next.errors[0].uf, 'BA');
});

test('An initial incomplete batch suppresses projection and a platform block stops further requests', async () => {
  let calls = 0;
  const blocked = createElectionService({ fetcher: async () => { calls++; return new Response('', { status: 429 }); } });
  const result = await blocked.get();
  assert.equal(result.snapshot, null);
  assert.equal(result.stale, true);
  assert.ok(calls <= 4);
  const partial = createElectionService({
    fetcher: async url => url.includes('/zz/') ? new Response('', { status: 503 }) : Response.json(fixture(url)),
  });
  const incomplete = await partial.get();
  assert.equal(incomplete.forecast.available, false);
  assert.equal(incomplete.stale, true);
});

test('Files from a different election or round are rejected', async () => {
  const service = createElectionService({
    fetcher: async url => Response.json({ ...fixture(url), ele: '6257', t: '1' }),
  });
  const result = await service.get();
  assert.equal(result.snapshot, null);
  assert.equal(result.errors.length, 29);
});

test('A transient failure is retried after collecting the other UFs', async () => {
  let failed = false;
  const visited = [];
  const service = createElectionService({
    fetcher: async url => {
      const uf = url.split('/dados/')[1].split('/')[0];
      visited.push(uf);
      if (uf === 'mg' && !failed) {
        failed = true;
        throw new Error('The operation was aborted due to timeout');
      }
      return Response.json(fixture(url));
    },
  });
  const result = await service.get();
  assert.equal(result.stale, false);
  assert.deepEqual(result.errors, []);
  assert.equal(Object.keys(result.snapshot.states).length, 28);
  assert.equal(visited.length, 30);
  assert.equal(visited.at(-1), 'mg');
});
