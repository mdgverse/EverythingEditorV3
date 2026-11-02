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

const tudo = resumo();
process.exit(tudo ? 0 : 1);
