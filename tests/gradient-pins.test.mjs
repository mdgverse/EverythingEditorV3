/* Gradient map: quantidade de cores (2 a 8), pinos do mesh e controles por modo. */
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
  for (const k of ['midpoint', 'angle', 'centerX', 'centerY', 'scale', 'spatialMix']) {
    ok(pega(k).style.display === 'none', `no Mesh "${k}" fica escondido`, pega(k).style.display);
  }
  ok(pega('gpins').style.display === '', 'no Mesh os pinos aparecem');
  ok(pega('meshWarp').style.display === undefined, 'Mesh distortion continua visível');
  ok(pega('dither').style.display === undefined, 'Dithering continua visível');
  ok(pega('color4').style.display === '' && pega('color5').style.display === 'none', 'com 4 cores, a 5ª fica escondida');
}

{
  const { raiz, pega, params } = painel({ mapType: 'linear', colorCount: '6' });
  gradAplicaVis(raiz, params);
  ok(pega('midpoint').style.display === '', 'no Linear o midpoint volta');
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
  ok(/uniform vec3 uCols\[8\];/.test(shader), 'shader guarda até 8 cores');
  ok(/uniform vec2 uPins\[8\];/.test(shader), 'shader guarda até 8 pinos');
  ok(/uniform float uCount;/.test(shader), 'shader sabe quantas cores estão em uso');
  ok(/for \(int i = 0; i < 8; i\+\+\)/.test(shader) && /if \(float\(i\) >= uCount\) break;/.test(shader), 'o mesh percorre só as cores escolhidas');
  ok(/uCount - 1\.0/.test(shader), 'a rampa usa todas as cores igualmente espaçadas');
  ok(/vec2 cp = vec2\(pix\.x, uRes\.y - 1\.0 - pix\.y\);/.test(shader), 'eixo Y convertido (sem espelhar)');
  ok(/uDither/.test(shader), 'dithering ativo');
  ok(!/uC1/.test(shader), 'não usa mais as quatro cores fixas');
}

/* ---------- ligação com o render ---------- */
ok(/uCount: nCores, uCols: coresFlat, uPins: pinsFlat/.test(html), 'render envia contagem, cores e pinos');
ok(/const nCores = gpContagem\(p\);/.test(html), 'render respeita a quantidade escolhida');
ok(/ENUM\('colorCount', 'Colors'/.test(html), 'existe o seletor de quantidade de cores');
ok(/COL\('color5'/.test(html) && /COL\('color8'/.test(html), 'existem as cores 5 a 8');

const tudo = resumo();
process.exit(tudo ? 0 : 1);
