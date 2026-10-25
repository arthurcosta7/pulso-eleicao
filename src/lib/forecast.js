import { project } from './model.js';

export const MODEL_VERSION = 'adaptive-uf-v3';

export function currentPoint(snapshot) {
  const n = snapshot.national;
  if (!n || n.valid === 0 || n.sections === 0) return null;
  return {
    id: `${n.id}:${snapshot.checkedAt}`,
    at: snapshot.checkedAt,
    progress: (n.counted / n.sections) * 100,
    lula: n.lula,
    flavio: n.flavio,
    valid: n.valid,
    counted: n.counted,
    kind: 'observed',
  };
}

function completionAt(rows, weights, target) {
  if (target >= 1) return rows.map(() => 1);
  if (target <= 0) return rows.map(() => 0);
  const remaining = rows.map((r) => r.sections - r.counted);
  const total = remaining.reduce((sum, value) => sum + value, 0);
  let lower = 0;
  let upper = 1;
  const done = (t) =>
    remaining.reduce((sum, value, i) => sum + value * Math.min(1, t * weights[i]), 0);
  while (done(upper) < total * target) upper *= 2;
  for (let i = 0; i < 45; i++) {
    const middle = (lower + upper) / 2;
    if (done(middle) < total * target) lower = middle;
    else upper = middle;
  }
  return weights.map((weight) => Math.min(1, upper * weight));
}

/** Forward paths start at official BR; regional estimates allocate only future votes. */
export function buildForecast(snapshot, reference, options = {}) {
  const estimate = project(snapshot.states, reference);
  const now = currentPoint(snapshot);
  const base = {
    ...estimate,
    version: MODEL_VERSION,
    points: [],
    current: now,
    method: 'proportional',
    final: null,
    available: estimate.available && now !== null,
  };
  if (!base.available) return base;

  const rows = estimate.rows;
  const remainingSections = rows.reduce((sum, r) => sum + r.sections - r.counted, 0);
  const sampleDeltas = rows.map((r) => {
    const before = options.previous?.states?.[r.uf];
    return before ? Math.max(0, r.counted - before.counted) : 0;
  });
  const observedDelta = sampleDeltas.reduce((sum, value) => sum + value, 0);
  const paceAvailable = observedDelta > 0 && remainingSections > 0;

  // A proportional floor keeps a delayed UF in the future allocation.
  const weights = rows.map((r, i) => {
    const remaining = r.sections - r.counted;
    if (!paceAvailable || remaining === 0) return 1;
    return 0.25 + (0.75 * (sampleDeltas[i] / observedDelta)) / (remaining / remainingSections);
  });

  const points = [{ ...now, kind: 'forecast' }];
  if (now.progress < 100 && estimate.remaining > 0) {
    for (let step = 1; step <= 40; step++) {
      const fraction = step / 40;
      const completed = completionAt(rows, weights, fraction);
      let lula = now.lula;
      let flavio = now.flavio;
      rows.forEach((r, i) => {
        const votes = r.remaining * completed[i];
        lula += votes * r.share;
        flavio += votes * (1 - r.share);
      });
      points.push({
        progress: now.progress + (100 - now.progress) * fraction,
        lula,
        flavio,
        valid: lula + flavio,
        kind: 'forecast',
      });
    }
  }
  const final = points.at(-1);
  return {
    ...base,
    points,
    final,
    share: final.lula / final.valid,
    method: paceAvailable ? 'observed-pace' : 'proportional',
    regionalDifference: estimate.observed - now.lula - now.flavio,
  };
}

export function mergeHistory(previous, incoming) {
  const records = new Map();
  for (const point of [...previous, ...incoming]) {
    if (
      !Number.isFinite(point.progress) ||
      !Number.isFinite(point.lula) ||
      !Number.isFinite(point.flavio) ||
      point.valid <= 0 ||
      !point.at
    )
      continue;
    const key = `${point.counted}:${point.lula}:${point.flavio}`;
    records.set(key, records.get(key) ?? point);
  }
  return [...records.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-720);
}

export function selectHistoryThrough(history, current) {
  if (!current) return [];
  return history.filter(
    (point) => Date.parse(point.at) <= Date.parse(current.at) && point.progress <= current.progress,
  );
}
