/* CRT Screen (1.2.0): parâmetros em categorias recolhíveis, interruptor
   individual por parâmetro (crtOff; ausente = ligado) e loop otimizado
   com saída idêntica à implementação original. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extrai = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim, a);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};
const funcao = nome => {
  const a = html.indexOf('function ' + nome + '(');
  if (a < 0) throw new Error('função não encontrada: ' + nome);
  let i = html.indexOf('{', a), prof = 0, j = i;
  for (; j < html.length; j++) {
    if (html[j] === '{') prof++;
    else if (html[j] === '}') { prof--; if (!prof) { j++; break; } }
  }
  return html.slice(a, j);
};

/* --- definições reais do nó (avaliadas com os helpers de verdade) --- */
const NUM = (key, label, min, max, def, step = 1) => ({ type: 'num', key, label, min, max, def, step });
const ENUM = (key, label, options, def) => ({ type: 'enum', key, label, options, def });
const SEC = (key, label, tip, closed) => ({ type: 'sec', key, label, tip, closed: !!closed });
const blocoNo = extrai("  crtScreen: {\n    title: 'CRT screen'", '  glassStudio: {').replace(/^\s*crtScreen:\s*/, '').replace(/,\s*$/, '');
const noDef = new Function('NUM', 'ENUM', 'SEC', 'return (' + blocoNo + ')')(NUM, ENUM, SEC);
const defs = noDef.params.filter(d => d.type !== 'sec');
const secs = noDef.params.filter(d => d.type === 'sec');
const padroes = {};
for (const d of defs) padroes[d.key] = d.def;

/* --- bloco puro de ativações --- */
const puro = extrai('/* CRT_PURO_INI */', '/* CRT_PURO_FIM */');
const P = new Function(puro + '\nreturn { CRT_GRUPOS, CRT_KEYS, CRT_NEUTRO, crtParamAtivo, crtEffectiveParams, crtAplicarDefaults };')();
const { CRT_GRUPOS, CRT_KEYS, CRT_NEUTRO, crtParamAtivo, crtEffectiveParams, crtAplicarDefaults } = P;

console.log('CRT Screen · parâmetros e categorias');

/* 1. nó novo: defaults visuais atuais + tudo ligado */
ok(defs.length === 24, 'os 24 parâmetros existentes continuam lá', defs.length);
ok(padroes.style === 'color' && padroes.curvature === 26 && padroes.scanlines === 58 && padroes.grille === 62 &&
   padroes.phosphor === 34 && padroes.chroma === 3.5 && padroes.glow === 34 && padroes.mix === 100 && padroes.seed === 4,
  'valores padrão visuais não mudaram');
const efetivosNovo = crtEffectiveParams({ ...padroes });
ok(JSON.stringify(efetivosNovo) === JSON.stringify({ ...padroes }), 'nó novo (sem crtOff) renderiza com os defaults intactos');
ok(defs.every(d => crtParamAtivo({ ...padroes }, d.key)), 'nó novo inicia com todos os parâmetros ativados');

/* categorias: cobrem cada parâmetro uma única vez, na ordem das seções */
const chavesGrupos = CRT_GRUPOS.flatMap(g => g[1]);
ok(JSON.stringify([...chavesGrupos].sort()) === JSON.stringify(defs.map(d => d.key).sort()), 'categorias cobrem todos os parâmetros exatamente uma vez');
ok(JSON.stringify(CRT_GRUPOS.map(g => g[0])) === JSON.stringify(secs.map(d => d.key)), 'grupos do bloco puro batem com as seções do painel');
ok(secs.length === 6 && secs.every(d => d.closed), 'todas as categorias nascem recolhidas (closed)');
ok(/gravado === null && p\.closed/.test(html), 'buildSection respeita o padrão recolhido só na primeira abertura (depois vale a escolha do usuário)');
ok(JSON.stringify(Object.keys(CRT_NEUTRO).sort()) === JSON.stringify([...CRT_KEYS].sort()), 'todo parâmetro tem um valor neutro definido');

console.log('CRT Screen · interruptores individuais');

/* 2/3. independência e preservação de valores */
const salvo = { ...padroes, scanlines: 77, crtOff: { scanlines: false } };
const antes = JSON.stringify(salvo);
const ef = crtEffectiveParams(salvo);
ok(ef.scanlines === 0 && salvo.scanlines === 77 && JSON.stringify(salvo) === antes,
  'desligar neutraliza no render sem zerar o valor salvo nem tocar nos parâmetros');
ok(ef.grille === padroes.grille && ef.curvature === padroes.curvature && crtParamAtivo(salvo, 'grille'),
  'desligar um parâmetro não desliga os demais');
const todosOff = { ...padroes, crtOff: Object.fromEntries(CRT_KEYS.map(k => [k, false])) };
ok(CRT_KEYS.every(k => !crtParamAtivo(todosOff, k)), 'cada parâmetro pode ser desligado independentemente');
ok(crtEffectiveParams(todosOff).brightness === 0 && crtEffectiveParams(todosOff).contrast === 0,
  'brilho/contraste desligados viram neutros (0), não os defaults');
ok(crtEffectiveParams(todosOff).mix === 100 && crtEffectiveParams(todosOff).style === 'color' &&
   crtEffectiveParams(todosOff).grilleMode === 'aperture' && crtEffectiveParams(todosOff).seed === 4,
  'mix/style/modo/seed desligados voltam ao comportamento neutro');

/* 4. projeto antigo sem flags = comportamento de antes */
const antigo = { ...padroes, scanlines: 90 };
ok(crtEffectiveParams(antigo).scanlines === 90 && CRT_KEYS.every(k => crtParamAtivo(antigo, k)),
  'projeto antigo sem crtOff funciona como antes (tudo ligado)');
