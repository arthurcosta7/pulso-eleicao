'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Expand, Info } from 'lucide-react';
import { compact, percent, clock } from '../lib/format.js';
import { selectHistoryThrough } from '../lib/forecast.js';

const CANDIDATES = [
  { key: 'lula', name: 'Lula', color: '#bd4d70', number: '13' },
  { key: 'flavio', name: 'Flávio Bolsonaro', color: '#377bb4', number: '22' },
];
const SIZE = { width: 1000, height: 390, left: 60, right: 88, top: 39, bottom: 57 };

function candidateValue(point, key, metric) {
  return metric === 'votes' ? point[key] : point[key] / point.valid * 100;
}

export default function ResultsChart({ snapshot, forecast, history = [] }) {
  const [metric, setMetric] = useState('percent');
  const [fullScale, setFullScale] = useState(false);
  const [hidden, setHidden] = useState([]);
  const [focusIndex, setFocusIndex] = useState(null);
  const [compactChart, setCompactChart] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setCompactChart(entries[0].contentRect.width < 600));
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  const clipId = useId().replace(/:/g, '');
  const now = forecast?.current;
  const future = forecast?.available ? forecast.points : [];
  const records = useMemo(() => {
    const collected = selectHistoryThrough(history, now);
    if (now && !collected.some(point => point.lula === now.lula
      && point.flavio === now.flavio && point.progress === now.progress)) return [...collected, now];
    return collected;
  }, [history, now]);

  const allPoints = [...records.map(p => ({ ...p, kind: 'observed' })), ...future.slice(1)];
  const chosen = focusIndex !== null ? allPoints[Math.min(focusIndex, allPoints.length - 1)] : null;
  const { width, height, left, right, top, bottom } = compactChart
    ? { width: 650, height: 350, left: 54, right: 36, top: 45, bottom: 58 } : SIZE;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = allPoints.flatMap(point => CANDIDATES.map(c => candidateValue(point, c.key, metric)));
  let minimum = 0;
  let maximum = metric === 'votes' ? Math.max(10_000_000, ...values) * 1.12 : 100;
  if (metric === 'percent' && !fullScale) {
    minimum = Math.max(0, Math.floor(Math.min(40, ...values) / 5) * 5);
    maximum = Math.min(100, Math.ceil(Math.max(60, ...values) / 5) * 5);
  }
  const x = progress => left + progress / 100 * plotWidth;
  const y = value => top + (maximum - value) / (maximum - minimum) * plotHeight;
  const path = (points, key) => points.map((point, index) => (
    `${index ? 'L' : 'M'}${x(point.progress).toFixed(2)},${y(candidateValue(point, key, metric)).toFixed(2)}`
  )).join(' ');

  function toggleCandidate(key) {
    setHidden(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]);
  }

  function onPointerMove(event) {
    if (!allPoints.length) return;
    const box = event.currentTarget.getBoundingClientRect();
    const target = (event.clientX - box.left) / box.width * width;
    const closest = allPoints.reduce((best, point, index) => (
      Math.abs(x(point.progress) - target) < Math.abs(x(allPoints[best].progress) - target) ? index : best
    ), 0);
    setFocusIndex(closest);
  }

  function onKeyDown(event) {
    if (!allPoints.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const start = focusIndex ?? Math.max(0, records.length - 1);
    setFocusIndex(event.key === 'Home' ? 0 : event.key === 'End' ? allPoints.length - 1
      : Math.max(0, Math.min(allPoints.length - 1, start + (event.key === 'ArrowRight' ? 1 : -1))));
  }

  const final = forecast?.final;
  const status = !snapshot ? 'Conectando ao TSE' : !now ? 'Aguardando os primeiros votos'
    : now.progress >= 100 ? 'Apuração concluída' : !forecast?.available
      ? 'Placar atual · previsão indisponível nesta consulta' : 'Placar atual + previsão até 100%';

  return (
    <section className="chart-panel panel" aria-label="Situação atual e previsão no mesmo gráfico">
      <div className="chart-heading">
        <div><h2>Como está. Como pode terminar.</h2><p>{status}</p></div>
        <div className="chart-actions">
          <div className="segmented" aria-label="Unidade do gráfico">
            <button aria-pressed={metric === 'percent'} onClick={() => setMetric('percent')}>Percentual</button>
            <button aria-pressed={metric === 'votes'} onClick={() => setMetric('votes')}>Votos</button>
          </div>
          {metric === 'percent' && <button className="scale-button" aria-pressed={fullScale}
            onClick={() => setFullScale(value => !value)}><Expand size={15} />{fullScale ? 'Ajustar escala' : 'Escala 0–100%'}</button>}
        </div>
      </div>

      <div className="chart-scorecards">
        {CANDIDATES.map(candidate => (
          <div className="chart-scorecard" key={candidate.key} style={{ '--candidate': candidate.color }}>
            <div className="candidate-heading"><span className="candidate-number">{candidate.number}</span><h3>{candidate.name}</h3></div>
            <div className="candidate-journey">
              <div><span>Agora · apurado</span><strong>{now ? percent(candidateValue(now, candidate.key, 'percent')) : '—'}</strong>
                <small>{now ? `${compact(now[candidate.key])} votos` : 'Sem votos divulgados'}</small></div>
              <ArrowRight className="journey-arrow" size={22} />
              <div><span>{now?.progress >= 100 ? 'Resultado apurado' : 'Previsão final'}</span>
                <strong className="forecast-number">{final ? percent(candidateValue(final, candidate.key, 'percent')) : '—'}</strong>
                <small>{final ? `${compact(final[candidate.key])} votos estimados` : 'Depende da chegada de votos'}</small></div>
            </div>
          </div>
        ))}
      </div>

      <div className="chart-legend">
        {CANDIDATES.map(candidate => <button key={candidate.key}
          aria-pressed={!hidden.includes(candidate.key)} onClick={() => toggleCandidate(candidate.key)}
          className={hidden.includes(candidate.key) ? 'is-muted' : ''}>
          <span className="legend-dot" style={{ background: candidate.color }} />{candidate.name}
        </button>)}
        <span><b className="line-key" />Apurado</span><span><b className="line-key dashed" />Previsão</span>
      </div>

      <div className="plot-container" ref={containerRef}>
        <svg viewBox={`0 0 ${width} ${height}`} className={`results-chart ${compactChart ? 'compact-chart' : ''}`} role="img" tabIndex={0}
          aria-label="Curvas de Lula e Flávio por percentual de seções apuradas. Linhas contínuas: observado. Tracejadas: previsão. Use as setas para consultar pontos."
          onPointerMove={onPointerMove} onPointerLeave={() => setFocusIndex(null)} onKeyDown={onKeyDown}>
          <defs><clipPath id={clipId}><rect x={left - 5} y={top - 8} width={plotWidth + 10} height={plotHeight + 16} /></clipPath></defs>
          <rect x={now ? x(now.progress) : left} y={top} width={now ? x(100) - x(now.progress) : plotWidth}
            height={plotHeight} fill="#f5f6fc" />
          <text x={x(100) - 12} y={top + 19} textAnchor="end" className="zone-label">{now ? now.progress >= 100 ? 'Apuração concluída' : 'Urnas restantes · projeção' : 'Aguardando totalização'}</text>

          {Array.from({ length: 5 }, (_, i) => {
            const value = minimum + (maximum - minimum) / 4 * i;
            return <g key={i}><line x1={left} x2={x(100)} y1={y(value)} y2={y(value)} stroke="#e8edf4" />
              <text x={left - 12} y={y(value) + 4} textAnchor="end">{metric === 'votes' ? compact(value) : `${Math.round(value)}%`}</text></g>;
          })}
          {metric === 'percent' && minimum < 50 && maximum > 50 && <g>
            <line x1={left} x2={x(100)} y1={y(50)} y2={y(50)} stroke="#aeb9cd" strokeDasharray="4 5" />
            <text x={x(100) + 10} y={y(50) + 4} className="majority-label">50%</text>
          </g>}
          {[0, 20, 40, 60, 80, 100].map(tick => <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={top} y2={top + plotHeight} stroke="#eef1f7" />
            <text x={x(tick)} y={height - 29} textAnchor="middle">{tick}%</text>
          </g>)}
          <text x={left + plotWidth / 2} y={height - 4} textAnchor="middle" className="axis-title">Seções totalizadas · Brasil e exterior</text>

          <g clipPath={`url(#${clipId})`}>
            {CANDIDATES.filter(c => !hidden.includes(c.key)).map(candidate => <g key={candidate.key}>
              <path d={path(records, candidate.key)} fill="none" stroke={candidate.color} strokeWidth="3" strokeLinejoin="round" />
              <path d={path(future, candidate.key)} fill="none" stroke={candidate.color} strokeWidth="2.5" strokeDasharray="7 6" strokeLinejoin="round" opacity="0.78" />
              {now && <circle cx={x(now.progress)} cy={y(candidateValue(now, candidate.key, metric))} r="6"
                fill={candidate.color} stroke="white" strokeWidth="2.5" />}
              {final && <circle cx={x(final.progress)} cy={y(candidateValue(final, candidate.key, metric))} r="4"
                fill="white" stroke={candidate.color} strokeWidth="2" />}
            </g>)}
          </g>

          {now && <g>
            <line x1={x(now.progress)} x2={x(now.progress)} y1={top - 3} y2={top + plotHeight}
              stroke="#657aab" strokeWidth="1.5" strokeDasharray="3 4" />
            <rect x={Math.max(left, Math.min(x(now.progress) - 57, x(100) - 114))} y={top - 29} width="114" height="23" rx="5" fill="#294694" />
            <text x={Math.max(left + 57, Math.min(x(now.progress), x(100) - 57))} y={top - 13}
              textAnchor="middle" className="now-marker">Agora · {percent(now.progress)}</text>
          </g>}
          {chosen && <line x1={x(chosen.progress)} x2={x(chosen.progress)} y1={top} y2={top + plotHeight} stroke="#7d87a2" opacity=".6" />}
        </svg>

        {!now && <div className="chart-empty"><span className="empty-dot" /><h3>O gráfico começa com os primeiros votos.</h3>
          <p>O placar atual e a previsão aparecerão juntos assim que o TSE divulgar a apuração.</p></div>}

        {chosen && <div className="chart-tooltip" role="status" style={{ left: `${Math.min(compactChart ? 68 : 77, Math.max(compactChart ? 32 : 13, x(chosen.progress) / width * 100))}%` }}>
          <strong>{chosen.kind === 'forecast' ? 'Previsão' : 'Apurado'} · {percent(chosen.progress)} das seções</strong>
          {CANDIDATES.map(c => <div key={c.key}><span><b className="legend-dot" style={{ background: c.color }} />{c.name}</span>
            <b>{metric === 'votes' ? compact(chosen[c.key]) : percent(candidateValue(chosen, c.key, 'percent'))}</b></div>)}
          {chosen.at && <small>Registrado às {clock(chosen.at)}</small>}
        </div>}
      </div>

      <div className="chart-bottom"><Info size={15} /><p>{`${records.length} registro(s) real(is) coletado(s). ${records.length < 2 ? 'O histórico será formado com as próximas divulgações. ' : ''}A previsão combina o 1º turno de cada UF com sua apuração atual e se adapta a cada atualização.`}</p>
        <span>{forecast?.method === 'observed-pace' ? 'Ritmo recente por UF' : 'Ritmo proporcional por UF'}</span></div>
    </section>
  );
}
