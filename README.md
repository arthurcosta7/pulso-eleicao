# Pulso — React + Node.js

Painel de apuração presidencial de 2026 com dados reais do TSE, navegação entre abas e gráfico conjunto do histórico observado, situação atual e previsão até 100% das seções.

## Executar

Requer Node.js 22.13 ou superior.

```powershell
npm ci
npm run dev
```

Desenvolvimento: http://127.0.0.1:5173.

```powershell
npm test
npm run typecheck
npm run build
npm start
```

Produção em Node: http://localhost:3000. `npm start` usa o servidor HTTP de produção do Vinext em Node.js. A publicação do Sites usa a mesma aplicação compilada com o adaptador Cloudflare e compatibilidade com Node; o público e o endereço existentes são preservados.

## Organização

- `app/page.tsx`: entrada da aplicação.
- `app/api/election/route.js`: API HTTP usada pelo frontend.
- `src/server/tse.js`: coleta oficial, validação do turno, concorrência máxima de quatro arquivos, cache de 60 segundos e deduplicação de consultas simultâneas.
- `src/hooks/useElection.js`: consulta à API, atualização automática, cancelamento e histórico local.
- `src/components/Dashboard.jsx`: navegação real entre abas, estado da aplicação e exportação JSON.
- `src/components/ResultsChart.jsx`: curvas observadas e previstas dos dois candidatos, marcador atual, tooltip, teclado, unidades e escala.
- `src/components/RegionsPanel.jsx`: mapa, filtros, ordenação e tabela de UFs.
- `src/components/Methodology.jsx`: fontes, hipóteses e limites.
- `src/lib/model.js`: estimativa adaptativa por UF com referência real do primeiro turno.
- `src/lib/forecast.js`: trajetória futura ancorada no placar oficial e tratamento do histórico.
- `data/reference.json`: primeiro turno oficial das 28 abrangências, com URLs e data de coleta.
- `tests/`: testes do modelo, trajetória, cache, concorrência e tratamento de falhas.

Os scripts de publicação e o adaptador em `worker/` pertencem ao ambiente Sites. `dist/` é gerado pelo build; código-fonte não é editado ali.

## Dados oficiais

O servidor consulta os arquivos EA20 da eleição 6258, cargo Presidente, para BR, 27 UFs e ZZ. Brasil já inclui o exterior; a previsão nunca o soma uma segunda vez. O navegador faz uma única consulta à API do projeto por minuto enquanto a aba está visível. Horários de coleta e divulgação são distintos.

Uma falha mantém o retrato completo anterior e sinaliza sua idade. Sem votos ou sem as 28 abrangências, a curva de previsão é suprimida. O painel usa somente a apuração oficial e sua referência histórica real.

## Gráfico

- Eixo horizontal: percentual de seções totalizadas.
- Linhas contínuas: histórico realmente coletado de Lula e Flávio.
- Marcador Agora: percentual atual da apuração e pontos dos dois candidatos.
- Linhas tracejadas: evolução esperada dos votos restantes até 100%.
- Unidades: percentual dos votos válidos ou votos acumulados.
- A legenda permite exibir ou ocultar cada candidato. Setas do teclado percorrem os pontos.

A previsão começa exatamente nos votos nacionais atuais e acrescenta apenas votos ainda esperados por UF. O ponto final, o número previsto e as linhas usam a mesma conta. Com 100% totalizado, previsão e situação atual coincidem.

A trajetória usa até 12 contagens distintas por UF. Taxas de chegada são estimadas com diferenças de seções e tempo entre essas contagens, com maior peso para as recentes. Consultas sem novas seções não apagam esse histórico. Na ausência de medições suficientes, o avanço acumulado de cada UF fornece uma estimativa inicial de velocidade, com suavização nacional para incluir UFs ainda sem seções contadas. A confiança no ritmo medido cresce com o volume observado e cai gradualmente quando as medições envelhecem.

Em cada UF, a fração prevista das seções restantes que já terão chegado segue 1 - exp(-taxa × tempo projetado). O modelo resolve a combinação das 28 abrangências para cada posição do eixo de apuração. Isso gera mudanças graduais de composição regional, sem conectar o placar ao ponto final por uma reta. A curva tem 120 passos, mais densos próximos ao ponto atual. É uma hipótese de dinâmica da contagem, sem ordem exata garantida ou faixa de confiança.

