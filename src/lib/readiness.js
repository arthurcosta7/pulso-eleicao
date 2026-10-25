// Conservative publication guards, not calibrated confidence levels.
// Passing them does not validate the statistical model or declare a winner.
export const PUBLICATION_RULES = Object.freeze({
  minNationalProgress: 0.05,
  minRegionalProgress: 0.01,
  minStateProgress: 0.01,
  minRepresentedElectorate: 0.8,
  maxAggregateDifference: 0.02,
});

export function assessReadiness(snapshot, estimate) {
  const national = snapshot.national;
  const domestic = estimate.rows.filter((row) => row.uf !== 'ZZ');
  const nationalProgress = national?.sections ? national.counted / national.sections : 0;
  const electorate = domestic.reduce((sum, row) => sum + row.referenceValid, 0);
  const represented = domestic
    .filter(
      (row) => row.progress >= PUBLICATION_RULES.minStateProgress && row.observedShare !== null,
    )
    .reduce((sum, row) => sum + row.referenceValid, 0);
  const representedElectorate = electorate ? represented / electorate : 0;
  const regionalProgress = Object.fromEntries(
    ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'].map((region) => {
      const rows = domestic.filter((row) => row.region === region);
      const sections = rows.reduce((sum, row) => sum + row.sections, 0);
      return [region, sections ? rows.reduce((sum, row) => sum + row.counted, 0) / sections : 0];
    }),
  );
  const incompleteRegions = Object.entries(regionalProgress)
    .filter(([, progress]) => progress < PUBLICATION_RULES.minRegionalProgress)
    .map(([name]) => name);
  const nationalVotes = (national?.lula || 0) + (national?.flavio || 0);
  const aggregateDifference =
    Math.abs(estimate.observed - nationalVotes) / Math.max(1, estimate.observed, nationalVotes);
  const reasons = [];

  if (estimate.unknown)
    reasons.push(`Faltam arquivos atuais de ${estimate.unknown} abrangência(s).`);
  if (!nationalVotes) reasons.push('Aguardando os primeiros votos nacionais.');
  if (nationalProgress < PUBLICATION_RULES.minNationalProgress) {
    reasons.push('Aguardando pelo menos 5% das seções totalizadas no Brasil.');
  }
  if (incompleteRegions.length) {
    reasons.push(
      `Aguardando pelo menos 1% das seções de cada região: ${incompleteRegions.join(', ')}.`,
    );
  }
  if (representedElectorate < PUBLICATION_RULES.minRepresentedElectorate) {
    reasons.push(
      'As UFs com pelo menos 1% apurado precisam representar 80% dos votos válidos do primeiro turno.',
    );
  }
  if (aggregateDifference > PUBLICATION_RULES.maxAggregateDifference) {
    reasons.push(
      'Os totais Brasil e soma das UFs ainda diferem mais de 2%; aguardando sincronização.',
    );
  }

  return {
    eligible: reasons.length === 0,
    status: reasons.length ? 'insufficient-data' : 'coverage-criteria-met',
    reasons,
    nationalProgress,
    regionalProgress,
    representedElectorate,
    aggregateDifference,
    rules: PUBLICATION_RULES,
  };
}
