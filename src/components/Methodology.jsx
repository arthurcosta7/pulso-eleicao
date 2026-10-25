import { ExternalLink, Database, ChartNoAxesCombined, CircleHelp } from 'lucide-react';

const SOURCES = [
  ['Resultados oficiais · TSE', 'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6258/uf/br/cargo/1/vis/nominal/resultados'],
  ['Arquivos e especificação EA20 · TSE', 'https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados'],
  ['Malhas territoriais · IBGE', 'https://servicodados.ibge.gov.br/api/docs/malhas?versao=3'],
];

export default function Methodology({ data }) {
  return <div className="methodology-page">
    <section className="panel method-intro"><CircleHelp size={25} /><h2>O placar é observado. A previsão é calculada.</h2>
      <p>O Pulso consulta os resultados oficiais do TSE e estima o efeito das urnas que ainda não chegaram. A previsão é experimental, não foi validada retrospectivamente e não é uma probabilidade de vitória.</p></section>
    <div className="method-grid"><section className="panel method-block"><Database size={22} /><h3>Dados e atualização</h3>
      <p>O backend consulta Brasil, 27 UFs e exterior (ZZ), cargo Presidente, eleição 6258. A referência é o primeiro turno de 2026, eleição 6257.</p>
      <p>As consultas ao TSE ocorrem em lotes de até quatro arquivos, com cache de 60 segundos e deduplicação de pedidos simultâneos. Cada arquivo tem seu próprio horário de divulgação.</p>
      <p>Se uma atualização falha, preservamos o último retrato completo. O placar nacional já inclui o exterior, que não é somado novamente.</p>
    </section><section className="panel method-block"><ChartNoAxesCombined size={22} /><h3>Como estimamos os votos restantes</h3>
      <p>Em cada UF, o total de votos válidos do primeiro turno é ajustado pelo número de seções do segundo turno. Multiplicamos pela fração de seções que falta totalizar.</p>
      <p>A preferência nas urnas restantes combina o resultado atual da UF com a proporção Lula / (Lula + Flávio) do primeiro turno. O peso do resultado atual é p / (p + 0,05), sendo p a fração das seções totalizadas.</p>
      <p>A projeção final adiciona somente os votos ainda esperados ao placar nacional atual. Isso garante que as linhas tracejadas comecem exatamente na situação observada.</p>
    </section></div>
    <section className="panel method-block"><h3>Como ler o gráfico completo</h3>
      <ul><li><strong>Linhas contínuas:</strong> votos efetivamente coletados. O histórico é compartilhado enquanto o servidor está ativo e também preservado neste navegador.</li>
        <li><strong>Marcador “Agora”:</strong> posição da apuração atual. O eixo horizontal usa a porcentagem de seções totalizadas.</li>
        <li><strong>Linhas tracejadas:</strong> trajetória estimada a partir desse ponto até 100%. Com duas consultas diferentes, o ritmo recente de cada UF orienta a ordem de chegada. Sem esse ritmo, usamos avanço proporcional.</li>
        <li><strong>Sem histórico inventado:</strong> períodos anteriores à coleta não são reconstruídos. Uma atualização do servidor pode reiniciar seu histórico em memória; o histórico deste navegador é mantido.</li></ul>
      <p>Percentuais de seções não equivalem a percentuais de votos. Seções e municípios da mesma UF também podem ter perfis diferentes. Transferências entre turnos, comparecimento e votos inválidos podem mudar. A curva prevista é um cenário, sem faixa de confiança estatística.</p>
    </section>
    <section className="panel method-block"><h3>Fontes e retrato em uso</h3><div className="source-links">{SOURCES.map(([name, url]) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{name}<ExternalLink size={14} /></a>)}</div>
      <p>Referência coletada: {data?.reference?.fetchedAt ? new Date(data.reference.fetchedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Aguardando dados'}.</p>
      {data?.errors?.length > 0 && <details><summary>Arquivos indisponíveis na última tentativa ({data.errors.length})</summary><ul>{data.errors.map(error => <li key={error.uf}>{error.uf}: {error.message}</li>)}</ul></details>}
    </section>
  </div>;
}
