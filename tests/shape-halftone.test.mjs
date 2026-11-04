/* Editor 3.5 — Shape Halftone (Nexus): painel completo, shader por canal e execução. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const funcao = nome => {
  const a = html.indexOf('function ' + nome + '(');
  if (a < 0) throw new Error('função não encontrada: ' + nome);
  const b = html.indexOf('\nfunction ', a + 12);
  return html.slice(a, b < 0 ? undefined : b);
};
const recorta = (ini, fim) => {
  const a = html.indexOf(ini);
  const b = fim ? html.indexOf(fim, a) : -1;
  if (a < 0 || (fim && (b < 0 || b < a))) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, fim ? b : undefined);
};

console.log('Shape Halftone');

/* ---------- definição do nó ---------- */
const def = recorta('  shapeHalftone: {', '  output: {');
ok(/title: 'Shape Halftone'/.test(def), 'nome do nó: Shape Halftone', 'title');
ok(/cat: 'style'/.test(def), 'entra na categoria de estilo', 'cat');
ok(/inputs: \['Image'\]/.test(def) && /outs: \['Image'\]/.test(def), 'recebe uma imagem e devolve uma imagem');
ok(/kw: '[^']*halftone[^']*'/.test(def), 'palavras-chave para a busca do add menu', 'kw');

/* os campos do inspector, com os mesmos rótulos do print */
const campos = [
  ['Opacity', /HNUM\('opacity', 'Opacity', 0, 100, 100, 1\)/],
  ['Blend', /HENUM\('blend', 'Blend', BLEND, 'normal'\)/],
  ['Show Source', /HSW\('showSource', 'Show Source', 'nao'\)/],
  ['Position X', /HNUM\('posX', 'Position X', -200, 200, 0, 0\.5\)/],
  ['Position Y', /HNUM\('posY', 'Position Y', -200, 200, 0, 0\.5\)/],
  ['Size W', /HNUM\('sizeW', 'Size W', 5, 400, 100, 1\)/],
  ['Size H', /HNUM\('sizeH', 'Size H', 5, 400, 100, 1\)/],
  ['trava de proporção', /HLOCK\('proporcao', 'Lock ratio', 'locked'\)/],
  ['Glow', /HNUM\('glow', 'Glow', 0, 1, 0, 0.01\)/],
  ['Exposure', /HNUM\('exposure', 'Exposure', 0, 4, 1, 0.01\)/],
  ['Cell Size', /HNUM\('cellSize', 'Cell Size', 2, 80, 11, 0.1\)/],
  ['Size Spread', /HNUM\('sizeSpread', 'Size Spread', 0, 1, 0, 0.01\)/],
  ['Dot Gain', /HNUM\('dotGain', 'Dot Gain', 0, 3, 1\.133, 0\.001\)/],
  ['Paper Grain', /HNUM\('paperGrain', 'Paper Grain', 0, 1, 0\.3, 0\.01\)/],
  ['Misregistration', /HNUM\('misreg', 'Misregistration', 0, 40, 0\.42, 0\.01\)/],
  ['Ink Mode', /HENUM\('inkMode', 'Ink Mode', SH_INK_MODES, 'additive'\)/],
  ['Ink Curve', /HCURVE\('inkCurve', 'Ink Curve', \[0\.42, 0\.06, 0\.58, 0\.94\]\)/],
  ['Threshold Range', /HRANGE\('threshold', 'Threshold Range', \[0\.08, 0\.92\]\)/],
  ['Red Shape', /HENUM\('redShape', 'Red Shape', SH_SHAPES, 'smileys'\)/],
  ['Red Angle', /HNUM\('redAngle', 'Red Angle', 0, 180, 33, 1\)/],
  ['Red Ink', /HCOL\('redInk', 'Red Ink', '#e8322a'\)/],
  ['Red Intensity', /HNUM\('redInt', 'Red Intensity', 0, 3, 1\.1, 0\.01\)/],
  ['Green Shape', /HENUM\('greenShape', 'Green Shape', SH_SHAPES, 'lines'\)/],
  ['Green Angle', /HNUM\('greenAngle', 'Green Angle', 0, 180, 29, 1\)/],
  ['Green Ink', /HCOL\('greenInk', 'Green Ink', '#1fa35a'\)/],
  ['Green Intensity', /HNUM\('greenInt', 'Green Intensity', 0, 3, 1, 0\.01\)/],
  ['Blue Shape', /HENUM\('blueShape', 'Blue Shape', SH_SHAPES, 'arrows'\)/],
  ['Blue Angle', /HNUM\('blueAngle', 'Blue Angle', 0, 180, 121, 1\)/],
  ['Blue Ink', /HCOL\('blueInk', 'Blue Ink', '#2a4fd6'\)/],
  ['Blue Intensity', /HNUM\('blueInt', 'Blue Intensity', 0, 3, 1\.56, 0\.01\)/],
  ['Contrast', /HNUM\('contrast', 'Contrast', 0, 3, 1, 0\.01\)/],
  ['Gamma', /HNUM\('gamma', 'Gamma', 0\.1, 4, 1, 0\.01\)/],
  ['Invert', /HSW\('invert', 'Invert', 'nao'\)/],
];
for (const [nome, re] of campos) ok(re.test(def), 'controle: ' + nome);

