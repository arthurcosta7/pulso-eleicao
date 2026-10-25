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
- `src/components/Simulator.jsx`: cenário fictício isolado da apuração oficial.
- `src/components/Methodology.jsx`: fontes, hipóteses e limites.
- `src/lib/model.js`: extrapolação por UF e gerador de cenários.
- `src/lib/forecast.js`: trajetória futura ancorada no placar oficial e tratamento do histórico.
- `data/reference.json`: primeiro turno oficial das 28 abrangências, com URLs e data de coleta.
- `tests/`: testes do modelo, trajetória, cache, concorrência e tratamento de falhas.

Os scripts de publicação e o adaptador em `worker/` pertencem ao ambiente Sites. `dist/` é gerado pelo build; código-fonte não é editado ali.

## Dados oficiais

O servidor consulta os arquivos EA20 da eleição 6258, cargo Presidente, para BR, 27 UFs e ZZ. Brasil já inclui o exterior; a previsão nunca o soma uma segunda vez. O navegador faz uma única consulta à API do projeto por minuto enquanto a aba está visível. Horários de coleta e divulgação são distintos.

Uma falha mantém o retrato completo anterior e sinaliza sua idade. Sem votos ou sem as 28 abrangências, a curva de previsão é suprimida. Não há substituição automática por dados fictícios.

## Gráfico

- Eixo horizontal: percentual de seções totalizadas.
- Linhas contínuas: histórico realmente coletado de Lula e Flávio.
- Marcador Agora: percentual atual da apuração e pontos dos dois candidatos.
- Linhas tracejadas: evolução esperada dos votos restantes até 100%.
- Unidades: percentual dos votos válidos ou votos acumulados.
- A legenda permite exibir ou ocultar cada candidato. Setas do teclado percorrem os pontos.

A previsão começa exatamente nos votos nacionais atuais e acrescenta apenas votos ainda esperados por UF. O ponto final, o número previsto e as linhas usam a mesma conta. Com 100% totalizado, previsão e situação atual coincidem.

Com duas consultas diferentes, a distribuição de chegada usa o ritmo observado por UF, misturado com uma parcela proporcional para não descartar regiões temporariamente paradas. Sem essa informação, usa avanço proporcional. Isso é um cenário de ordem de chegada, não uma faixa de confiança.

O histórico é mantido em memória pelo processo do servidor (até 720 registros) e salvo neste navegador. Reinícios ou troca de instância podem reiniciar o histórico do servidor. Períodos anteriores à coleta não são inventados; não existe uma coleta contínua em segundo plano quando não há visitantes.

## Modelo e limites

Em cada UF e ZZ, votos restantes = votos válidos do primeiro turno × razão de seções entre turnos × fração de seções restantes. A preferência combina o observado na UF com Lula / (Lula + Flávio) do primeiro turno, com peso p / (p + 0,05) para a observação atual.

É uma extrapolação experimental, sem validação retrospectiva nem probabilidade de vitória. Perfis diferentes dentro de uma UF, transferência de votos, comparecimento e votos inválidos podem gerar erro. A ordem do Nordeste não é fixada no modo oficial; o simulador permite testar essa hipótese separadamente.

Para atualizar a referência oficial e a malha do IBGE: `npm run refresh-reference`, seguido de novo build.
