'use client';

import { useEffect, useState } from 'react';
import {
  Activity, ArrowUpRight, BarChart3, BookOpen, CheckCheck, Clock3,
  Download, FlaskConical, Globe2, Info, Map, RefreshCw, TrendingUp,
} from 'lucide-react';
import { useElection } from '../hooks/useElection.js';
import { clock, compact, number, percent, pp, sourceLabel } from '../lib/format.js';
import ResultsChart from './ResultsChart';
import RegionsPanel, { RegionalOverview } from './RegionsPanel';
import Simulator from './Simulator';
import Methodology from './Methodology';

const TABS = [
  { id: 'painel', label: 'Visão geral', icon: BarChart3 },
  { id: 'regioes', label: 'Regiões e UFs', icon: Map },
  { id: 'simulador', label: 'Simulador', icon: FlaskConical },
  { id: 'metodologia', label: 'Metodologia', icon: BookOpen },
];

function validTab(value) {
  return TABS.some(tab => tab.id === value) ? value : 'painel';
}

function Stats({ data }) {
  const n = data?.snapshot?.national;
  const progress = n?.sections ? n.counted / n.sections * 100 : null;
  return <div className="stats-grid">
    <section className="stat"><span><CheckCheck size={17} />Seções totalizadas</span>
      <strong>{percent(progress)}</strong><p>{n ? `${number(n.counted)} de ${number(n.sections)} seções` : 'Aguardando o TSE'}</p>
      <div className="progress-track"><span style={{ width: `${progress || 0}%` }} /></div></section>
    <section className="stat"><span><Globe2 size={17} />Votos válidos apurados</span>
      <strong>{n ? number(n.valid) : '—'}</strong><p>{n ? `${compact(n.blank)} brancos e ${compact(n.nullVotes)} nulos, fora deste total` : 'Brasil e exterior'}</p></section>
    <section className="stat"><span><TrendingUp size={17} />Votos ainda esperados</span>
      <strong>{data?.forecast?.unknown === 0 ? compact(data.forecast.remaining) : '—'}</strong>
      <p>Estimativa por UF com a base do primeiro turno</p></section>
    <section className="stat"><span><Clock3 size={17} />Divulgação nacional</span>
      <strong className="source-time">{n?.time || '—'}</strong><p>{n?.date || 'Aguardando dados'} · horário de Brasília</p></section>
  </div>;
}

function Reading({ data, onMethod }) {
  const forecast = data?.forecast;
  const n = data?.snapshot?.national;
  const available = forecast?.available && n?.valid;
  const adjustment = available ? (forecast.share - n.lula / n.valid) * 100 : null;
  return <section className="panel reading-panel"><div className="section-heading"><h2>O que as urnas restantes podem mudar</h2><TrendingUp size={19} /></div>
    {available ? <>
      <div className="adjustment-value">{pp(adjustment)}<span>na participação de Lula, em relação ao placar atual</span></div>
      <p>O modelo estima <strong>{compact(forecast.remaining)} votos restantes</strong>, distribuídos conforme o peso de cada UF e do exterior.</p>
      <div className="decomposition"><div><span>Já apurado</span><b>{compact(n.valid)}</b></div><span>+</span><div><span>Ainda esperado</span><b>{compact(forecast.remaining)}</b></div><span>=</span><div><span>Total estimado</span><b>{compact(n.valid + forecast.remaining)}</b></div></div>
      {Math.abs(forecast.regionalDifference) > 1000 && <p className="inline-warning">Os arquivos de Brasil e UFs têm horários diferentes. A diferença atual é de {compact(Math.abs(forecast.regionalDifference))} votos. A previsão parte do placar Brasil.</p>}
    </> : <>
      <div className="waiting-reading"><Activity size={25} /><h3>A previsão depende de votos reais.</h3></div>
      <p>Quando houver votos divulgados e os arquivos das 28 abrangências estiverem disponíveis, o modelo estimará o efeito das urnas restantes.</p>
      <p>A ordem de chegada varia. Uma vantagem inicial pode diminuir, aumentar ou permanecer.</p>
    </>}
    <button className="text-button" onClick={onMethod}>Entenda o cálculo<ArrowUpRight size={16} /></button>
  </section>;
}

