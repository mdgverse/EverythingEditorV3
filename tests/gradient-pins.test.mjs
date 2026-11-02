/* Gradient map: os quatro pinos do mesh (um por cor). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

const gpPinosDe = new Function(extrai('function gpPinosDe(raw) {', 'function gradAplicaVis') + '\nreturn gpPinosDe;')();

console.log('gradient map · pinos do mesh');

ok(typeof gpPinosDe === 'function', 'gpPinosDe existe');

const padrao = gpPinosDe('');
ok(padrao.length === 4, 'sempre quatro pinos', padrao.length);
ok(JSON.stringify(padrao) === JSON.stringify([[0, 0], [1, 0], [1, 1], [0, 1]]), 'padrão = quatro cantos (1 TL, 2 TR, 3 BR, 4 BL)', padrao);

const meu = gpPinosDe(JSON.stringify([{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.8 }, { x: 0.5, y: 0.5 }, { x: 0.3, y: 0.7 }]));
ok(Math.abs(meu[0][0] - 0.1) < 1e-9 && Math.abs(meu[3][1] - 0.7) < 1e-9, 'lê os pinos salvos na posição certa', meu);

const fora = gpPinosDe(JSON.stringify([{ x: -3, y: 9 }, { x: 2, y: -1 }]));
ok(fora[0][0] === 0 && fora[0][1] === 1, 'prende dentro do quadro (0..1)', fora[0]);
ok(fora[2][0] === 1 && fora[2][1] === 1, 'pino ausente volta ao canto dele', fora[2]);
ok(gpPinosDe('lixo').length === 4, 'JSON inválido não quebra: volta ao padrão');
ok(gpPinosDe(JSON.stringify([{ x: '0.4', y: '0.6' }]))[0][0] === 0.4, 'aceita número em texto');

ok(html.includes('uniform vec2 uP1, uP2, uP3, uP4;'), 'shader declara os quatro pinos');
ok(/uP1: gpp\[0\], uP2: gpp\[1\], uP3: gpp\[2\], uP4: gpp\[3\]/.test(html), 'render envia os pinos para o shader');
ok(/distance\(pp, uP1\)/.test(html), 'mesh mistura as cores pela distância até o pino');
ok(/gpResetPins/.test(html), 'botão Reset pins ligado');
ok(html.includes("COL('color1', 'Shadow / pin 1'"), 'cada cor tem o número do pino no nome');

/* ---------- controles que somem no modo Mesh ---------- */
const gradAplicaVis = new Function(extrai('function gradAplicaVis(raiz, params) {', 'function makeGradientPins') + '\nreturn gradAplicaVis;')();

function painel(mapType) {
  const chaves = ['color1', 'midpoint', 'angle', 'centerX', 'centerY', 'scale', 'meshWarp', 'spatialMix', 'contrast', 'dither', 'gpins', 'gpReset'];
  const els = chaves.map(k => ({ dataset: { pkey: k }, style: {} }));
  return { els, raiz: { querySelectorAll: () => els }, pega: k => els.find(e => e.dataset.pkey === k) };
}

{
  const { raiz, pega } = painel('mesh');
  gradAplicaVis(raiz, { mapType: 'mesh' });
  for (const k of ['midpoint', 'angle', 'centerX', 'centerY', 'scale', 'spatialMix']) {
    ok(pega(k).style.display === 'none', `no Mesh "${k}" fica escondido`, pega(k).style.display);
  }
  ok(pega('gpins').style.display === '', 'no Mesh os pinos aparecem');
  ok(pega('gpReset').style.display === '', 'no Mesh o Reset pins aparece');
  ok(pega('meshWarp').style.display === undefined, 'Mesh distortion continua visível');
  ok(pega('dither').style.display === undefined, 'Dithering continua visível');
}

{
  const { raiz, pega } = painel('linear');
  gradAplicaVis(raiz, { mapType: 'linear' });
  for (const k of ['midpoint', 'angle', 'centerX', 'centerY', 'scale', 'spatialMix']) {
    ok(pega(k).style.display === '', `no Linear "${k}" volta a aparecer`, pega(k).style.display);
  }
  ok(pega('gpins').style.display === 'none', 'fora do Mesh os pinos somem');
}

/* ---------- orientação e dithering no shader ---------- */
{
  /* o shader do Gradient map (e não outro nó que também usa uType == 3) */
  const ini = html.indexOf('gradientMap: `');
  const trecho = html.slice(ini, html.indexOf('`,' + String.fromCharCode(10), ini) > ini ? html.indexOf('`,' + String.fromCharCode(10), ini) : ini + 4000);
  ok(/vec2 cp = vec2\(pix\.x, uRes\.y - 1\.0 - pix\.y\);/.test(trecho), 'mesh converte a linha para origem no topo (sem espelhar)');
  ok(!/canvasPix\(\)/.test(trecho), 'não depende de canvasPix() (este shader não inclui FX4_COMMON)');
  ok(!/vec2 pp = vec2\(clamp\(pix\.x \/ max\(1\.0, uRes\.x - 1\.0\)/.test(trecho), 'não usa mais o eixo Y invertido do vUv');
  ok(/uDither/.test(trecho), 'o dithering entra no modo mesh');
  ok(/hash\(pix\.x \+ 13\.0, pix\.y - 7\.0\)/.test(trecho), 'dithering mexe na posição da mistura');
  ok(/col = clamp\(col \+ \(hash\(pix\.x \+ 31\.0/.test(trecho), 'dithering também quebra a banda na cor final');
}

/* a prévia do editor usa a mesma origem (y para baixo a partir do topo) */
ok(/const px = x \/ \(N - 1\), py = y \/ \(N - 1\)/.test(html), 'prévia dos pinos desenha de cima para baixo (combina com o shader)');

/* quinas voltaram ao simples: sem Alt+clique nem duplo clique */
ok(!/Corner removed \(Alt\+click\)/.test(html), 'nada de Alt+clique na quina');
ok(!/linksEl\.addEventListener\('dblclick'/.test(html), 'nada de duplo clique na quina');
ok(html.includes('Alt + drag across wires: zip tie · Wheel: zoom'), 'Alt+arrastar segue sendo zip tie');

const tudo = resumo();
process.exit(tudo ? 0 : 1);