ok(/type === 'crtScreen' && \(!n\.params\.crtOff/.test(html), 'createNode normaliza crtOff ao abrir projetos antigos');

/* 5. salvar e reabrir preserva valores e interruptores */
const rodada = JSON.parse(JSON.stringify(salvo));
ok(rodada.scanlines === 77 && rodada.crtOff.scanlines === false && crtEffectiveParams(rodada).scanlines === 0,
  'salvar/reabrir preserva valores e estados dos interruptores');

/* reset: defaults + tudo ligado */
const baguncado = { ...padroes, scanlines: 1, glow: 99, crtOff: { glow: false, seed: false } };
crtAplicarDefaults(baguncado, noDef.params);
ok(baguncado.scanlines === padroes.scanlines && baguncado.glow === padroes.glow && Object.keys(baguncado.crtOff).length === 0,
  'reset restaura os defaults e reativa todos os parâmetros');

ok(/crtAplicarDefaults\(n\.params, NODE_TYPES\.crtScreen\.params\)/.test(html), 'o botão Reset do painel aplica os defaults e reativa tudo');

/* interface: interruptor por controle, sem reconstruir o nó */
ok(/n\.type === 'crtScreen'\) el = crtParamRow\(n, p, el\)/.test(html), 'buildControls adiciona o interruptor em cada controle do CRT');
ok(/cb\.addEventListener\('change'/.test(extrai('function crtParamRow', 'function buildControls')) &&
   /markDirty\(n\.id\); requestRender\(\); commit\(\)/.test(extrai('function crtParamRow', 'function buildControls')),
  'alternar o interruptor invalida só o nó e agenda um render (sem reconstruir o grafo)');

console.log('CRT Screen · renderização');

/* --- fx12CRT de verdade, com canvas stub (mesma fonte do benchmark) --- */
function makeCtx(canvas) {
  return {
    filter: 'none',
    clearRect() { canvas._data.fill(0); },
    drawImage(src) { canvas._data.set(src._data); },
    getImageData(x, y, W, H) { return { data: canvas._data, width: W, height: H }; },
    createImageData(W, H) { return { data: new Uint8ClampedArray(W * H * 4), width: W, height: H }; },
    putImageData(img) { canvas._out = img; },
  };
}
function fx7NewCanvas(W, H) {
  const c = { width: W, height: H, _data: new Uint8ClampedArray(W * H * 4), _out: null };
  c.getContext = () => (c._ctx ||= makeCtx(c));
  return c;
}
const mundo = new Function([
  'const clamp = (v, a, b) => Math.min(b, Math.max(a, v));',
  'const clamp01 = v => Math.min(1, Math.max(0, v));',
  funcao('fx5Luma255'), funcao('fx6Hash'), funcao('fx9Smooth'), funcao('fx9Mix'), funcao('fx7Idx'),
  'const makeCtx = ' + makeCtx.toString() + ';',
  'const fx7NewCanvas = ' + fx7NewCanvas.toString() + ';',
  puro, funcao('crtScratch'), funcao('fx12CRT'),
  'return { fx12CRT };',
].join('\n'))();

const W = 64, H = 48;
function fonte() {
  const c = fx7NewCanvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    c._data[i] = (x * 7 + y * 3) % 256;
    c._data[i + 1] = (x * 2 + y * 11) % 256;
    c._data[i + 2] = (x * 5 + y * 5) % 256;
    c._data[i + 3] = (x % 97 === 0) ? 128 : 255;
  }
  return c;
}
const hash = d => { let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0; return h; };
const roda = params => mundo.fx12CRT(fonte(), W, H, { ...params }, {})._out.data;

/* 7. saída preservada (hashes dourados da implementação equivalente à original) */
ok(hash(roda(padroes)) === 4152911213, 'saída com os defaults é byte a byte a de antes da otimização');
const TUDO = { ...padroes, rainbow: 60, overdrive: 55, sparkle: 45, streaks: 50, grilleMode: 'dots', grilleSize: 3, glow: 60, noise: 30, glitch: 40, roll: 30 };
ok(hash(roda(TUDO)) === 2227496475, 'saída com todos os recursos ligados também é idêntica');
const outDef = roda(padroes);
ok(outDef.length === W * H * 4, 'dimensões e alfa preservados (RGBA completo)');

/* desligar pelo interruptor = mesmo resultado que o valor neutro explícito */
const viaToggle = roda({ ...padroes, crtOff: { scanlines: false, grille: false, curvature: false, glow: false } });
const viaNeutro = roda({ ...padroes, scanlines: 0, grille: 0, curvature: 0, glow: 0 });
ok(Buffer.from(viaToggle).equals(Buffer.from(viaNeutro)), 'interruptor desligado produz exatamente o parâmetro neutro');
const religado = roda({ ...padroes, crtOff: {} });
ok(Buffer.from(religado).equals(Buffer.from(outDef)), 'religar todos volta ao resultado original, sem salto');

/* otimização aplicada de verdade */
ok(/fx12CRT\(s, W, H, n\.params, n\.runtime\)/.test(html), 'RUN reutiliza os buffers do runtime do nó');
ok(/function crtScratch/.test(html) && /cache\._crt/.test(html), 'canvas/ImageData/tabelas são reutilizados entre renders');
ok(!/const sample = \(sx, sy, ch\)/.test(extrai('function fx12CRT', '/* fx13 */')), 'amostragem por pixel não chama mais fx7Idx');

process.exit(resumo() ? 0 : 1);
