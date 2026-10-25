# Pulso — Eleições 2026

Painel estático, sem dependências, para o segundo turno presidencial de 2026. Acesse com `npm run dev` (http://127.0.0.1:4173). Testes: `npm test`.

## Dados reais

Consulta diretamente os arquivos públicos EA20 do TSE, eleição 6258, cargo 1, em BR, nas 27 UFs e ZZ. O servidor do TSE permite CORS; nenhuma chave ou servidor intermediário é necessário. São até 4 requisições simultâneas, 29 por consulta, com atualização a cada 60 segundos enquanto a página está visível. Ao voltar à aba, faz uma nova consulta.

O horário exibido é o da fonte; consulta recente não significa votos recentes. O total BR já inclui exterior. Cada abrangência pode ter uma geração diferente. Falhas preservam o último retrato completo e exibem aviso. A primeira consulta incompleta suprime a projeção. O último retrato e os 180 registros mais recentes ficam no localStorage deste navegador. Não há coleta de dados pessoais ou envio do histórico para um servidor.

## Modelo experimental

Para cada UF e ZZ, votos restantes = votos válidos do 1º turno × (seções 2º turno / seções 1º turno) × fração de seções restantes. A preferência de Lula nas urnas restantes combina sua participação entre Lula e Flávio no 1º turno com a participação observada no 2º. O peso da observação é p/(p+0,05). Somam-se os votos observados e os estimados nas 28 abrangências. Com 100% das seções totalizadas, o resultado projetado coincide com os votos observados por UF.

Não é probabilidade de vitória, pesquisa, declaração de vencedor ou modelo validado retrospectivamente. Usa extrapolação por UF; não controla a heterogeneidade dos municípios e seções dentro da UF. A transferência de votos entre turnos e mudanças no comparecimento são limitações importantes.

`dist/assets/reference.json` é uma cópia pública das 28 abrangências no 1º turno (6257), com URL e data de coleta. Para atualizar a referência e a malha vetorial do IBGE, execute `npm run refresh-reference`. A aplicação não usa pesquisas eleitorais.

## Simulação

Ativada apenas pelo usuário, com banner e rótulos em todo o painel. Os ritmos regionais são fictícios. Nordeste mais lento é uma hipótese deste cenário, não uma afirmação sobre uma ordem fixa da apuração real. O controle de preferência altera somente as urnas que faltam. A curva simulada nunca é salva no histórico oficial.

## Publicação

O manifesto `.openai/hosting.json` identifica o Site privado. O conteúdo publicado está em `dist/`. Não há etapa de compilação. A publicação segue o helper oficial do Sites e usa o mesmo commit enviado ao repositório.