/* todos os parâmetros são montados pelo painel do nó (nada de controle repetido) */
{
  const chaves = [...def.matchAll(/H(?:NUM|ENUM|COL|LOCK|SW|CURVE|RANGE)\('([a-zA-Z]+)'/g)].map(m => m[1]);
  const soHidden = [...def.matchAll(/^      H[A-Z]+\(/gm)].length;
  ok(chaves.length === 33, 'o nó tem os 33 controles do painel (Paper saiu na 3.5.2)', chaves.length);
  ok(soHidden === chaves.length, 'todos os parâmetros do nó ficam ocultos no inspetor genérico', soHidden);
  const secoes = recorta('const SH_SECOES = [', '];');
  const usadas = [...secoes.matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1]).filter(k => /^(opacity|blend|showSource|posX|posY|sizeW|sizeH|proporcao|paper|glow|exposure|cellSize|sizeSpread|dotGain|paperGrain|misreg|inkMode|inkCurve|threshold|red|green|blue|contrast|gamma|invert)/.test(k));
  const faltando = chaves.filter(k => !usadas.includes(k));
  ok(faltando.length === 0, 'todo parâmetro aparece numa seção do painel', faltando.join(', '));
}

/* ---------- seções do painel (ordem e nomes do print) ---------- */
{
  const secoes = recorta('const SH_SECOES = [', '];');
  const titulos = [...secoes.matchAll(/^  \['([A-Za-z ]+)', \[/gm)].map(m => m[1]);
  const pedidos = ['Transform', 'Glow', 'Shape', 'Texture', 'Distortion', 'Blend', 'Red', 'Green', 'Blue', 'General'];
  ok(titulos.join('|') === pedidos.join('|'), 'seções na ordem do inspector', titulos.join('|'));
}

/* ---------- shader ---------- */
const sh = recorta('  shapeHalftone: `', '\n`,\n};');
ok(/uniform sampler2D uSrc, uGlyph, uCurveTex;/.test(sh), 'lê a imagem, o atlas de glifos e a LUT da curva');
ok(/uniform vec2 uRes, uPos, uSize;/.test(sh), 'resolução e transform da camada (posição/tamanho)');
ok(/uniform float uOpacity, uGlow, uExposure, uCell, uSpread, uGain, uGrain, uMisreg;/.test(sh), 'opacidade, glow, exposição, célula, spread, ganho, grão e misregistration');
ok(/uniform float uThrA, uThrB, uContrast, uGamma, uShow, uInvert, uInkMode, uFallback;/.test(sh), 'threshold, contraste, gamma, show source, invert, modo de tinta e fallback');
ok(/float vazio = step\(0\.5, uFallback\);/.test(sh), 'fallback do atlas é lido no shader', 'fallback');
ok(/1\.0 - smoothstep\(1\.0 - e\.x, 1\.0 \+ e\.x, length\(gu\)\)/.test(sh), 'sem atlas imprime o ponto redondo clássico', 'ponto');
ok(/uniform float uShape\[3\], uAng\[3\], uInt\[3\];/.test(sh), 'forma/ângulo/intensidade por canal');
ok(/uniform vec3 uInkR, uInkG, uInkB;/.test(sh), 'as três tintas');
ok(!/uPaper/.test(sh), 'sem uniforme de papel (controle removido na 3.5.2)', 'paper');
ok(/const vec3 PAPEL = vec3\(0\.9569, 0\.9373, 0\.8941\);/.test(sh), 'o papel é o creme fixo do print', 'papel');
ok(/uniform int uMode;/.test(sh), 'blend da camada com a imagem de baixo');
ok(/for \(int c = 0; c < 3; c\+\+\)\{/.test(sh), 'um passo por canal RGB');
ok(/float mi = \(ch - 1\.0\) \* uMisreg;/.test(sh), 'misregistration desloca os canais', 'misreg');
ok(/vec2 gq = shRot\(px - center \+ off, ang\) \/ cell;/.test(sh), 'grade própria de cada canal (ângulo + célula)');
ok(/texture\(uCurveTex, vec2\(clamp\(tone, 0\.0, 1\.0\), 0\.5\)\)\.r/.test(sh), 'a curva de tinta entra como LUT de 256 px');
ok(/smoothstep\(uThrA, uThrB, k\)/.test(sh), 'threshold range delimita a entrada da tinta');
ok(/pow\(clamp\(cov, 0\.0, 1\.0\), 1\.0 \/ max\(uGain, 0\.08\)\)/.test(sh), 'dot gain aumenta a cobertura');
ok(/uSpread \* \(rnd - 0\.5\) \* 1\.6/.test(sh), 'size spread varia o tamanho célula a célula');
ok(/vec2 gu = vec2\(local\.x, -local\.y\) \* 2\.0 \/ esc;/.test(sh), 'a cobertura escala o glifo dentro da célula');
ok(/fwidth\(gu\)/.test(sh), 'borda do glifo com antialiasing (fwidth)');
ok(/vec2 auv = shGlyphUV\(/.test(sh) && /texture\(uGlyph, auv\)\.a/.test(sh), 'o glifo vem do atlas (SVG rasterizado)');
ok(/textureLod\(uGlyph, auv, 1\.5\)\.a/.test(sh), 'glow é o próprio glifo desfocado no mipmap', 'glow');
ok(/hash\(px\.x, px\.y\)/.test(sh), 'paper grain com hash determinístico (export = preview)', 'grain');
ok(/lightAcc \+= ink \* alpha;/.test(sh), 'tinta additive: as três tintas somam luz', 'additive');
ok(/if \(modo == 0\) col = lightPix;/.test(sh), 'additive recorta o papel sob a tinta', 'knockout');
ok(/mulAcc \*= 1\.0 - alpha \* \(1\.0 - ink\);/.test(sh), 'tinta multiply: uma camada por cima da outra', 'multiply');
ok(/dens \+= \(1\.0 - ink\) \* alpha;/.test(sh), 'densidade das tintas para overlay/soft light', 'dens');
ok(/int modo = int\(uInkMode \+ 0\.5\);/.test(sh), 'modo de tinta escolhido por índice');
ok(/blendRGB\(src, col\)/.test(sh), 'blend da camada com a imagem de entrada');
ok(/mix\(src, blendRGB\(src, col\), clamp\(uOpacity, 0\.0, 1\.0\)\)/.test(sh), 'opacidade fecha a mistura (0–100%)');
ok(/uShow > 0\.5/.test(sh), 'Show Source mostra a imagem original sob a tinta');
ok(/outColor = vec4\(clamp\(outC, 0\.0, 1\.0\), s0\.a\);/.test(sh), 'saída normalizada com o alfa da fonte');
ok((sh.match(/\{/g) || []).length === (sh.match(/\}/g) || []).length, 'chaves equilibradas no GLSL');
ok(!/qTime|uTime/.test(sh), 'determinístico: sem tempo', 'sem tempo');
ok(!/shField|sdTri|sdBox/.test(sh), 'nada de forma procedural no GLSL: o desenho é o glifo do atlas');

/* ---------- glifos em SVG ---------- */
{
  const bloco = recorta('const SH_GLYPHS = {', '\n};');
  const chaves = [...bloco.matchAll(/^  ([a-z]+): \[/gm)].map(m => m[1]);
  ok(chaves.length === 16, 'atlas com 16 glifos', chaves.length);
  const formas = [...recorta('const SH_SHAPES = [', '];').matchAll(/\['([a-z]+)'/g)].map(m => m[1]);
  ok(formas.join(',') === chaves.join(','), 'a ordem dos glifos é a mesma do dropdown', chaves.join(','));
  const faltando = formas.filter(f => !bloco.includes('  ' + f + ': ['));
  ok(faltando.length === 0, 'todo Shape do dropdown tem desenho', faltando.join(','));
  for (const nome of ['dot', 'smileys', 'arrows', 'heart', 'grid', 'waves', 'ring']) {
    ok(bloco.includes('  ' + nome + ": ['M"), 'glifo "' + nome + '" é um caminho SVG');
  }
  ok(/stars: \[shStarPath\(\)\]/.test(bloco), 'estrela vem do gerador de caminho', 'stars');
  const smiley = bloco.match(/smileys: \[([\s\S]*?)\],/)[1];
  ok((smiley.match(/'M/g) || []).length >= 4, 'smiley tem cara, dois olhos e boca (sub-caminhos)', (smiley.match(/'M/g) || []).length);
  ok(/'nonzero'/.test(bloco), 'o grid usa a regra nonzero (treliça, não xadrez)', 'grid');
  ok(!/undefined|NaN/.test(bloco), 'nenhum caminho com valor quebrado');
  const estrela = recorta('function shStarPath(', '\n}\n') + '\n}';
  const path = new Function(estrela + '\nreturn shStarPath;')()();
  ok(/^M[\d\s.-]+(?:L[\d\s.-]+)+Z$/.test(path), 'estrela é gerada como caminho fechado', path.slice(0, 24));
  ok((path.match(/L/g) || []).length === 9, 'estrela de 5 pontas = 10 vértices', (path.match(/L/g) || []).length);
  const nums = path.match(/-?\d+\.\d/g) || [];
  ok(nums.length >= 20 && nums.every(v => Number(v) >= -2 && Number(v) <= 102), 'estrela dentro do tile 100x100');
}

/* ---------- atlas rasterizado no canvas ---------- */
{
  const fonte = recorta('let shAtlasTex = null, shAtlasVazio = 0;', 'function shGlyphAtlas(') + funcao('shGlyphAtlas');
  const LISTA = [['dot'], ['square'], ['diamond'], ['triangle'], ['lines'], ['arrows'], ['smileys'], ['stars'],
    ['plus'], ['ring'], ['hexagon'], ['grid'], ['waves'], ['heart'], ['ellipse'], ['solid']];
  const GLIFOS = {};
  for (const [id] of LISTA) GLIFOS[id] = ['M0 0h10v10H0Z'];
  const preenchidos = [];
  let canvas = null, tex = 0, mip = 0;
  let alfaAtlas = 0;
  const ctx = {
    clearRect() {}, save() {}, restore() {},
    translate(x, y) { this.tx = x; this.ty = y; },
    scale() {}, set fillStyle(v) { this.cor = v; },
    fill(p, regra) { preenchidos.push({ d: p.d, regra, x: this.tx, y: this.ty, cor: this.cor }); },
    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      if (alfaAtlas) for (let i = 3; i < data.length; i += 4) data[i] = alfaAtlas;
      return { data };
    },
  };
  const doc = { createElement: () => (canvas = { width: 0, height: 0, getContext: () => ctx }) };
  const glF = {
    createTexture: () => (++tex), bindTexture() {},
    pixelStorei() {}, texImage2D(a, b, c, d, e) { glF.img = { d, e }; },
    generateMipmap() { mip++; }, texParameteri() {},
  };
  const fab = new Function('document', 'Path2D', 'gl', 'SH_SHAPES', 'SH_GLYPHS',
    fonte + '\nreturn { shGlyphAtlas, vazio: () => shAtlasVazio };');
  const mod = fab(doc, class { constructor(d) { this.d = d; } }, glF, LISTA, GLIFOS);
  const atlas = mod.shGlyphAtlas;
  const t1 = atlas();
  ok(t1 === tex, 'atlas vira textura na primeira chamada');
  ok(canvas && canvas.width === 512 && canvas.height === 512, 'atlas 4x4 de 128 px = 512x512', canvas && [canvas.width, canvas.height]);
  ok(preenchidos.length === 16, 'os 16 glifos são desenhados', preenchidos.length);
  ok(preenchidos[0].x === 0 && preenchidos[0].y === 0, 'primeiro glifo no canto (dot)');
  ok(preenchidos[4].x === 0 && preenchidos[4].y === 128, 'quinto glifo na segunda linha (lines)', [preenchidos[4].x, preenchidos[4].y]);
  ok(preenchidos[11].x === 384 && preenchidos[11].y === 256, 'grid no tile certo', [preenchidos[11].x, preenchidos[11].y]);
  ok(preenchidos[0].cor === '#ffffff', 'glifos em branco (o shader usa o alfa)');
  ok(preenchidos[0].regra === 'evenodd', 'regra padrão even-odd');
  ok(mip === 1, 'atlas gera mipmap uma vez');
  ok(atlas() === tex && preenchidos.length === 16, 'segunda chamada reaproveita o atlas (sem redesenhar)');
  ok(mod.vazio() === 1, 'atlas sem tinta liga o fallback (nunca folha lisa)', mod.vazio());

  /* com tinta no canvas o fallback fica desligado */
  alfaAtlas = 255;
  const mod2 = fab(doc, class { constructor(d) { this.d = d; } }, glF, LISTA, GLIFOS);
  mod2.shGlyphAtlas();
  ok(mod2.vazio() === 0, 'atlas com tinta não liga o fallback', mod2.vazio());
}

/* ---------- curva de tinta (matemática pura) ---------- */
{
  const fonte = funcao('shCurveBake');
  const bake = new Function('clamp', 'const SH_SHAPES = [];' + fonte + '\nreturn shCurveBake;')((v, a, b) => Math.min(b, Math.max(a, v)));
  const padrao = bake();
  ok(padrao.length === 16, 'curva vira 16 amostras para o shader', padrao.length);
  ok(padrao.every(v => v >= 0 && v <= 1), 'amostras dentro de 0–1');
  ok(padrao[0] < 0.2 && padrao[15] > 0.8, 'começa no preto cheio e termina no branco', [padrao[0], padrao[15]]);
  let sobe = true;
  for (let i = 1; i < padrao.length; i++) if (padrao[i] < padrao[i - 1] - 1e-6) sobe = false;
  ok(sobe, 'curva padrão é monotônica (tom → cobertura)');
  ok(padrao[8] > 0.4 && padrao[8] < 0.6, 'meio-tom fica perto do meio da curva', padrao[8]);
  const linear = bake([0.5, 0.0, 0.5, 1.0]);
  ok(Math.abs(linear[7] - 7 / 15) < 0.06, 'alças no meio = rampa reta', linear[7]);
  const lixo = bake('nada');
  ok(lixo.length === 16 && lixo.every(v => v >= 0 && v <= 1), 'valor inválido cai na curva padrão');
  const extremo = bake([0, 2, 1, -1]);
  ok(extremo.every(v => v >= 0 && v <= 1), 'alças fora da caixa são limitadas');
}

/* ---------- execução: parâmetros → uniforms ---------- */
{
  const fonte = funcao('runShapeHalftone').replace('uFallback: shAtlasVazio,', 'uFallback: __vazio(),');
  const SH_SHAPES_T = [['dot', 'Dot'], ['square', 'Square'], ['diamond', 'Diamond'], ['triangle', 'Triangle'],
    ['lines', 'Lines'], ['arrows', 'Arrows'], ['smileys', 'Smileys'], ['stars', 'Stars'], ['plus', 'Plus'],
    ['ring', 'Ring'], ['hexagon', 'Hexagon'], ['grid', 'Grid'], ['waves', 'Waves'], ['heart', 'Heart'],
    ['ellipse', 'Ellipse'], ['solid', 'Solid']];
  const SH_INK_T = [['additive', 'Additive'], ['multiply', 'Multiply'], ['screen', 'Screen'],
    ['overlay', 'Overlay'], ['softlight', 'Soft light'], ['difference', 'Difference'], ['subtract', 'Subtract']];
  const BLEND_T = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay']];
  const fonteCurva = funcao('shCurveBake');
  let atlasPedido = 0, lutPedida = null;
  let atlasVazio = 0;
  const fabrica = new Function('pointOp', 'clamp', 'BLEND', 'SH_SHAPES', 'SH_INK_MODES', 'hexRGB', 'isFinite',
    'shGlyphAtlas', 'shCurveTexus', '__vazio',
    'const shShapeId = v => { const i = SH_SHAPES.findIndex(x => x[0] === v); return i < 0 ? 0 : i; };' +
    'const shInkModeId = v => { const i = SH_INK_MODES.findIndex(x => x[0] === v); return i < 0 ? 0 : i; };' +
    fonteCurva + fonte + '\nreturn runShapeHalftone;');
  let pedido = null;
  const run = fabrica((a, prog, u, extra) => { pedido = { prog, u, extra, a }; return { ok: 1 }; },
    (v, a, b) => Math.min(b, Math.max(a, v)), BLEND_T, SH_SHAPES_T, SH_INK_T,
    hex => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255],
    isFinite,
    () => (++atlasPedido, 'atlas-tex'),
    curva => (lutPedida = curva, 'lut-tex'), () => atlasVazio);

  const p = {
    opacity: 80, blend: 'multiply', showSource: 'sim', posX: 12, posY: -30, sizeW: 100, sizeH: 100, proporcao: 'locked',
    glow: 0.25, exposure: 1.2, cellSize: 9, sizeSpread: 0.5, dotGain: 1.4, paperGrain: 0.3,
    misreg: 3, inkMode: 'screen', inkCurve: [0.42, 0.06, 0.58, 0.94], threshold: [0.2, 0.8],
    redShape: 'smileys', redAngle: 33, redInk: '#e8322a', redInt: 1.1,
    greenShape: 'lines', greenAngle: 29, greenInk: '#1fa35a', greenInt: 1,
    blueShape: 'arrows', blueAngle: 121, blueInk: '#2a4fd6', blueInt: 1.56,
    contrast: 1.3, gamma: 0.9, invert: 'sim',
  };
  const saida = run({ id: 7, params: p }, { w: 640, h: 480, tex: 'tex' });
  ok(saida && saida.ok, 'roda com uma imagem ligada');
  ok(pedido.prog === 'shapeHalftone', 'usa o programa do Shape Halftone', pedido.prog);
  ok(pedido.a.w === 640 && pedido.a.h === 480, 'mantém a resolução da entrada');
  const u = pedido.u;
  ok(u.uRes[0] === 640 && u.uRes[1] === 480, 'uRes com o tamanho do quadro');
  ok(u.uSize[0] === 640 && u.uSize[1] === 480, 'Size 100% = imagem inteira (sem zoom no padrão)', u.uSize);
  ok(Math.abs(u.uPos[0] - 76.8) < 1e-6 && Math.abs(u.uPos[1] + 144) < 1e-6, 'posição em % vira pixels do quadro', u.uPos);
  ok(pedido.extra.uGlyph === 'atlas-tex' && pedido.extra.uCurveTex === 'lut-tex', 'atlas e LUT entram como texturas', pedido.extra);
  ok(u.uFallback === 0, 'atlas bom → sem fallback', u.uFallback);
  ok(atlasPedido === 1, 'o atlas é pedido uma vez por execução');
  ok(lutPedida === p.inkCurve, 'a LUT é montada a partir da curva do nó');
  ok(Math.abs(u.uOpacity - 0.8) < 1e-9, 'opacidade em 0–1', u.uOpacity);
  ok(u.uMode === 1, 'blend Multiply = índice 1 da lista de blends', u.uMode);
  ok(u.uShow === 1, 'Show Source ligado');
  ok(u.uInvert === 1, 'Invert ligado');
  ok(Math.abs(u.uCell - 9) < 1e-9 && Math.abs(u.uSpread - 0.5) < 1e-9, 'cell size e size spread');
  ok(Math.abs(u.uGain - 1.4) < 1e-9 && Math.abs(u.uGrain - 0.3) < 1e-9, 'dot gain e paper grain');
  ok(Math.abs(u.uMisreg - 3) < 1e-9, 'misregistration em pixels');
  ok(u.uInkMode === 2, 'Ink Mode Screen = índice 2', u.uInkMode);
  ok(Math.abs(u.uThrA - 0.2) < 1e-9 && Math.abs(u.uThrB - 0.8) < 1e-9, 'threshold range');
  ok(Array.isArray(u.uShape) && u.uShape.join(',') === '6,4,5', 'formas por canal (smileys/lines/arrows)', u.uShape);
  ok(u.uAng.join(',') === '33,29,121', 'ângulos por canal 33/29/121', u.uAng);
  ok(u.uInt.join(',') === '1.1,1,1.56', 'intensidades por canal', u.uInt);
  ok(u.uInkR.length === 3 && u.uInkR[0] > 0.8 && u.uInkG[1] > 0.5 && u.uInkB[2] > 0.7, 'tintas em 0–1');
  ok(Math.abs(u.uContrast - 1.3) < 1e-9 && Math.abs(u.uGamma - 0.9) < 1e-9, 'contraste e gamma');
  ok(Math.abs(u.uGlow - 0.25) < 1e-9 && Math.abs(u.uExposure - 1.2) < 1e-9, 'glow e exposição');
  ok(!('uPaper' in u), 'nenhuma cor de papel vai para o shader');

  /* transform em % da moldura */
  const meio = Object.assign({}, p, { sizeW: 50, sizeH: 25, posX: 0, posY: 0 });
  run({ id: 70, params: meio }, { w: 1000, h: 800, tex: 't' });
  ok(pedido.u.uSize[0] === 500 && pedido.u.uSize[1] === 200, 'Size 50%/25% = metade da largura e um quarto da altura', pedido.u.uSize);
  const semTam = Object.assign({}, p, { sizeW: 0, sizeH: 0 });
  run({ id: 72, params: semTam }, { w: 720, h: 540, tex: 't' });
  ok(pedido.u.uSize[0] === 720 && pedido.u.uSize[1] === 540, 'Size 0 herdado da 3.5.0 vira 100% (imagem inteira)', pedido.u.uSize);
  const antigo = Object.assign({}, p, { sizeW: 1209, sizeH: 1209, posX: -1830, posY: 0 });
  run({ id: 71, params: antigo }, { w: 1080, h: 1080, tex: 't' });
  ok(Math.abs(pedido.u.uSize[0] - 1209) < 3, 'Size antigo em px é lido como % e não vira zoom de 12x', pedido.u.uSize[0]);
  ok(Math.abs(pedido.u.uPos[0] + 1830) < 4, 'Position antiga em px continua no lugar', pedido.u.uPos[0]);

  /* threshold invertido e texto inválido não quebram o shader */
  const q = Object.assign({}, p, { threshold: [0.9, 0.2], opacity: 'x', cellSize: 0, gamma: 0, inkCurve: null, blend: 'naoexiste' });
  pedido = null;
  run({ id: 8, params: q }, { w: 10, h: 10, tex: 't' });
  ok(pedido && pedido.u.uThrB > pedido.u.uThrA, 'threshold invertido é corrigido (A < B)', [pedido.u.uThrA, pedido.u.uThrB]);
  ok(pedido.u.uCell >= 1, 'cell size zero não gera divisão por zero');
  ok(pedido.u.uGamma >= 0.02, 'gamma zero é limitado');
  ok(pedido.extra.uCurveTex === 'lut-tex', 'curva ausente cai na padrão (LUT gerada mesmo assim)');
  ok(pedido.u.uMode >= 0, 'blend desconhecido cai em Normal');
  ok(run({ id: 9, params: p }, null) === null, 'sem imagem ligada devolve null (nada desenha)');

  /* com o atlas vazio o shader imprime o ponto (nunca folha em branco) */
  atlasVazio = 1;
  pedido = null;
  run({ id: 10, params: p }, { w: 64, h: 64, tex: 't' });
  ok(pedido && pedido.u.uFallback === 1, 'atlas vazio manda o fallback para o shader', pedido && pedido.u.uFallback);
}

/* ---------- integração com o editor ---------- */
ok(/if \(p\.hidden\) continue;/.test(html), 'o inspetor genérico respeita os parâmetros ocultos');
ok(/if \(n\.type === 'shapeHalftone'\) shPanel\(n, body\);/.test(html), 'o nó monta o próprio painel no inspetor');
ok(/shapeHalftone: \(n, ins\) => runShapeHalftone\(n, ins\[0\]\)/.test(html), 'o nó está no RUN do editor');
ok(!/ADD_SKIP|NODE_OCULTOS|tiposOcultos/.test(html), 'o nó não está numa lista de nós escondidos', 'lista');

/* as duas telas de escolha (Wheel e Gallery) listam o nó automaticamente */
{
  const wheel = funcao('renderAddList');
  ok(/for \(const \[id, def\] of Object\.entries\(NODE_TYPES\)\)/.test(wheel) || /Object\.entries\(NODE_TYPES\)/.test(wheel),
    'a roda percorre NODE_TYPES (o nó novo entra sozinho)');
  const gal = funcao('galFiltrados');
  ok(/Object\.entries\(NODE_TYPES\)/.test(gal), 'a galeria percorre NODE_TYPES (o nó novo entra sozinho)');
  const roda = funcao('galRoda');
  ok(/RUN\[tipo\]/.test(roda) && /return run\(n, nodeInputs\(n\)\.map/.test(roda), 'a galeria roda o nó de verdade na amostra');
  ok(/def\.cat === 'audio'/.test(roda), 'áudio fica fora da amostra');
  ok(RUN_TEST(), 'o Shape Halftone tem entrada de imagem (aparece com amostra)');
  function RUN_TEST() {
    const defTxt = recorta('  shapeHalftone: {', '  output: {');
    return /inputs: \['Image'\]/.test(defTxt);
  }
}

/* widgets próprios */
ok(/function shSwitch\(n, p\)/.test(html) && /classList\.toggle\('on', on\)/.test(html), 'interruptor (Show Source / Invert)');
ok(/function shCurveCtl\(n, p\)/.test(html) && /n\.ui\[p\.key\] = desenha;/.test(html), 'editor de curva bezier com redesenho');
ok(/function shRangeCtl\(n, p\)/.test(html) && /sh-rfill/.test(html), 'range duplo do threshold');
ok(/function shTravaProporcao\(n, corpo, refs\)/.test(html) && /n\.ui\.proporcao = \(\) =>/.test(html), 'cadeado de proporção do Size W/H');
ok(/classList\.toggle\('fold', fechado\)/.test(html) && /n\.shAberto\[titulo\] = !fechado;/.test(html), 'seções abrem e fecham (estado por nó)');
ok(/requestAnimationFrame\(desenha\);/.test(html), 'a curva se desenha depois do layout');
ok(/try \{ cv\.setPointerCapture\(e\.pointerId\); \} catch \(_\) \{\}/.test(html), 'arraste da curva à prova de navegador sem capture');

/* o painel não tranca a abertura: nada de trabalho pesado na montagem */
ok(!/for \(let i = 0; i < 4096/.test(recorta('function shPanel(n, body) {', '\n}\n')), 'shPanel só monta controles');


/* ---------- painel montado de verdade, com um DOM falso ---------- */
{
  const ctxFalso = () => ({
    setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillRect() {}, setLineDash() {}, fill() {}, arc() {},
    strokeStyle: '', fillStyle: '', lineWidth: 1,
  });
  const criaEl = tag => {
    const cl = {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) {
        if (on === undefined) { if (this._s.has(c)) this._s.delete(c); else this._s.add(c); }
        else if (on) this._s.add(c); else this._s.delete(c);
        return this._s.has(c);
      },
    };
    return {
      tag, className: '', textContent: '', title: '', type: '', width: 0, height: 0,
      children: [], dataset: {}, style: { setProperty() {}, cssText: '' },
      firstChild: null, _on: {}, classList: cl,
      append(...f) { for (const c of f) this.children.push(c); this.firstChild = this.children[0] || null; },
      prepend(...f) { this.children.unshift(...f); this.firstChild = this.children[0] || null; },
      addEventListener(t, f) { (this._on[t] = this._on[t] || []).push(f); },
      removeEventListener() {},
      setAttribute(k, v) { this['a_' + k] = v; },
      getBoundingClientRect() { return { width: 160, height: 92, left: 0, top: 0, right: 160, bottom: 92 }; },
      getContext() { return (this._g = this._g || ctxFalso()); },
      setPointerCapture() {}, releasePointerCapture() {}, closest() { return null; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      focus() {}, select() {}, blur() {}, remove() {},
      dispara(tipo, ev) { for (const f of (this._on[tipo] || [])) f(Object.assign({ stopPropagation() {}, preventDefault() {} }, ev || {})); },
    };
  };
  const docFalso = { createElement: tag => criaEl(tag) };
  const janelaFalsa = { devicePixelRatio: 1 };

  const paramsDef = [...recorta('  shapeHalftone: {', '  output: {').matchAll(/H(?:NUM|ENUM|COL|LOCK|SW|CURVE|RANGE)\('([a-zA-Z]+)'(?:, '[^']*')?(?:, ([^)]*))?\)/g)];
  const defs = {};
  for (const p of NODE_TYPES_TEST()) defs[p.key] = p;
  function NODE_TYPES_TEST() {
    const lista = [];
    const corpo = recorta('  shapeHalftone: {', '  output: {');
    const tipos = { NUM: 'num', ENUM: 'enum', COL: 'color', LOCK: 'lock', SW: 'switch', CURVE: 'curve', RANGE: 'range' };
    for (const m of corpo.matchAll(/H(NUM|ENUM|COL|LOCK|SW|CURVE|RANGE)\('([a-zA-Z]+)', '([^']*)'([^)]*)\)/g)) {
      const tipo = tipos[m[1]];
      const resto = m[4];
      const def = /,\s*(-?[\d.]+),\s*-?[\d.]+,?\s*$/.test(resto) ? Number(resto.match(/,\s*(-?[\d.]+),\s*-?[\d.]+/)[1]) : undefined;
      lista.push({ type: tipo, key: m[2], label: m[3], def });
    }
    return lista;
  }
  ok(Object.keys(defs).length === 33, 'painel com os 33 controles do inspector', Object.keys(defs).length);

  const criados = [];
  const celula = (n, p) => { const el = criaEl('div'); el.dataset.pkey = p.key; criados.push(p.key); return el; };
  const stubs = {
    E: (tag, cls, txt) => { const e = criaEl(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; },
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    makeSlider: celula, makeEnum: celula, makeColor: celula,
    makeLock: (n, p) => { const el = celula(n, p); n.ui[p.key] = () => {}; return el; },
    drawLinks() {}, markDirty() {}, requestRender() {}, commit() {}, selectFromControl() {},
    document: docFalso, window: janelaFalsa, requestAnimationFrame: f => { f(); return 1; },
  };
  const fonte = [funcao('shCurveBake'), funcao('shSwitch'), funcao('shCurveCtl'), funcao('shRangeCtl'),
    funcao('shTravaProporcao'), funcao('shPanel')].join('\n');
  const SH_SHAPES_T = [['dot', 'Dot'], ['square', 'Square'], ['diamond', 'Diamond'], ['triangle', 'Triangle'],
    ['lines', 'Lines'], ['arrows', 'Arrows'], ['smileys', 'Smileys'], ['stars', 'Stars'], ['plus', 'Plus'],
    ['ring', 'Ring'], ['hexagon', 'Hexagon'], ['grid', 'Grid'], ['waves', 'Waves'], ['heart', 'Heart'],
    ['ellipse', 'Ellipse'], ['solid', 'Solid']];
  const SH_SECOES_T = restaurarSecoes();
  function restaurarSecoes() {
    const bloco = recorta('const SH_SECOES = [', '];');
    return [...bloco.matchAll(/\['([A-Za-z ]+)', \[([^\]]*)\]\]/g)].map(m => [m[1], m[2].split(',').map(x => x.trim().replace(/'/g, ''))]);
  }
  const monta = new Function('E', 'clamp', 'makeSlider', 'makeEnum', 'makeColor', 'makeLock', 'drawLinks', 'markDirty',
    'requestRender', 'commit', 'selectFromControl', 'document', 'window', 'requestAnimationFrame',
    'NODE_TYPES', 'SH_SECOES', 'SH_SHAPES',
    fonte + '\nreturn shPanel;');
  const shPanel = monta(stubs.E, stubs.clamp, stubs.makeSlider, stubs.makeEnum, stubs.makeColor, stubs.makeLock,
    stubs.drawLinks, stubs.markDirty, stubs.requestRender, stubs.commit, stubs.selectFromControl,
    stubs.document, stubs.window, stubs.requestAnimationFrame,
    { shapeHalftone: { params: NODE_TYPES_TEST() } }, SH_SECOES_T, SH_SHAPES_T);

  const n = { id: 5, params: {}, ui: {}, shAberto: {}, el: null };
  for (const k in defs) n.params[k] = defs[k].def;
  n.params.inkCurve = [0.42, 0.06, 0.58, 0.94];
  n.params.threshold = [0.08, 0.92];
  for (const k of ['showSource', 'invert']) n.params[k] = 'nao';
  n.params.inkMode = 'additive';
  n.params.blend = 'normal';
  n.params.proporcao = 'locked';

  const body = criaEl('div');
  let erro = null;
  try { shPanel(n, body); } catch (e) { erro = e; }
  ok(!erro, 'shPanel monta o painel sem erro' + (erro ? ': ' + erro.message : ''));
  const secoes = body.children.filter(c => /sh-sec/.test(c.className));
  ok(secoes.length === 10, '10 seções no painel (Color saiu com o Paper)', secoes.length);
  const comChave = [];
  const conta = el => {
    if (!el) return;
    if (el.dataset && el.dataset.pkey) comChave.push(el.dataset.pkey);
    for (const c of (el.children || [])) conta(c);
  };
  conta(body);
  ok(comChave.length === 33, '33 controles no painel (um por parâmetro)', comChave.length);
  const repetido = comChave.filter((k, i) => comChave.indexOf(k) !== i);
  ok(repetido.length === 0, 'nenhum controle repetido', repetido.join(', '));
  const semUi = ['showSource', 'inkCurve', 'threshold', 'invert'].filter(k => typeof n.ui[k] !== 'function');
  ok(semUi.length === 0, 'os controles próprios registram refresh em n.ui', semUi.join(', '));

  /* seção abre e fecha */
  const secTransform = secoes[0];
  const cab = secTransform.children[0];
  cab.dispara('click');
  ok(secTransform.classList.contains('fold') && n.shAberto.Transform === false, 'clicar no título fecha a seção');
  cab.dispara('click');
  ok(!secTransform.classList.contains('fold') && n.shAberto.Transform === true, 'clicar de novo abre');

  /* interruptor Show Source */
  const linhaSw = body.children.map(() => null);
  const acha = chave => {
    let achado = null;
    const anda = el => {
      if (!el || achado) return;
      if (el.dataset && el.dataset.pkey === chave) { achado = el; return; }
      for (const c of (el.children || [])) anda(c);
    };
    anda(body);
    return achado;
  };
  const sw = acha('showSource');
  ok(!!sw && sw.className === 'prow', 'Show Source é uma linha com interruptor');
  const botaoSw = sw.children.find(c => /sh-sw/.test(c.className));
  ok(!!botaoSw, 'interruptor desenhado', 'sh-sw');
  botaoSw.dispara('click');
  ok(n.params.showSource === 'sim' && botaoSw.classList.contains('on'), 'clicar liga o Show Source');
  botaoSw.dispara('click');
  ok(n.params.showSource === 'nao' && !botaoSw.classList.contains('on'), 'clicar de novo desliga');

  /* range duplo */
  const rg = acha('threshold');
  ok(!!rg && rg.className === 'sh-range', 'Threshold Range é o trilho com duas alças');
  ok(rg.children.length === 3, 'trilho + preenchimento + 2 alças', rg.children.length);
  rg.dispara('pointerdown', { clientX: 60, pointerId: 1 });
  rg.dispara('pointermove', { clientX: 150 });
  rg.dispara('pointerup', {});
  ok(n.params.threshold[1] > 0.8, 'arrastar a alça direita sobe o limite', n.params.threshold);
  ok(n.params.threshold[0] < n.params.threshold[1], 'as alças não se cruzam', n.params.threshold);

  /* curva bezier */
  const cv = acha('inkCurve');
  ok(!!cv && cv.className === 'sh-curve', 'Ink Curve é o editor de curva');
  const canvas = cv.children[0];
  ok(!!canvas && canvas.width > 0 && canvas.height > 0, 'canvas da curva com tamanho (dpr)', [canvas.width, canvas.height]);
  canvas.dispara('pointerdown', { clientX: 120, clientY: 20, pointerId: 2 });
  canvas.dispara('pointermove', { clientX: 140, clientY: 10 });
  canvas.dispara('pointerup', {});
  ok(n.params.inkCurve[2] > 0.6, 'arrastar a alça direita move a curva', n.params.inkCurve);
  ok(n.params.inkCurve[0] <= n.params.inkCurve[2], 'as alças horizontais não se cruzam', n.params.inkCurve);

  /* cadeado de proporção */
  n.params.sizeW = 600; n.params.sizeH = 300;
  n.ui.proporcao();                               // gurada a proporção 1:2
  n.params.sizeW = 800;
  const alvoW = { closest: sel => (sel === '[data-pkey="sizeW"]' ? {} : null) };
  for (const f of (body._on.pointerup || [])) f({ target: alvoW, preventDefault() {}, stopPropagation() {} });
  ok(n.params.sizeH === 400, 'com o cadeado, H acompanha a proporção do W', [n.params.sizeW, n.params.sizeH]);
  n.params.proporcao = 'free';
  n.params.sizeW = 100;
  for (const f of (body._on.pointerup || [])) f({ target: alvoW, preventDefault() {}, stopPropagation() {} });
  ok(n.params.sizeH === 400, 'solto, o H não mexe mais', n.params.sizeH);
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
