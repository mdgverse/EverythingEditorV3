# CRT Screen — socket `module`: pesquisa e decisões

## Acesso ao vídeo (o que foi e o que não foi possível fazer)

- **Vídeo**: "Texturelabs // Analog Retro-Futuristic Monitor in Photoshop!"
  (canal Texturelabs, 2022-12-06, 9:49), indicado pelo usuário:
  https://www.youtube.com/watch?v=1Lv4_atfkqo
- **Transcrição**: obtida do texto exibido na **própria página do vídeo**
  (recurso de transcrição do YouTube), em inglês, sem timestamps por trecho.
  Os serviços `yt-mp4.com.co` e `youtubetotranscript.com` **não foram usados**:
  baixar o vídeo por terceiros violaria os termos do YouTube e as regras
  desta tarefa (nada foi baixado, nenhum DRM/restrição foi contornado).
- **Análise frame a frame: NÃO executada.** Não há `ffmpeg`/`yt-dlp` neste
  ambiente e o vídeo não foi baixado (ver acima). Portanto **nenhuma**
  observação abaixo vem de frames decodificados; tudo vem da transcrição
  oficial da página. Timestamps por trecho não estavam disponíveis na
  transcrição — os trechos são citados na ordem em que aparecem.

## Tabela de pesquisa (transcrição × CRT Screen atual)

| Trecho (ordem na transcrição) | O que é descrito no vídeo | Já existe no CRT Screen? | Diferença ou lacuna | Ação proposta |
| --- | --- | --- | --- | --- |
| Abertura | Monitor "real" simulado que quebra a imagem numa grade de pixels que acendem/apagam conforme o brilho | Parcial: grade de fósforo (grille) + scanlines fixas, geradas internamente | O pattern do CRT é sempre o interno; não há pattern personalizado | Socket `module` como fonte alternativa do pattern |
| Premissa do tile | Um tile de 100×100px: fundo preto com 3 retângulos em cinzas diferentes; combinado em Hard Mix sobre cinza, os retângulos "acendem" por limiares de brilho (0, 1, 2 ou 3 retângulos) | Não: a máscara interna é triádica RGB fixa | Falta a noção de célula de pattern desenhada pelo usuário | A célula do `module` é o canvas inteiro da fonte (com margens), repetida por tiling |
| Alinhamento | Pattern precisa alinhar com as células: "turn off link with layer" + "snap to origin" (canto superior esquerdo) | O pattern interno já é ancorado em (0,0) | — | Tiling do `module` ancorado em (0,0), estável entre renders |
| Escala | Ao mudar a célula de 100px para 30px, a escala do pattern muda junto (30) para continuar alinhado | `grilleSize` escala só o fósforo interno | Sem controle de escala para pattern externo | Novo controle mínimo **Module scale** (%, neutro 100), com interruptor próprio |
| Troca de pattern | Um segundo tile ("soft pixels", com bordas suaves) produz variação por célula mantendo o mesmo sistema | Não | — | Aceitar imagem/vetor/texto preto como pattern, com antialiasing preservado (máscara em tons de cinza, não binária) |
| Tratamento posterior | Converter para branco sobre transparente e aplicar cor/brilho (glow) por cima, tudo ao vivo e ajustável | Sim: `style` (green/amber/mono), glow, phosphor etc. continuam agindo depois do pattern | — | O `module` substitui **só** a fonte do pattern (a modulação do grille); cor, scanlines, glow e demais parâmetros continuam |

## Decisões de implementação (conforme a especificação da tarefa)

- Socket novo chamado exatamente **`module`**, segundo socket do nó
  (`inputs: ['Image', 'module']`). Aceita qualquer nó que produza imagem
  (bitmap, vetor, texto — todos renderizam para o mesmo tipo de resultado
  no grafo), sem mudar a validação de conexões existente.
- **Desconectado**: comportamento e custo idênticos aos de antes (o caminho
  do pattern interno nem recebe a máscara).
