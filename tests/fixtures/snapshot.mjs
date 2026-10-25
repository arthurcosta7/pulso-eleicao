import { STATES } from '../../src/lib/model.js';

// Test-only inputs. This file is never imported by the application or API.
export function snapshotFixture(
  reference,
  progress,
  { regionProgress = {}, shares = {}, volume = 1 } = {},
) {
  const states = {};
  for (const info of STATES) {
    const baseline = reference[info.uf];
    const fraction = regionProgress[info.region] ?? progress;
    const counted = Math.round(baseline.sections * fraction);
    const valid = Math.round(((baseline.valid * counted) / baseline.sections) * volume);
    const share = shares[info.uf] ?? baseline.lula / (baseline.lula + baseline.flavio);
    const lula = Math.round(valid * share);
    states[info.uf] = {
      ...baseline,
      counted,
      valid,
      lula,
      flavio: valid - lula,
      id: `test-${info.uf}-${counted}`,
      final: counted === baseline.sections,
    };
  }
  const sum = (key) => Object.values(states).reduce((total, state) => total + state[key], 0);
  return {
    states,
    national: {
      lula: sum('lula'),
      flavio: sum('flavio'),
      valid: sum('valid'),
      sections: sum('sections'),
      counted: sum('counted'),
      blank: 0,
      nullVotes: 0,
      id: `test-${progress}`,
      date: '25/10/2026',
      time: '18:00:00',
      final: progress === 1,
    },
    checkedAt: '2026-10-25T21:00:00Z',
  };
}