O histórico é mantido em memória pelo processo do servidor (até 720 registros) e salvo neste navegador. Reinícios ou troca de instância podem reiniciar o histórico do servidor. Períodos anteriores à coleta não são inventados; não existe uma coleta contínua em segundo plano quando não há visitantes.

## Modelo e limites

Em cada UF e ZZ, os votos restantes são o número de seções pendentes multiplicado pela média esperada de votos válidos por seção. A média combina o primeiro turno real e o segundo turno já observado. A preferência inicial Lula / (Lula + Flávio) do primeiro turno é ajustada pela mudança observada entre turnos nas outras UFs. O sinal da mesma região tem prioridade e é suavizado pela cobertura; o sinal nacional é reduzido conforme a diversidade de regiões com dados. Cada UF fica fora do cálculo de seu próprio sinal compartilhado, evitando duplicar a evidência. O exterior não transfere nem recebe mudanças do eleitorado doméstico.

A preferência ajustada e a proporção local atual são combinadas com peso local p / (p + 0,05 × (1 − p)). O peso chega a 1 com 100% da UF apurada. A mesma regra atualiza a média de votos por seção. Com isso, UFs sem apuração já podem incorporar uma mudança do segundo turno, enquanto UFs bem apuradas passam a depender da própria contagem. A referência inicial não fixa o vencedor.

A cobertura de votos do segundo turno é exibida no gráfico. O modelo não declara vencedor nem calcula probabilidade de vitória. O compartilhamento regional de mudanças é uma hipótese não validada; municípios que chegam primeiro podem diferir daqueles ainda pendentes.

É uma extrapolação experimental, sem validação retrospectiva nem probabilidade de vitória. Perfis diferentes dentro de uma UF, transferência de votos, comparecimento e votos inválidos podem gerar erro. A referência eleitoral é específica de cada UF e do exterior. O ritmo de chegada é observado nos arquivos; nenhuma região tem atraso fixado.

Para atualizar a referência oficial e a malha do IBGE: `npm run refresh-reference`, seguido de novo build.

## Formatação

O projeto usa Prettier com indentação de dois espaços, linhas de até 100 colunas e aspas simples em JavaScript e TypeScript.

```powershell
npm run format
npm run format:check
```

Os comandos cobrem o código da aplicação, estilos, testes e configurações. Dados oficiais, arquivos gerados e a infraestrutura fornecida pelo Sites ficam fora da formatação.

## Controle de publicação da projeção

A implementação continua experimental e não possui validação retrospectiva de acurácia. O gráfico publica apenas votos observados enquanto não houver cobertura mínima e consistência das fontes. Os critérios operacionais estão em `src/lib/readiness.js`:

- Pelo menos 5% das seções totalizadas no Brasil.
- Pelo menos 1% em cada uma das cinco regiões brasileiras.
- UFs com 1% ou mais apurado representando 80% dos votos válidos do primeiro turno.
- Todas as abrangências necessárias e diferença de até 2% entre total Brasil e soma das UFs.

Esses limites são travas conservadoras escolhidas para o projeto, não um nível estatístico de confiança. Passar nelas não comprova representatividade dos municípios e seções pendentes nem garante acerto. Sem elas, a API retorna `available: false`, `final: null`, `share: null` e curva vazia, mantendo o ponto atual e os motivos do bloqueio. Não são divulgados percentuais finais como se fossem confiáveis com 0,25% de apuração.

O sinal entre UFs agora usa somente votos efetivamente observados como peso de evidência, limitado pelo volume de referência. O peso de suavização local não substitui a fração real de votos recebidos. Isso corrige a amplificação de amostras iniciais pequenas ao transferir mudanças para outras UFs.

Referência técnica de contexto, sem adoção de seus limiares ou alegação de validação equivalente: [Election Night Forecasting With DDHQ, HDSR 2024](https://hdsr.mitpress.mit.edu/pub/zr6hjsfl/release/1).
