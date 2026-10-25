'use client';

import { useEffect, useMemo, useState } from 'react';
import { Globe2, Search, ArrowDownUp } from 'lucide-react';
import { groupRows, REGIONS, STATES } from '../lib/model.js';
import { compact, percent, sourceLabel } from '../lib/format.js';

function referenceLabel(lula, flavio) {
  const total = lula + flavio;
  if (!total) return 'Referência indisponível';
  if (lula === flavio) return 'Empate';
  return `${lula > flavio ? 'Lula' : 'Flávio'} ${percent((Math.max(lula, flavio) / total) * 100)}`;
}

export function RegionalOverview({ rows = [], onSelect }) {
  const groups = groupRows(rows);
  const Row = onSelect ? 'button' : 'div';
  return (
    <section className="panel region-overview">
      <div className="section-heading">
        <div>
          <h2>O peso de cada região</h2>
          <p>Apuração atual e referência real do primeiro turno.</p>
        </div>
        <Globe2 size={19} />
      </div>
      <div className="regional-bars">
        {groups.map((group) => {
          const progress = group.sections ? (group.counted / group.sections) * 100 : 0;
          return (
            <Row
              className="regional-row"
              key={group.name}
              onClick={onSelect ? () => onSelect(group.name) : undefined}
            >
              <span>{group.name}</span>
              <span className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </span>
              <strong>{group.sections ? percent(progress) : '—'}</strong>
              <small>
                <span>1º turno: {referenceLabel(group.referenceLula, group.referenceFlavio)}</span>
                <span>{compact(group.remaining)} votos restantes estimados</span>
              </small>
            </Row>
          );
        })}
      </div>
    </section>
  );
}