export default function Dashboard() {
  const { data, loading, error, lastAttempt, refresh } = useElection();
  const [tab, setTab] = useState('painel');
  const [region, setRegion] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const n = data?.snapshot?.national;

  useEffect(() => {
    const sync = () => setTab(validTab(window.location.hash.slice(1)));
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  function changeTab(id) {
    setTab(id);
    window.history.pushState(null, '', `#${id}`);
    setExportMessage('');
  }

  function onTabKey(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    changeTab(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  }

  function download() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pulso-tse-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage('Retrato oficial exportado.');
  }

  return <>
    <header className="site-header"><div className="header-inner">
      <a href="#painel" className="brand" onClick={event => { event.preventDefault(); changeTab('painel'); }} aria-label="Pulso, visão geral">
        <span className="brand-icon"><Activity size={26} /></span>pulso<span>.</span></a>
      <div className="election-label"><span>Presidência da República</span><strong>Eleições 2026 · 2º turno</strong></div>
      <a className="official-link" href="https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6258/uf/br/cargo/1/vis/nominal/resultados"
        target="_blank" rel="noopener noreferrer">Abrir TSE<ArrowUpRight size={16} /></a>
    </div></header>

    <main className="app-shell"><div className="page-heading"><div><span className="live-status"><b className={error ? 'status-dot warning' : 'status-dot'} />
      {loading ? 'Consultando o TSE' : error ? 'Atualização indisponível' : n?.valid ? 'Acompanhando a apuração' : 'Aguardando divulgação de votos'}</span>
      <h1>Apuração e previsão, juntas.</h1><p>A situação atual e o efeito das urnas que ainda faltam.</p></div>
      <div className="page-actions"><span>{lastAttempt ? `Última consulta: ${clock(lastAttempt)}` : 'Atualização automática a cada minuto'}</span>
        <button className="button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spinning' : ''} />{loading ? 'Consultando' : 'Atualizar'}</button>
        <button className="button icon-button" onClick={download} disabled={!data} aria-label="Exportar dados oficiais em JSON"><Download size={17} /></button></div>
    </div>

    <div className="tabs" role="tablist" aria-label="Áreas do painel eleitoral">{TABS.map(({ id, label, icon: Icon }, index) => (
      <button key={id} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id}
        tabIndex={tab === id ? 0 : -1} onClick={() => { if (id === 'regioes') setRegion(''); changeTab(id); }} onKeyDown={event => onTabKey(event, index)}>
        <Icon size={17} />{label}{id === 'simulador' && <span>Fictício</span>}</button>
    ))}</div>

    {error && <div className="status-banner error" role="status"><Info size={18} /><div><strong>Não há uma atualização completa nesta consulta.</strong><p>{error} {data?.snapshot?.checkedAt ? `Retrato exibido: ${clock(data.snapshot.checkedAt)}.` : ''}</p></div></div>}
    {!error && !n?.valid && tab !== 'simulador' && <div className="status-banner" role="status"><Info size={18} /><p>
      {loading ? 'Buscando os arquivos oficiais das 27 UFs, Brasil e exterior.' : `O TSE ainda não divulgou votos neste retrato. Fonte nacional: ${sourceLabel(n)}. O simulador está disponível em uma aba separada.`}</p></div>}
    {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}

    <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="tab-content">
      {tab === 'painel' && <><Stats data={data} />
        <ResultsChart snapshot={data?.snapshot} forecast={data?.forecast} history={data?.history} />
        <div className="below-chart-grid"><RegionalOverview rows={data?.forecast?.rows} onSelect={value => { setRegion(value); changeTab('regioes'); }} />
          <Reading data={data} onMethod={() => changeTab('metodologia')} /></div></>}
      {tab === 'regioes' && <RegionsPanel rows={data?.forecast?.rows} initialRegion={region} />}
      {tab === 'simulador' && <Simulator reference={data?.reference} />}
      {tab === 'metodologia' && <Methodology data={data} />}
    </section>

    <footer className="site-footer"><span className="footer-brand">pulso.</span><p>Dados oficiais do TSE. Previsão independente e experimental.</p>
      <button onClick={() => changeTab('metodologia')}>Fontes e limites do modelo<ArrowUpRight size={14} /></button></footer>
    </main>
  </>;
}
