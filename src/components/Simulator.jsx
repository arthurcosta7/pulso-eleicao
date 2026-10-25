'use client';

import { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { demo } from '../lib/model.js';
import { buildForecast, currentPoint } from '../lib/forecast.js';
import { percent, pp } from '../lib/format.js';
import ResultsChart from './ResultsChart';
import { RegionalOverview } from './RegionsPanel';

export default function Simulator({ reference }) {
  const [moment, setMoment] = useState(58);
  const [swing, setSwing] = useState(0);
  const [northeastDelay, setNortheastDelay] = useState(1.8);

  const scenario = useMemo(() => {
    if (!reference?.states) return null;
    const progress = moment / 100;
    const snapshot = demo(reference.states, progress, { northeastDelay });
    const previous = demo(reference.states, Math.max(.001, progress - .03), { northeastDelay });
    const forecast = buildForecast(snapshot, reference.states, { swing, previous });
    const history = Array.from({ length: 25 }, (_, index) => {
      const step = Math.max(.001, progress * (index + 1) / 25);
      const point = currentPoint(demo(reference.states, step, { northeastDelay }));
      return { ...point, at: new Date(Date.parse(snapshot.checkedAt) - (24 - index) * 60_000).toISOString() };
    });
    return { snapshot, forecast, history };
  }, [reference, moment, swing, northeastDelay]);

  return <div className="simulator-page"><div className="simulation-banner"><FlaskConical size={20} /><div>
    <strong>Laboratório com dados fictícios</strong><p>O cenário altera apenas esta aba. O painel oficial continua consultando o TSE.</p></div></div>
    <section className="panel simulation-controls"><div><label htmlFor="moment">Momento da contagem <output>{moment}% do cenário</output></label>
      <input id="moment" type="range" min="1" max="100" value={moment} onChange={event => setMoment(Number(event.target.value))} />
      <p>Avance das primeiras urnas até o resultado completo.</p></div>
      <div><label htmlFor="delay">Ritmo do Nordeste <output>{northeastDelay > 1 ? 'Mais lento' : northeastDelay < 1 ? 'Mais rápido' : 'Linear'}</output></label>
        <input id="delay" type="range" min="0.4" max="2.5" step="0.1" value={northeastDelay} onChange={event => setNortheastDelay(Number(event.target.value))} />
        <p>Hipótese de ordem de chegada, sem impor uma virada.</p></div>
      <div><label htmlFor="swing">Preferência nas urnas restantes <output>{pp(swing)}</output></label>
        <input id="swing" type="range" min="-10" max="10" step="0.5" value={swing} onChange={event => setSwing(Number(event.target.value))} />
        <p>Esquerda: mais Flávio. Direita: mais Lula.</p></div>
    </section>
    {scenario ? <>
      <ResultsChart {...scenario} simulation />
      <div className="below-chart-grid"><RegionalOverview rows={scenario.forecast.rows} />
        <section className="panel reading-panel"><h2>Uma leitura do cenário</h2><p>Na contagem simulada, já entraram <strong>{percent(scenario.snapshot.national.counted / scenario.snapshot.national.sections * 100)}</strong> das seções.</p>
          <p>A parte contínua mostra os números do cenário até agora. A parte tracejada parte desse mesmo ponto e distribui os votos que faltam conforme o ritmo recente de cada UF.</p>
          <p>Ao chegar a 100%, a previsão coincide com a situação atual. A preferência adicional afeta somente votos ainda não apurados.</p>
          <button className="button" onClick={() => { setMoment(58); setSwing(0); setNortheastDelay(1.8); }}>Restaurar cenário</button></section></div>
    </> : <div className="panel loading-panel">Aguardando a referência oficial do primeiro turno para abrir o simulador.</div>}
  </div>;
}
