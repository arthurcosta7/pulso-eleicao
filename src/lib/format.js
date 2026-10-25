const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const shortDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const number = (value) => integer.format(value);
export const percent = (value) => (Number.isFinite(value) ? `${decimal.format(value)}%` : '—');
export const pp = (value) => `${value > 0 ? '+' : ''}${decimal.format(value)} p.p.`;
export const compact = (value) =>
  value >= 1_000_000
    ? `${shortDecimal.format(value / 1_000_000)} mi`
    : value >= 1000
      ? `${shortDecimal.format(value / 1000)} mil`
      : number(value);

export function clock(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const sourceLabel = (national) =>
  national ? `${national.date} às ${national.time}` : 'Aguardando fonte';
