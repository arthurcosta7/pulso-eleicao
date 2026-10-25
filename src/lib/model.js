export const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Exterior'];

export const STATES = [
  ['AC', 'Acre', 0],
  ['AL', 'Alagoas', 1],
  ['AP', 'Amapá', 0],
  ['AM', 'Amazonas', 0],
  ['BA', 'Bahia', 1],
  ['CE', 'Ceará', 1],
  ['DF', 'Distrito Federal', 2],
  ['ES', 'Espírito Santo', 3],
  ['GO', 'Goiás', 2],
  ['MA', 'Maranhão', 1],
  ['MT', 'Mato Grosso', 2],
  ['MS', 'Mato Grosso do Sul', 2],
  ['MG', 'Minas Gerais', 3],
  ['PA', 'Pará', 0],
  ['PB', 'Paraíba', 1],
  ['PR', 'Paraná', 4],
  ['PE', 'Pernambuco', 1],
  ['PI', 'Piauí', 1],
  ['RJ', 'Rio de Janeiro', 3],
  ['RN', 'Rio Grande do Norte', 1],
  ['RS', 'Rio Grande do Sul', 4],
  ['RO', 'Rondônia', 0],
  ['RR', 'Roraima', 0],
  ['SC', 'Santa Catarina', 4],
  ['SP', 'São Paulo', 3],
  ['SE', 'Sergipe', 1],
  ['TO', 'Tocantins', 0],
  ['ZZ', 'Exterior', 5],
].map(([uf, name, region]) => ({ uf, name, region: REGIONS[region] }));

const asNumber = value => Number(String(value ?? 0).replace(',', '.'));

export function normalize(data) {
  const cargo = data.carg?.find(item => String(item.cd) === '1');
  if (!cargo || !data.s || !data.v) throw new Error('Formato do TSE não reconhecido');

  const candidates = (cargo.agr ?? []).flatMap(group =>
    (group.par ?? []).flatMap(party => party.cand ?? []));
  const lulaCandidate = candidates.find(candidate => String(candidate.n) === '13');
  const flavioCandidate = candidates.find(candidate => String(candidate.n) === '22');
  if (!lulaCandidate || !flavioCandidate) throw new Error('Candidaturas esperadas ausentes');

  const result = {
    lula: asNumber(lulaCandidate.vap),
    flavio: asNumber(flavioCandidate.vap),
    valid: asNumber(data.v.vv),
    sections: asNumber(data.s.ts),
    counted: asNumber(data.s.st),
    electors: asNumber(data.e?.te),
    blank: asNumber(data.v.vb),
    nullVotes: asNumber(data.v.tvn),
    date: data.dt || data.dg,
    time: data.ht || data.hg,
    id: data.idg,
    final: data.tf === 's',
    elected: candidates.find(candidate => candidate.e === 's'
      && /^eleito$/i.test(candidate.st ?? ''))?.n ?? null,
  };

  const invalidNumber = Object.values(result).some(value =>
    typeof value === 'number' && (!Number.isFinite(value) || value < 0));
  if (invalidNumber || result.counted > result.sections
    || result.lula + result.flavio > result.valid) {
    throw new Error('Totais inválidos no arquivo do TSE');
  }
  return result;
}

/** Pure per-UF estimate. Official national anchoring is handled in forecast.js. */
export function project(states, reference, { swing = 0, turnout = 1 } = {}) {
  let lula = 0;
  let flavio = 0;
  let remaining = 0;
  let observed = 0;
  let unknown = 0;
  const rows = [];

  for (const info of STATES) {
    const current = states[info.uf];
    const baseline = reference[info.uf];
    if (!current || !baseline) {
      unknown++;
      continue;
    }

    const progress = current.sections ? current.counted / current.sections : 0;
    const votes = current.lula + current.flavio;
    const baselinePair = baseline.lula + baseline.flavio;
    const prior = baselinePair ? baseline.lula / baselinePair : 0.5;
    const expectedVolume = baseline.sections
      ? baseline.valid * current.sections / baseline.sections : baseline.valid;
    const rest = progress >= 1 ? 0 : Math.max(0, expectedVolume * turnout * (1 - progress));
    const credibility = progress / (progress + 0.05);
    const blendedShare = votes
      ? credibility * current.lula / votes + (1 - credibility) * prior : prior;
    const share = Math.max(0, Math.min(1, blendedShare + swing / 100));
    const estimatedLula = current.lula + rest * share;
    const estimatedFlavio = current.flavio + rest * (1 - share);

    lula += estimatedLula;
    flavio += estimatedFlavio;
    remaining += rest;
    observed += votes;
    rows.push({
      ...info, ...current, progress, remaining: rest,
      estimatedLula, estimatedFlavio, share, prior,
    });
  }

  return {
    lula, flavio, remaining, observed, unknown, rows,
    share: lula + flavio ? lula / (lula + flavio) : null,
    available: unknown === 0 && observed > 0,
  };
}

export function groupRows(rows) {
  return REGIONS.map(name => {
    const matching = rows.filter(row => row.region === name);
    const sum = key => matching.reduce((total, row) => total + row[key], 0);
    return {
      name, states: matching.length,
      lula: sum('lula'), flavio: sum('flavio'),
      sections: sum('sections'), counted: sum('counted'), remaining: sum('remaining'),
      estimatedLula: sum('estimatedLula'), estimatedFlavio: sum('estimatedFlavio'),
    };
  });
}

/** Fictitious arrivals for the simulator tab; never used by the TSE service. */
export function demo(reference, progress = 0.58, { northeastDelay = 1.8 } = {}) {
  const delays = {
    Norte: 0.88, Nordeste: northeastDelay, 'Centro-Oeste': 0.62,
    Sudeste: 0.68, Sul: 0.55, Exterior: 0.35,
  };
  const states = {};

  for (const state of STATES) {
    const baseline = reference[state.uf];
    const fraction = progress >= 1 ? 1 : Math.min(0.999, Math.pow(progress, delays[state.region]));
    const preference = Math.max(0.02, Math.min(0.98,
      baseline.lula / (baseline.lula + baseline.flavio) + 0.012));
    const valid = Math.round(baseline.valid * fraction);
    const lula = Math.round(valid * preference);

    states[state.uf] = {
      ...baseline,
      counted: Math.round(baseline.sections * fraction),
      lula, flavio: valid - lula, valid, blank: 0, nullVotes: 0,
      date: 'Cenário fictício', time: '', id: 'demo-' + progress, final: fraction === 1,
    };
  }

  const sum = key => Object.values(states).reduce((total, state) => total + state[key], 0);
  return {
    states,
    national: {
      lula: sum('lula'), flavio: sum('flavio'), valid: sum('valid'),
      sections: sum('sections'), counted: sum('counted'),
      blank: 0, nullVotes: 0, date: 'Simulação', time: '',
      id: 'demo-' + progress, final: progress >= 1,
    },
    checkedAt: new Date().toISOString(),
    errors: [],
    simulation: true,
  };
}

