/* Gradient map: quantidade de cores (2 a 8), pinos do mesh, categoria e controles por modo. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

/* bloco real das cores/pinos (helpers + visibilidade) */
const lib = new Function(
  extrai('const GP_MAX_CORES = 8;', 'function makeGradientPins') +
  '\nreturn { GP_MAX_CORES, gpContagem, gpCorHex, gpCoresDe, gpPinosPadrao, gpPinosDe, gradAplicaVis };'
)();
const { GP_MAX_CORES, gpContagem, gpCorHex, gpCoresDe, gpPinosDe, gradAplicaVis } = lib;

console.log('gradient map · cores e pinos');

/* ---------- quantidade de cores ---------- */
ok(GP_MAX_CORES === 8, 'máximo de 8 cores', GP_MAX_CORES);
ok(gpContagem({}) === 4, 'sem escolha, 4 cores', gpContagem({}));
ok(gpContagem({ colorCount: '2' }) === 2, 'aceita 2 cores');
ok(gpContagem({ colorCount: '8' }) === 8, 'aceita 8 cores');
ok(gpContagem({ colorCount: '1' }) === 2, 'menos que 2 não desce', gpContagem({ colorCount: '1' }));
ok(gpContagem({ colorCount: '99' }) === 8, 'mais que 8 não passa', gpContagem({ colorCount: '99' }));

/* ---------- cores ---------- */
{
  const p = { color1: '#111111', color2: '#222222', color3: '#333333', color4: '#444444', color5: '#555555', color6: '#666666' };
  ok(gpCoresDe(p, 2).join(',') === '#111111,#222222', '2 cores usa as duas primeiras', gpCoresDe(p, 2).join(','));
  ok(gpCoresDe(p, 6).length === 6 && gpCoresDe(p, 6)[5] === '#666666', '6 cores usa até a sexta', gpCoresDe(p, 6).join(','));
  ok(gpCorHex(p, 0, 4) === '#111111' && gpCorHex(p, 3, 4) === '#444444', 'índice da cor casa com o pino');
}

/* ---------- pinos para N cores ---------- */
const padrao4 = gpPinosDe('', 4);
ok(padrao4.length === 4, 'quatro pinos com 4 cores', padrao4.length);
ok(JSON.stringify(padrao4) === JSON.stringify([[0, 0], [1, 0], [1, 1], [0, 1]]), '4 cores = os quatro cantos (como antes)', padrao4);
ok(gpPinosDe('', 2).length === 2, '2 cores = 2 pinos');
ok(gpPinosDe('', 6).length === 6, '6 cores = 6 pinos');
ok(gpPinosDe('', 8).length === 8, '8 cores = 8 pinos');
ok(gpPinosDe('', 6).every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1), 'pinos padrão dentro do quadro');

{
  const salvos = JSON.stringify([{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.8 }, { x: 0.5, y: 0.5 }, { x: 0.3, y: 0.7 }]);
  const p = gpPinosDe(salvos, 4);
  ok(Math.abs(p[0][0] - 0.1) < 1e-9 && Math.abs(p[3][1] - 0.7) < 1e-9, 'lê os pinos salvos na posição certa', p);
  ok(gpPinosDe(salvos, 2).length === 2, 'projeto antigo com 4 pinos abre com 2 cores sem quebrar');
  ok(gpPinosDe(salvos, 6).length === 6, 'subir para 6 cores completa os pinos que faltam', gpPinosDe(salvos, 6).length);
}

ok(gpPinosDe('lixo', 5).length === 5, 'JSON inválido não quebra: usa o padrão');
ok(gpPinosDe(JSON.stringify([{ x: -3, y: 9 }]), 2)[0][0] === 0, 'prende dentro do quadro (0..1)');
ok(gpPinosDe(JSON.stringify([{ x: '0.4', y: '0.6' }]), 2)[0][0] === 0.4, 'aceita número em texto');

/* ---------- controles por modo e por quantidade ---------- */
function painel(extra) {
  const chaves = ['mapType', 'colorCount', 'color1', 'color2', 'color3', 'color4', 'color5', 'color6', 'color7', 'color8',
    'midpoint', 'angle', 'centerX', 'centerY', 'scale', 'meshWarp', 'spatialMix', 'contrast', 'dither', 'gpins', 'gpReset'];
  const els = chaves.map(k => ({ dataset: { pkey: k }, style: {} }));
  return { raiz: { querySelectorAll: () => els }, pega: k => els.find(e => e.dataset.pkey === k), params: extra };
}

{
  const { raiz, pega, params } = painel({ mapType: 'mesh', colorCount: '4' });
  gradAplicaVis(raiz, params);
  for (const k of ['midpoint', 'angle', 'centerX', 'centerY', 'scale', 'spatialMix', 'dither']) {
    ok(pega(k).style.display === 'none', `no Mesh "${k}" fica escondido`, pega(k).style.display);
  }
  ok(pega('gpins').style.display === '', 'no Mesh os pinos aparecem');
  ok(pega('meshWarp').style.display === undefined, 'Mesh distortion continua visível');
  ok(pega('contrast').style.display === undefined, 'Mask contrast continua visível');
  ok(pega('color4').style.display === '' && pega('color5').style.display === 'none', 'com 4 cores, a 5ª fica escondida');
}

