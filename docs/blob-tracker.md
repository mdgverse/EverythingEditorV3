# Blob Tracker — referência, decisões e limites

## Acesso à referência

- https://app.dasca.studio/ foi acessado: é o trial web do DASCA e
  lista o efeito **"Blob Track"** no painel de efeitos. A página é um
  aplicativo interativo (arrastar, clicar no efeito, abrir dropdowns)
  e este ambiente não tem navegador para operá-lo: **nenhum
  comportamento interno, opção de dropdown ou default foi observado
  ao vivo**.
- A fonte dos controles são os **5 screenshots fornecidos pelo
  usuário** ("Blob Track Settings"): todos os nomes de controles, os
  valores visíveis e os estados dos toggles foram transcritos deles.
- Tudo o que não aparece nos screenshots está marcado abaixo como
  **inferido** — são comportamentos sensatos documentados, não fatos
  verificados da referência.

## O que os screenshots mostram (transcrito)

- Detection: Track = **Details**; Sensitivity **0.51**; Softness
  **0.80**; Merge **0.13**; Min Size **0.030**; Max Size **0.35**;
  Max Blobs **208**; Fine Tune **off**.
- Visualization: Line Width **1.5**; Padding **0.10**; Colors =
  **Single**; Color **#FFFFFF**; Center Mark = **None**; Inside =
  **Original**; Dim Outside **0.00**.
- Labels: Labels **on**; Text = **ID**; Placement = **Above**;
  Text Size **12**; Tag Background **off**.
- Connections: Connections **on**; Connect = **Chain**; Line =
  **Solid**; Line Opacity **0.60**.
- Cores: Label/Shape/Line/Junction/Arrow **#FFFFFF**,
  Background **#000000**.

## Semântica implementada (definições deste editor)

- **Detecção**: luminância (0.2126/0.7152/0.0722) suavizada pela
  Softness (blur de caixa, raio 0–3 na resolução de análise) e
  limiarizada por `limiar = 1 − Sensitivity`. Se mais da metade do
  quadro passa do limiar, a polaridade inverte (blobs escuros sobre
  fundo claro). Componentes conexos viram blobs.
- **Tamanho** (definição documentada, como pedido): `área do blob ÷
  área do quadro` (0..1). Min Size/Max Size filtram nessa fração;
  Max Blobs mantém os maiores.
- **Merge**: blobs cujas caixas estão a até `Merge × 12%` do menor
  lado do quadro são unidos (repetidamente).
- **IDs estáveis**: cada blob novo é pareado com o anterior de menor
  custo (distância do centróide + diferença de tamanho), com teto de
  22% da diagonal do quadro. Blob que some não deixa overlay; blob
  novo ganha ID novo. O estado mora em `n.runtime` (nunca serializa).
- **Análise**: resolução reduzida (maior lado ≤ 288 px; **Fine Tune**
  sobe para 512 px — inferido: mais fino, mais lento). O desenho é
  feito na resolução de saída; Line Width/Text Size escalam com a
  largura (referência de 640 px) para preview e exportação baterem.
- **Track** (inferido; só "Details" foi visto): `Details` = contorno
  real do blob (polígono de borda, ~40 pontos); `Boxes` = caixa
  envolvente; `Points` = só o ponto central.
- **Colors** (inferido; só "Single" foi visto): `Single` = o campo
  Color para todos; `By ID` = matiz por ID; `By Size` = rampa
  azul→vermelho pelo tamanho relativo. O contorno usa essa cor;
  `Inside = Tint/Solid` preenche com o **Shape Color** (35% ou cheio);
  **Center Mark** usa a cor do blob.
- **Inside** (inferido; só "Original" foi visto): Original / Tint /
  Solid. **Center Mark** (idem): None / Dot / Cross. **Dim Outside**:
  véu na cor Background sobre tudo, com os blobs recortados.
- **Labels**: Text = ID / Size (% do quadro) / ID + Size (inferidos
  além de ID); Placement = Above / Below / Center (idem); Tag
  Background pinta um fundo (Background Color, 78%) atrás do texto.
- **Connections**: Connect = Chain (ordem dos IDs) / Nearest / Web
  (todos com todos) / Hub (todos ao maior) — além de Chain, inferidos;
  Line = Solid / Dashed / Dotted (idem); setas na cor Arrow ao fim de
  cada ligação; pontos de junção (Junction) nos centróides.
- **Padding** expande o contorno/caixa a partir do centróide
  (fração do tamanho do blob).

## Plataforma e desempenho

- Web e Android usam o mesmo caminho (`fx7Canvas`, CPU 2D), como o
  CRT Screen. Sem entrada, o nó retorna `null` (o grafo segue); sem
  detecções, devolve a imagem intacta. Vídeo: a detecção roda a cada
  quadro avaliado e os IDs acompanham o movimento; mesclas/divisões
  de blobs podem trocar IDs (limitação conhecida do pareamento por
  proximidade).
- Parâmetros persistem como qualquer nó (defaults dos screenshots em
  projeto novo; salvar/reabrir preserva).

## Testes

`tests/blob-tracker.test.mjs` (25 verificações): painel com os
defaults exatos dos screenshots; detecção em cenas sintéticas
(2 regiões, vazio, Min/Max Size, Max Blobs, Merge, polaridade,
Sensitivity); IDs estáveis com movimento, desaparecimento sem
fantasma e ID novo para blob novo. Sem GPU/navegador neste ambiente,
o desenho final não foi renderizado aqui — a prova da detecção é
numérica e a do painel/desenho é estrutural.