export default function RegionsPanel({ rows = [], initialRegion = '' }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState(initialRegion);
  const [sort, setSort] = useState('remaining');
  const [mapLayer, setMapLayer] = useState('progress');
  const [map, setMap] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/map.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Mapa indisponível');
        return response.json();
      })
      .then(setMap)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const normalize = (value) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const text = normalize(query.trim());
    return STATES.map(
      (state) => rows.find((row) => row.uf === state.uf) || { ...state, missing: true },
    )
      .filter(
        (row) =>
          (!region || row.region === region) && normalize(`${row.uf} ${row.name}`).includes(text),
      )
      .sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name, 'pt-BR')
          : sort === 'progress'
            ? (a.progress || 0) - (b.progress || 0)
            : (b.remaining || 0) - (a.remaining || 0),
      );
  }, [rows, region, query, sort]);

  function selectUF(uf) {
    setQuery(uf);
    setRegion('');
    document.getElementById('uf-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function mapFill(uf) {
    const row = rows.find((item) => item.uf === uf);
    if (!row) return '#e9edf5';
    if (mapLayer === 'leader') {
      return !row.valid ? '#e9edf5' : row.lula > row.flavio ? '#d68fa5' : '#7aabd2';
    }
    return `hsl(221 39% ${95 - row.progress * 48}%)`;
  }

  const highlighted = rows.find((row) => row.uf === hovered);

  return (
    <div className="regions-page">
      <div className="regions-top-grid">
        <section className="panel map-panel">
          <div className="section-heading">
            <div>
              <h2>Brasil, estado por estado</h2>
              <p>Selecione uma UF para filtrar a tabela.</p>
            </div>
          </div>
          <div className="segmented">
            <button aria-pressed={mapLayer === 'progress'} onClick={() => setMapLayer('progress')}>
              Avanço da apuração
            </button>
            <button aria-pressed={mapLayer === 'leader'} onClick={() => setMapLayer('leader')}>
              Quem lidera
            </button>
          </div>
          <div className="map-wrap">
            {map.length ? (
              <svg viewBox="0 0 520 510" aria-label="Mapa das 27 UFs">
                {map.map((area) => (
                  <path
                    key={area.uf}
                    d={area.d}
                    fill={mapFill(area.uf)}
                    stroke="white"
                    strokeWidth="1.8"
                    tabIndex={0}
                    role="button"
                    aria-label={`Filtrar ${area.uf}`}
                    onMouseEnter={() => setHovered(area.uf)}
                    onFocus={() => setHovered(area.uf)}
                    onMouseLeave={() => setHovered(null)}
                    onBlur={() => setHovered(null)}
                    onClick={() => selectUF(area.uf)}
                    onKeyDown={(event) => {
                      if (['Enter', ' '].includes(event.key)) {
                        event.preventDefault();
                        selectUF(area.uf);
                      }
                    }}
                  >
                    <title>{STATES.find((state) => state.uf === area.uf)?.name}</title>
                  </path>
                ))}
              </svg>
            ) : (
              <p className="map-placeholder">O detalhe por UF está disponível na tabela abaixo.</p>
            )}
            <div className="map-detail" role="status">
              {highlighted
                ? `${highlighted.name} · ${percent(highlighted.progress * 100)} totalizado`
                : 'Passe sobre o mapa para ver o avanço.'}
            </div>
            <button className="exterior-button" onClick={() => selectUF('ZZ')}>
              <Globe2 size={16} />
              Exterior
            </button>
          </div>
          <p className="map-legend">
            {mapLayer === 'progress'
              ? 'Tons escuros indicam mais seções totalizadas.'
              : 'Rosa: Lula · Azul: Flávio · Cinza: sem votos.'}
          </p>
        </section>
        <RegionalOverview
          rows={rows}
          onSelect={(value) => {
            setRegion(value);
            setQuery('');
          }}
        />
      </div>

      <section className="panel table-panel" id="uf-table">
        <div className="section-heading table-heading">
          <div>
            <h2>As urnas que ainda faltam</h2>
            <p>
              Compare o placar atual com a referência do 1º turno entre Lula e Flávio em cada UF.
            </p>
          </div>
          <div className="table-filters">
            <label className="search-input">
              <Search size={16} />
              <input
                aria-label="Buscar estado ou UF"
                placeholder="Estado ou UF"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label="Região"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            >
              <option value="">Todas as regiões</option>
              {REGIONS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <label className="sort-select">
              <ArrowDownUp size={15} />
              <select
                aria-label="Ordenar UFs"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="remaining">Mais votos restantes</option>
                <option value="progress">Menos apurado</option>
                <option value="name">Nome do estado</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>UF / abrangência</th>
                <th>Seções totalizadas</th>
                <th>Lula</th>
                <th>Flávio Bolsonaro</th>
                <th>
                  Referência 1º turno
                  <br />
                  <small>Entre os dois candidatos</small>
                </th>
                <th>
                  Votos restantes
                  <br />
                  <small>Estimativa adaptativa</small>
                </th>
                <th>Divulgação do TSE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const valid = row.lula + row.flavio;
                return (
                  <tr key={row.uf}>
                    <td>
                      <span className="uf-chip">{row.uf}</span>
                      {row.name}
                    </td>
                    <td>
                      <div className="table-progress">
                        <span className="progress-track">
                          <span style={{ width: `${(row.progress || 0) * 100}%` }} />
                        </span>
                        {row.missing ? '—' : percent(row.progress * 100)}
                      </div>
                    </td>
                    <td className="lula-text">{valid ? percent((row.lula / valid) * 100) : '—'}</td>
                    <td className="flavio-text">
                      {valid ? percent((row.flavio / valid) * 100) : '—'}
                    </td>
                    <td className="historical-cell">
                      {referenceLabel(row.referenceLula, row.referenceFlavio)}
                    </td>
                    <td>{row.missing ? '—' : compact(row.remaining)}</td>
                    <td className="source-cell">
                      {row.missing ? 'Indisponível' : sourceLabel(row)}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Nenhuma UF encontrada. Limpe os filtros para ver todas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>{filtered.length} de 28 abrangências</span>
          <span>Exterior incluído uma única vez no Brasil.</span>
        </div>
      </section>
    </div>
  );
}
