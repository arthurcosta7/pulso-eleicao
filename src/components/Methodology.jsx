import { ExternalLink, Database, ChartNoAxesCombined, CircleHelp } from 'lucide-react';

const SOURCES = [
  [
    'Resultados oficiais · TSE',
    'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6258/uf/br/cargo/1/vis/nominal/resultados',
  ],
  [
    'Arquivos e especificação EA20 · TSE',
    'https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados',
  ],
  ['Malhas territoriais · IBGE', 'https://servicodados.ibge.gov.br/api/docs/malhas?versao=3'],
  [
    'Previsões durante a apuração · HDSR 2024',
    'https://hdsr.mitpress.mit.edu/pub/zr6hjsfl/release/1',
  ],
];

export default function Methodology({ data }) {
  return (
    <div className="methodology-page">
      <section className="panel method-intro">
        <CircleHelp size={25} />
        <h2>O placar é observado. A previsão é calculada.</h2>
        <p>
          O Pulso consulta os resultados oficiais do TSE e estima o efeito das urnas que ainda não
          chegaram. A previsão é experimental, não foi validada retrospectivamente e não é uma
          probabilidade de vitória.
        </p>
      </section>
      <div className="method-grid">
        <section className="panel method-block">
          <Database size={22} />
          <h3>Dados e atualização</h3>
          <p>
            O backend consulta Brasil, 27 UFs e exterior (ZZ), cargo Presidente, eleição 6258. A
            referência é o primeiro turno de 2026, eleição 6257.
          </p>
          <p>
            As consultas ao TSE ocorrem em lotes de até quatro arquivos, com cache de 60 segundos e
            deduplicação de pedidos simultâneos. Cada arquivo tem seu próprio horário de divulgação.
          </p>
          <p>
            Se uma atualização falha, preservamos o último retrato completo. O placar nacional já
            inclui o exterior, que não é somado novamente.
          </p>
        </section>
        <section className="panel method-block">
          <ChartNoAxesCombined size={22} />
          <h3>Como estimamos os votos restantes</h3>
          <p>
            Em cada UF, o primeiro turno real fornece a referência de votos válidos por seção e a
            preferência entre Lula e Flávio. Isso considera a força eleitoral de cada candidato
            naquela UF e no exterior, sem fixar uma ordem de chegada das regiões.
          </p>
          <p>
            O volume restante é o número de seções ainda não totalizadas multiplicado pelos votos
            esperados por seção. Essa média começa no primeiro turno e se ajusta à média observada
            no segundo conforme a apuração avança.
          </p>
          <p>
            Em cada UF já apurada, medimos a mudança de participação entre os turnos: participação
            atual menos Lula / (Lula + Flávio) do primeiro turno. Assim, uma região que já era
            favorável a um candidato não é confundida com uma mudança nacional só por ter apurado
            antes.
          </p>
          <p>
            UFs ainda pouco apuradas recebem a mudança observada nas outras UFs da mesma região,
            suavizada pela cobertura. Quando esse sinal é escasso, usamos um sinal nacional reduzido
            conforme a diversidade de regiões com dados. A própria UF fica fora desses cálculos para
            não contar sua informação duas vezes. O exterior não transfere sua mudança para o
            eleitorado doméstico, nem recebe essa transferência.
          </p>
          <p>
            A referência ajustada é combinada com a contagem local. O peso local é p / (p + 0,05 ×
            (1 − p)), sendo p a fração de seções totalizadas. Ele aumenta com a apuração e chega a
            100% quando a UF termina. O primeiro turno fornece a estrutura territorial, mas não fixa
            a participação nem o vencedor previsto do segundo turno.
          </p>
          <p>
            Por exemplo, uma UF historicamente favorável a um candidato continua contribuindo para a
            previsão enquanto tem muitas seções pendentes. À medida que suas urnas chegam, os votos
            reais substituem a estimativa. O compartilhamento de mudanças entre UFs é uma hipótese
            do modelo: pode falhar se os municípios já apurados tiverem perfis diferentes dos
            pendentes. Não presumimos que a vantagem de nenhum candidato obrigatoriamente cairá.
          </p>
          <p>
            A projeção final adiciona somente os votos ainda esperados ao placar nacional atual.
            Isso garante que as linhas tracejadas comecem exatamente na situação observada.
          </p>
        </section>
      </div>
      <section className="panel method-block">
        <h3>Quando publicamos uma projeção</h3>
        <p>Antes de mostrar percentuais finais e a curva prevista, esta versão exige:</p>
        <ul>
          <li>Pelo menos 5% das seções totalizadas no Brasil.</li>
          <li>Pelo menos 1% das seções de cada uma das cinco regiões brasileiras.</li>
          <li>
            UFs com 1% ou mais apurado somando pelo menos 80% dos votos válidos do primeiro turno.
          </li>
          <li>
            Todos os arquivos necessários disponíveis e diferença de até 2% entre Brasil e soma das
            UFs.
          </li>
        </ul>
        <p>
          São critérios operacionais conservadores deste projeto, não limiares científicos de
          confiança. Atingi-los não garante representatividade dentro de cada UF nem acerto
          eleitoral. Enquanto algum falha, o placar oficial e o histórico continuam visíveis, com a
          indicação “dados insuficientes”, sem percentual final projetado.
        </p>
        <p>
          O sinal compartilhado entre UFs é ponderado por votos efetivamente recebidos. O peso usado
          para suavizar uma preferência local não é tratado como se fosse cobertura real de milhões
          de eleitores. Esta implementação ainda não foi validada retrospectivamente e não fornece
          intervalo estatístico de confiança nem probabilidade de vitória.
        </p>
      </section>
      <section className="panel method-block">
        <h3>Como ler o gráfico completo</h3>
        <ul>
          <li>
            <strong>Linhas contínuas:</strong> votos efetivamente coletados. O histórico é
            compartilhado enquanto o servidor está ativo e também preservado neste navegador.
          </li>
          <li>
            <strong>Marcador “Agora”:</strong> posição da apuração atual. O eixo horizontal usa a
            porcentagem de seções totalizadas.
          </li>
          <li>
            <strong>Linhas tracejadas:</strong> trajetória estimada a partir desse ponto até 100%. O
            ritmo usa até 12 contagens diferentes por UF, com mais peso para as recentes. Uma
            consulta sem urnas novas preserva as medições anteriores. Sem histórico suficiente,
            usamos as diferenças de avanço já observadas entre as UFs.
          </li>
          <li>
            <strong>Entrada gradual:</strong> cada UF tem uma taxa estimada de chegada de suas
            seções pendentes. A velocidade diminui à medida que restam menos seções nessa UF. A
            combinação dessas chegadas muda a inclinação da curva e pode mudar sua direção. A
            trajetória é recalculada com novas urnas; a ordem futura não é conhecida com certeza.
          </li>
          <li>
            <strong>Sem histórico inventado:</strong> períodos anteriores à coleta não são
            reconstruídos. Uma atualização do servidor pode reiniciar seu histórico em memória; o
            histórico deste navegador é mantido.
          </li>
        </ul>
        <p>
          Percentuais de seções não equivalem a percentuais de votos. Seções e municípios da mesma
          UF também podem ter perfis diferentes. Transferências entre turnos, comparecimento e votos
          inválidos podem mudar. A curva prevista é um cenário, sem faixa de confiança estatística.
        </p>
      </section>
      <section className="panel method-block">
        <h3>Fontes e retrato em uso</h3>
        <div className="source-links">
          {SOURCES.map(([name, url]) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              {name}
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
        <p>
          Referência coletada:{' '}
          {data?.reference?.fetchedAt
            ? new Date(data.reference.fetchedAt).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })
            : 'Aguardando dados'}
          .
        </p>
        {data?.errors?.length > 0 && (
          <details>
            <summary>Arquivos indisponíveis na última tentativa ({data.errors.length})</summary>
            <ul>
              {data.errors.map((error) => (
                <li key={error.uf}>
                  {error.uf}: {error.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