- **Conectado**: a máscara do módulo substitui a modulação triádica do
  `grille`. Conversão: `máscara = alfa × (1 − luminância)` por pixel da
  célula (preto ativo/escuro; branco ou transparente neutros; sem retângulo
  branco, sem binarização — bordas suaves preservadas). A força continua
  sendo o parâmetro **RGB grid** (`grille`): fator por canal =
  `1 − grille × máscara`. Preto **escurece/modula** a imagem, como o grille
  interno já fazia.
- **Célula**: os limites do canvas da fonte (incluindo margens
  transparentes/brancas) são a célula; ela se repete por tiling ancorado em
  (0,0), sem esticar: o tamanho em tela é `dimensões da fonte × Module
  scale`, corrigido pela razão preview/resolução cheia para o pattern não
  mudar de tamanho entre a prévia leve e a exportação.
- **Cache**: a rasterização + máscara ficam em `n.runtime._crtMod`, com
  chave = identidade do resultado da fonte + tamanho da célula. Editar
  outro parâmetro reutiliza a máscara; editar a fonte (novo resultado no
  grafo) invalida. A fonte nunca é modificada.
- **Alfa da imagem principal** não é tocado pela máscara (o canal alfa da
  saída continua vindo da imagem de entrada, como antes).

## Incertezas que permanecem

- Sem análise frame a frame, não dá para confirmar detalhes visuais finos
  do vídeo (ex.: curvas exatas do glow final). Nada foi adicionado ao nó
  com base em suposição visual: os únicos comportamentos novos são os da
  especificação da tarefa + a técnica de pattern descrita na transcrição.

## Correção 1.3.1 — "module não funciona" (relato do usuário)

O usuário testou a 1.3.0 e reportou que o `module` não funcionava,
observando que no vídeo são usados **patterns diferentes** no mesmo
sistema CRT. Investigação:

- **Fiação verificada ponta a ponta** (leitura do código): o socket
  `module` é criado na interface (`nodeInputs`/`buildNodeEl` com
  `data-idx` na ordem de `inputs`), a conexão grava `links` com o índice
  alvo correto, `evalNode` entrega o resultado da fonte no slot 1,
  `RUN.crtScreen` chama `crtModuleMask` e `fx12CRT` usa a máscara, e o
  `cacheResult` não apaga o runtime do nó. Ou seja: **ligar o pattern
  chegava ao render** — o defeito não era conexão, índice, cache ou
  preview/export (mesmo caminho).
- **Causa raiz**: a semântica da 1.3.0 era uma *multiplicação suave*
  (máscara como fator de escurecimento, estilo grille). Patterns
  diferentes apenas escureciam a imagem em graus parecidos, sem formar
  as formas do pattern — visualmente "nada acontece". No vídeo, o
  pattern funciona por **limiar de brilho** (Hard Mix): cada nível de
  cinza do tile acende onde o brilho da imagem passa do seu limiar, e é
  isso que faz trocar o pattern trocar o visual.
- **Correção**: dentro de `fx12CRT`, com o module conectado, cada pixel
  agora compara a luminância da imagem com o valor da máscara naquele
  ponto (`f = clamp((lum − máscara)/0.12 + 1)`, com transição suave
  abaixo do limiar e smoothstep): acima do limiar o pixel acende por
  completo; abaixo, apaga progressivamente. Branco/transparente
  (máscara 0) sempre acendem (= neutro, fator 1); preto (máscara 255)
  só acende com a imagem no brilho máximo; os cinzas ficam no meio —
  exatamente os retângulos do tile do vídeo. A força continua sendo o
  parâmetro `grille` (100% = pattern puro; menos mistura com o tubo).
  Desconectado, o caminho interno é o mesmo de antes (hashes dourados
  inalterados).
- **Robustez extra**: `crtModuleMask` agora tem teto de rasterização
  (4096px no maior lado da célula, redução proporcional) e qualquer
  falha ao ler a fonte devolve `null` (volta ao pattern interno) em vez
  de propagar exceção para o render do nó.
- **Testes**: `tests/crt-screen.test.mjs` ganhou a regressão do caso
  real — trocar o pattern muda o resultado; com imagem clara o cinza do
  pattern acende e o preto apaga; com imagem escura o cinza apaga antes
  do neutro (44 verificações no total, suíte completa verde).
