import reference from '../../data/reference.json' with { type: 'json' };
import { normalize, STATES } from '../lib/model.js';
import { buildForecast, currentPoint, mergeHistory } from '../lib/forecast.js';

export const REFRESH_INTERVAL = 60_000;
const ORIGIN = 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados';

export function officialURL(uf) {
  const code = uf.toLowerCase();
  return `${ORIGIN}/${code}/${code}-c0001-e006258-u.json`;
}

export function createElectionService({ fetcher = fetch, now = Date.now } = {}) {
  let cached = null;
  let lastAttempt = -Infinity;
  let pending = null;
  let history = [];
  let lastResponse = null;

  async function collect() {
    lastAttempt = now();
    const states = {};
    const errors = [];
    let national = null;
    const signal = AbortSignal.timeout(25_000);
    const codes = ['BR', ...STATES.map(state => state.uf)];

    for (let offset = 0; offset < codes.length; offset += 4) {
      await Promise.all(codes.slice(offset, offset + 4).map(async uf => {
        try {
          const response = await fetcher(officialURL(uf), { signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          if (String(payload.ele) !== '6258' || String(payload.t) !== '2') {
            throw new Error('Arquivo de outro turno ou eleição');
          }
          const value = normalize(payload);
          if (uf === 'BR') national = value;
          else states[uf] = value;
        } catch (error) {
          errors.push({ uf, message: error.message });
        }
      }));
      if (signal.aborted || errors.some(error => /HTTP (403|429)/.test(error.message))) {
        for (const uf of codes.slice(offset + 4)) {
          errors.push({ uf, message: 'Consulta interrompida após timeout ou bloqueio do TSE' });
        }
        break;
      }
    }

    const checkedAt = new Date(now()).toISOString();
    if (errors.length > 0 && cached) {
      return { ...cached, stale: true, errors, attemptedAt: checkedAt };
    }
    if (!national) {
      return { snapshot: null, forecast: null, history, reference, stale: true, errors,
        attemptedAt: checkedAt, refreshInterval: REFRESH_INTERVAL };
    }

    const snapshot = { national, states, checkedAt };
    const forecast = buildForecast(snapshot, reference.states, { previous: cached?.snapshot });
    const point = currentPoint(snapshot);
    if (point && errors.length === 0) history = mergeHistory(history, [point]);
    const result = {
      snapshot, forecast, history, reference, stale: errors.length > 0, errors,
      attemptedAt: checkedAt, refreshInterval: REFRESH_INTERVAL,
    };
    if (errors.length === 0) cached = result;
    return result;
  }

  return {
    async get() {
      if (pending) return pending;
      if (lastResponse && now() - lastAttempt < REFRESH_INTERVAL) return lastResponse;
      pending = collect()
        .then(result => { lastResponse = result; return result; })
        .finally(() => { pending = null; });
      return pending;
    },
  };
}

export const electionService = createElectionService();
