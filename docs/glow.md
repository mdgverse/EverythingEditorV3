# Glow (Lightroom-style) — engenharia reversa e implementação

## Acesso à referência (o que foi e o que não foi possível fazer)

- **Vídeo**: Reel do Instagram de Allen Xiong (@alleniumx) —
  https://www.instagram.com/reel/DfnzL66xrsp/ — legenda pública:
  "Automotive photographers are gonna go crazy with this one 😳
  #lightroom #lightroommobile". Cena descrita pelo usuário: Mazda RX-7
  preto em garagem escura com faixas de neon ciano no chão; o Glow do
  Lightroom (Effects > Glow) aplicado sobre os highlights.
- **Análise frame a frame: NÃO executada.** A página do Reel só expõe
  metadados/legenda sem login, e o link de "download" fornecido cai num
  serviço de terceiros (SaveClip) — baixar o vídeo por terceiros não foi
  feito. Nenhuma observação abaixo vem de frames decodificados.
- A especificação de trabalho é a descrição detalhada do usuário, que já
  traz os valores usados no vídeo:
  - **Motion**: Glow 29, Range 4, Spread 19–29, Direction −90 (trail
    vertical das luzes do chão e dos faróis);
  - **Streak**: Glow 30, Range 18, Spread 12 (streaks anamórficos);
  - **Warmth** −29/−50 no look final (frio ciano).

## Comportamento replicado

Painel (Lightroom > Effects > Glow), nesta ordem: **Glow** (0–100,
default 0), **Style**, **Range**, **Spread**, **Warmth** (−100…+100),
**Direction** (−180…+180, default −90, **só visível em Motion e
Streak**), **Saturation** (0–100 do glow). Os 5 estilos:

| Style | Como espalha | Notas |
| --- | --- | --- |
| Bloom | Pirâmide mip (down/up) sobre os highlights | Halo difuso gaussiano, sem direção |
| Diffusion | Pirâmide com 1 nível a mais + véu no composite | Levanta os meios-tons perto da luz (look leitoso de filtro de cinema) |
| Halation | Pirâmide + tint quente fixo, núcleo denso nas luzes fortes e aberração cromática radial nas bordas | Fringing quente de filme analógico |
| Motion | Base suave (2 níveis) + blur direcional 97 taps, falloff exponencial, 2 passes | Trail contínuo ao longo de Direction, sem fantasmas |
| Streak | Extração com power curve 1.7 + blur longo em Direction e curto no eixo perpendicular | Linha anamórfica fina e brilhante |

## Pipeline (como pedido × como foi implementado)

1. **Highlights** (`glowExtract`): `lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722))`,
   `mask = smoothstep(Range, Range + 0.15, lum) * lum`, sobre a cor,
   premultiplicado, já em meia resolução. O Range vira limiar por
   `limiar = 1 − Range/100` (Range 4 → 0.96: só os brilhos mais fortes;
   Range 100 → tudo entra).
2. **Buffer com headroom**: os alvos do pool são RGBA8 (não há pool
   half-float no editor); para a soma da pirâmide não clipar, o buffer
   de glow é gravado em escala 1/2 e a escala é desfeita no
   `glowGrade`. É a aproximação honesta do "buffer HDR" dentro da
   arquitetura atual — a fonte já é 8 bits, então não há faixa dinâmica
   real acima de 1 para preservar além disso.
3. **Por Style**: pirâmide de 2–7 níveis conforme o Spread
   (`bloomDown`/`bloomUp` existentes) ou `glowTrail` anisotrópico
   (48 amostras de cada lado = 97 taps, `exp(−3t)`).
4. **Warmth** (`glowGrade`): só na camada de glow — multiplicador RGB
   que mistura para o frio ciano `[0.45, 0.8, 1.3]` ou o quente
   `[1.3, 0.62, 0.3]` conforme o sinal; Saturation mistura a cor do
   glow com a própria luminância. Halation multiplica ainda o tint
   `[1.3, 0.5, 0.27]` e desloca R/B radialmente (CA).
5. **Composite** (`glowComp2`): Screen do glow sobre o original —
   nunca escurece, e a imagem base **nunca é borrada** (o blur vive só
   no buffer de glow). O halo tem alfa próprio, então aparece também
   ao redor de conteúdo transparente (texto, recortes), como no Bloom
   que já existia.
6. **Detalhe preservado**: consequência direta do passo 5.

Glow = 0 devolve o original sem custo (passthrough). Todos os
parâmetros são percentuais/ângulos (independentes de resolução), então
preview rápido e exportação em resolução cheia produzem o mesmo
efeito sem remapeamento.

## Compatibilidade

- O nó continua `glowEffect` ("Glow", categoria lens): grafos salvos
  seguem abrindo. Os parâmetros antigos (`threshold`, `radius`,
  `intensity`) foram removidos conforme a substituição pedida; projetos
  antigos recebem os defaults novos (`createNode` preenche os defaults
  antes de aplicar o salvo) e as chaves antigas gravadas são ignoradas.
- Os nós **Bloom** e **Halation** antigos não foram tocados (outros
  grafos e presets dependem deles); o Glow novo é um sistema separado
  que reutiliza só os passes genéricos da pirâmide.

## Testes

`tests/glow.test.mjs` (38 verificações, no CI): painel e ranges
exatos, visibilidade contextual por estilo, matemática pura (limiar,
níveis, comprimento do rastro, tint de Warmth), estrutura dos shaders
de cada passo do pipeline e a fiação do runner. GLSL validado com
`@shaderfrog/glsl-parser` (115 shaders, 0 erros). Sem GPU neste
ambiente, o render em si não é executado aqui — a prova é estrutural +
matemática, e a validação visual fica para o uso no app publicado.