{
  const { raiz, pega, params } = painel({ mapType: 'linear', colorCount: '6' });
  gradAplicaVis(raiz, params);
  ok(pega('midpoint').style.display === '', 'no Linear o midpoint volta');
  ok(pega('dither').style.display === '', 'no Linear o dithering volta');
  ok(pega('gpins').style.display === 'none', 'fora do Mesh os pinos somem');
  ok(pega('color6').style.display === '' && pega('color7').style.display === 'none', 'com 6 cores, a 7ª fica escondida');
}

{
  const { raiz, pega, params } = painel({ mapType: 'mesh', colorCount: '2' });
  gradAplicaVis(raiz, params);
  ok(pega('color2').style.display === '' && pega('color3').style.display === 'none', 'com 2 cores só aparecem duas');
}

/* ---------- shader ---------- */
{
  const ini = html.indexOf('gradientMap: `');
  const shader = html.slice(ini, html.indexOf('`,\n', ini));
  ok(/uniform vec3 uC1, uC2, uC3, uC4, uC5, uC6, uC7, uC8;/.test(shader), 'shader recebe até 8 cores em uniformes soltos');
  ok(/uniform vec2 uQ1, uQ2, uQ3, uQ4, uQ5, uQ6, uQ7, uQ8;/.test(shader), 'shader recebe até 8 pinos em uniformes soltos');
  ok(!/uCols\[|uPins\[/.test(shader), 'sem array de uniforme (não depende de localizar elemento)');
  ok(/uniform float uGpCount;/.test(shader), 'shader sabe quantas cores estão em uso');
  ok(/clamp\(uGpCount, 1\.0, 8\.0\)/.test(shader), 'contagem nunca é zero (senão a saída fica preta)');
  ok(/vec3 gpCor\(int i\)/.test(shader) && /vec2 gpPin\(int i\)/.test(shader), 'cor e pino da posição i por cadeia de if');
  ok(/if \(float\(i\) >= cnt\) break;/.test(shader), 'o mesh percorre só as cores escolhidas');
  ok(/float xf = tc \* \(cnt - 1\.0\)/.test(shader), 'a rampa usa todas as cores igualmente espaçadas');
  ok(/vec2 cp = vec2\(pix\.x, uRes\.y - 1\.0 - pix\.y\);/.test(shader), 'eixo Y convertido (sem espelhar)');
  {
    /* cuidado: spatialAt() também tem um "if (uType == 3)"; o ramo do Mesh é o último antes do else */
    const fim = shader.indexOf('} else {');
    const mesh = shader.slice(shader.lastIndexOf('if (uType == 3) {', fim), fim);
    ok(mesh.length > 200, 'ramo do Mesh encontrado', mesh.length);
    ok(!/hash\(|uDither/.test(mesh), 'Mesh sem dithering');
  }
  ok(/if \(uDither > 0\.0\) t = clamp\(t \+/.test(shader), 'modos de rampa continuam com dithering');
  ok(!/uCount/.test(shader), 'não usa o nome "uCount" (é um uniforme inteiro de outro nó)');
}

/* ---------- ligação com o render ---------- */
ok(/uni\['uC' \+ \(i \+ 1\)\] = hexRGB/.test(html), 'render envia as cores como uC1..uC8');
ok(/uni\['uQ' \+ \(i \+ 1\)\] = \[q\[0\], q\[1\]\]/.test(html), 'render envia os pinos como uQ1..uQ8');
ok(/uGpCount: nCores/.test(html), 'render envia a contagem');
ok(/if \(type !== 3\) uni\.uDither/.test(html), 'render ignora o dithering no Mesh');
ok(/const nCores = gpContagem\(p\);/.test(html), 'render respeita a quantidade escolhida');
ok(/\^color\[1-8\]\$/.test(html), 'prévia dos pinos acompanha as cores 1..8');
ok(/title: 'Gradient map', cat: 'input'/.test(html), 'Gradient map fica na categoria Input (não em Color)');
ok(/ENUM\('colorCount', 'Colors'/.test(html), 'existe o seletor de quantidade de cores');
ok(/COL\('color5'/.test(html) && /COL\('color8'/.test(html), 'existem as cores 5 a 8');
ok(/name \+ '\[0\]'/.test(html), 'localização de uniforme em array tem fallback (driver antigo)');
{
  /* o upload usa gl.uniform1i para os nomes de INT_UNIFORMS: um uniforme float
     com nome de lá fica sempre 0 — foi o que deixou o nó preto. */
  const ints = html.slice(html.indexOf('const INT_UNIFORMS'), html.indexOf('function draw('));
  const nomes = [...ints.matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1]);
  ok(nomes.length > 10, 'lista de uniformes inteiros encontrada', nomes.length);
  for (const n of ['uGpCount', 'uC1', 'uC8', 'uQ1', 'uQ8', 'uMid', 'uMeshWarp', 'uDither']) {
    ok(!nomes.includes(n), `"${n}" (float/vetor) não pode estar em INT_UNIFORMS`);
  }
  ok(nomes.includes('uType'), 'uType continua inteiro');
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
