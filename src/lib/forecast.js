import { project } from './model.js';

export const MODEL_VERSION = 'learned-regional-shift-v5';
const FORECAST_STEPS = 120;
const PACE_WINDOW = 12;

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

/** Keep distinct real section counts; idle polls do not erase the last measured pace. */
export function appendPaceSample(history, snapshot) {
  const sample = {
    at: snapshot.checkedAt,
    states: Object.fromEntries(
      Object.entries(snapshot.states).map(([uf, state]) => [
        uf,
        { counted: state.counted, sections: state.sections },
      ]),
    ),
  };
  const last = history.at(-1);
  if (!last) return [sample];

  const corrected = Object.entries(sample.states).some(([uf, state]) => {
    const before = last.states[uf];
    return !before || state.sections !== before.sections || state.counted < before.counted;
  });
  if (corrected) return [sample];
  if (Object.keys(sample.states).length !== Object.keys(last.states).length) return [sample];
  if (
    Object.entries(sample.states).every(([uf, state]) => state.counted === last.states[uf].counted)
  ) {
    return history;
  }
  if (Date.parse(sample.at) <= Date.parse(last.at)) return history;
  return [...history, sample].slice(-PACE_WINDOW);
}

function arrivalRates(rows, samples, checkedAt) {
  const pending = rows.map((row) => row.sections - row.counted);
  const totalPending = pending.reduce((sum, value) => sum + value, 0);
  if (!totalPending) return { rates: rows.map(() => 1), intervals: 0, confidence: 0 };

  const totalSections = rows.reduce((sum, row) => sum + row.sections, 0);
  const pooledProgress = 1 - totalPending / totalSections;
  // The accumulated advancement supplies a prior even after a server restart.
  // Pooling a small part of the national advancement keeps zero-count UFs represented.
  const prior = rows.map((row) => {
    const progress = Math.min(
      0.9999,
      Math.max(0.0001, (row.progress + 0.05 * pooledProgress) / 1.05),
    );
    return -Math.log1p(-progress);
  });
  const priorMean = prior.reduce((sum, value, i) => sum + value * pending[i], 0) / totalPending;
  const priorRates = prior.map((value) => value / priorMean);

  const counts = rows.map(() => 0);
  let weightedMinutes = 0;
  let observedCount = 0;
  let intervals = 0;
  let latest = 0;

  for (let index = 1; index < samples.length; index++) {
    const before = samples[index - 1];
    const after = samples[index];
    const minutes = (Date.parse(after.at) - Date.parse(before.at)) / 60_000;
    const age = Math.max(0, (Date.parse(checkedAt) - Date.parse(after.at)) / 60_000);
    if (!(minutes > 0) || age > 30) continue;
    const deltas = rows.map((row) => {
      const start = before.states[row.uf];
      const end = after.states[row.uf];
      if (!start || !end || start.sections !== end.sections || end.counted < start.counted)
        return 0;
      return end.counted - start.counted;
    });
    const total = deltas.reduce((sum, value) => sum + value, 0);
    if (!total) continue;
    const weight = Math.exp(-age / 10);
    deltas.forEach((value, i) => {
      counts[i] += value * weight;
    });
    weightedMinutes += minutes * weight;
    observedCount += total;
    intervals++;
    latest = Math.max(latest, Date.parse(after.at));
  }

  const measured = counts.map((value, i) =>
    pending[i] ? value / weightedMinutes / pending[i] : 0,
  );
  const measuredMean =
    measured.reduce((sum, value, i) => sum + value * pending[i], 0) / totalPending;
  if (!intervals || !Number.isFinite(measuredMean) || measuredMean <= 0) {
    return { rates: priorRates, intervals: 0, confidence: 0 };
  }

  const freshness = Math.exp(-Math.max(0, Date.parse(checkedAt) - latest) / 600_000);
  const confidence =
    ((0.85 * intervals) / (intervals + 2)) *
    Math.min(1, observedCount / (totalPending * 0.01)) *
    freshness;
  const rates = priorRates.map(
    (value, i) => (1 - confidence) * value + (confidence * measured[i]) / measuredMean,
  );
  return { rates, intervals, confidence };
}

function completionAt(rows, rates, target) {
  if (target >= 1) return rows.map(() => 1);
  if (target <= 0) return rows.map(() => 0);
  const remaining = rows.map((r) => r.sections - r.counted);
  const total = remaining.reduce((sum, value) => sum + value, 0);
  let lower = 0;
  let upper = 1;
  const done = (t) =>
    remaining.reduce((sum, value, i) => sum + value * -Math.expm1(-t * rates[i]), 0);
  while (done(upper) < total * target) upper *= 2;
  for (let i = 0; i < 45; i++) {
    const middle = (lower + upper) / 2;
    if (done(middle) < total * target) lower = middle;
    else upper = middle;
  }
  return rates.map((rate) => -Math.expm1(-upper * rate));
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
    method: 'cumulative-progress',
    final: null,
    available: estimate.available && now !== null,
  };
  if (!base.available) return base;

  const rows = estimate.rows;
  let samples = options.paceSamples || [];
  if (!samples.length && options.previous) samples = appendPaceSample([], options.previous);
  samples = appendPaceSample(samples, snapshot);
  const pace = arrivalRates(rows, samples, snapshot.checkedAt);

  const points = [{ ...now, kind: 'forecast' }];
  if (now.progress < 100 && estimate.remaining > 0) {
    for (let step = 1; step <= FORECAST_STEPS; step++) {
      const fraction = (step / FORECAST_STEPS) ** 1.5;
      const completed = completionAt(rows, pace.rates, fraction);
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
    method: pace.intervals ? 'observed-pace' : 'cumulative-progress',
    paceIntervals: pace.intervals,
    paceConfidence: pace.confidence,
    arrivalRates: Object.fromEntries(rows.map((row, index) => [row.uf, pace.rates[index]])),
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
