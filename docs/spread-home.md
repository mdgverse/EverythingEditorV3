# Home — pasta aberta em "spread-and-roll" (1.5.0)

## Inspeção da referência (o que deu e o que não deu)

- Página pedida: https://bloop.wtf/en/templates — acessada e lida.
  A lista de animações/templates da página **não tem nenhum "Spread
  Roll"**; o template correspondente é o **"Spread Rows"**. Num
  catálogo público de templates de motion, ele é descrito como
  *"a stack that spreads into drifting rows"* (uma pilha que se espalha
  em fileiras à deriva), loop de 8s.
- **Interação ao vivo: NÃO inspecionada.** A página é um aplicativo JS
  (a leitura retorna só o texto estático) e este ambiente não tem
  navegador com JavaScript/GPU para operar o template, clicar nele e
  medir tempos/easings reais. Nenhuma medição abaixo é apresentada
  como observada no site.
- O comportamento implementado combina: (1) a mecânica descrita do
  Spread Rows (pilha → fileiras que derivam sem parar), (2) a
  especificação detalhada do próprio pedido (pausa no hover, controle
  por arrasto no touch, toque abre, sem abrir após arrastar) e
  (3) a linguagem visual que a Home já tinha (inclusive o carrossel
  da comunidade, que já deriva em loop com o mesmo padrão de track).

## Como ficou na Home

- Clicar/tocar numa pasta (ou Enter/Espaço com ela focada) abre a
  pasta como antes (`ssOpenFolderId` + `ssRenderRecent`, mesmos dados,
  mesmos cartões `.ss-rc` com miniatura, nome, data, Renomear/Excluir/
  Remover da pasta) — mas a lista de projetos vira a apresentação:
  1. **Spread**: os cartões partem empilhados do centro (rotação leve,
     escala 0,82) e se espalham para as suas fileiras, em cascata
     (45 ms entre cartões, 620 ms, `cubic-bezier(.22,1.25,.36,1)` —
     abertura com um toque de overshoot). Acontece uma vez por pasta;
     re-renders da mesma pasta não repetem.
  2. **Roll**: as fileiras (1 até 6 projetos, 2 até 14, 3 acima)
     derivam sem parar em sentidos opostos (26–38 px/s), com loop
     contínuo (conteúdo duplicado e deslocamento embrulhado, sem
     salto). Fileira mais curta que a janela não deriva.
- **Desktop**: passar o mouse sobre a apresentação pausa a deriva na
  hora (também pausa com foco de teclado num cartão); sair retoma do
  mesmo ponto. Clicar abre o projeto pelo fluxo normal
  (`ssOpenProject`).
- **Touch/Android**: arrastar na horizontal assume o controle das
  fileiras (a rolagem vertical da página continua livre,
  `touch-action: pan-y`); depois de um arrasto (>10 px), o clique que
  o sistema geraria é suprimido — nenhum projeto abre sem querer.
  Toque curto (<10 px, <600 ms) abre o projeto. Testado por regras
  puras (`spreadEhToque`), não em aparelho real (ver abaixo).
- **Fechar**: botão "← Folders" de sempre, ou `Esc`; o foco volta
  para o cartão da pasta. Pasta vazia mostra a mensagem existente
  ("No projects in this folder.").
- **Movimento reduzido** (`prefers-reduced-motion: reduce`): a
  apresentação não é montada — vale a grade estática de sempre.
- **Sem vazamento**: a deriva é um `requestAnimationFrame` que para
  quando a vista fecha, a Home some (`#ssScr` oculto) ou o elemento
  sai do DOM; re-renders chamam `ssPararSpread()` antes de reconstruir.
- **Modo de seleção** (Select/Move to…) continua funcionando: os
  cartões são os mesmos, com os mesmos handlers.

## Arquivos

- `index.html`: CSS `.ss-spread/.ss-sprow/.ss-sptrack`, bloco puro
  `/* SPREAD_PURO_INI */..FIM` (`spreadLinhas`, `spreadDistribui`,
  `spreadWrap`, `spreadEhToque`), `ssMontarSpread`, `ssSpreadPreparar`,
  `ssSpreadTick`, `ssPararSpread`, `ssFecharPasta`, montagem
  condicional em `ssRenderRecent` e pastas focáveis por teclado.
- `tests/spread-home.test.mjs`: 26 verificações (regras puras +
  fiação), registrado no CI.

## Limitações da verificação

- Sem navegador/GPU neste ambiente, a animação não foi executada
  visualmente nem medida em fps; a prova é matemática/estrutural
  (suíte verde) + o mesmo padrão de track que o carrossel da
  comunidade já usa em produção.
- Android: o APK embute este mesmo `index.html` (tarefa `copyWebApp`),
  então a interação touch é a do código web; não houve teste em
  aparelho/emulador aqui.
