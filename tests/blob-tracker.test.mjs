/* Blob Tracker (1.6.0): detecção pura em imagens sintéticas (componentes
   conexos, Merge, filtro de tamanho relativo, Max Blobs, IDs estáveis) +
   o painel fiel aos screenshots de referência (Dasca "Blob Track"). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extrai = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim, a);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

const NUM = (key, label, min, max, def, step = 1) => ({ type: 'num', key, label, min, max, def, step });
const ENUM = (key, label, options, def) => ({ type: 'enum', key, label, options, def });
const COL = (key, label, def) => ({ type: 'color', key, label, def });
const SEC = (key, label, tip, closed) => ({ type: 'sec', key, label, tip, closed: !!closed });
const blocoNo = extrai("  blobTracker: {\n    title: 'Blob Tracker'", '  glassStudio: {').replace(/^\s*blobTracker:\s*/, '').replace(/,\s*$/, '');
const noDef = new Function('NUM', 'ENUM', 'COL', 'SEC', 'return (' + blocoNo + ')')(NUM, ENUM, COL, SEC);
const defs = noDef.params.filter(d => d.type !== 'sec');
const por = Object.fromEntries(defs.map(d => [d.key, d]));

console.log('Blob Tracker · painel (screenshots de referência)');

ok(noDef.title === 'Blob Tracker' && JSON.stringify(noDef.inputs) === JSON.stringify(['Image']), 'nó Blob Tracker, socket Image');
ok(por.track.def === 'details' && por.track.options[0][0] === 'details', 'Track: Details (valor visível na referência)');
ok(por.sensitivity.def === 0.51 && por.softness.def === 0.8 && por.merge.def === 0.13, 'Sensitivity 0.51 · Softness 0.80 · Merge 0.13');
ok(por.minSize.def === 0.03 && por.maxSize.def === 0.35 && por.maxBlobs.def === 208, 'Min Size 0.030 · Max Size 0.35 · Max Blobs 208');
ok(por.fineTune.def === 'no', 'Fine Tune desligado por padrão');
ok(por.lineWidth.def === 1.5 && por.padding.def === 0.1 && por.colors.def === 'single' && por.color.def === '#FFFFFF',
  'Line Width 1.5 · Padding 0.10 · Colors Single · Color #FFFFFF');
ok(por.centerMark.def === 'none' && por.inside.def === 'original' && por.dimOutside.def === 0, 'Center Mark None · Inside Original · Dim Outside 0.00');
ok(por.labels.def === 'yes' && por.text.def === 'id' && por.placement.def === 'above' && por.textSize.def === 12 && por.tagBg.def === 'no',
  'Labels ligado · Text ID · Placement Above · Text Size 12 · Tag Background desligado');
ok(por.connections.def === 'yes' && por.connect.def === 'chain' && por.line.def === 'solid' && por.lineOpacity.def === 0.6,
  'Connections ligado · Connect Chain · Line Solid · Line Opacity 0.60');
ok(por.labelColor.def === '#FFFFFF' && por.shapeColor.def === '#FFFFFF' && por.bgColor.def === '#000000'
  && por.lineColor.def === '#FFFFFF' && por.junctionColor.def === '#FFFFFF' && por.arrowColor.def === '#FFFFFF',
  'cores: Label/Shape/Line/Junction/Arrow #FFFFFF, Background #000000');
ok(noDef.params.filter(d => d.type === 'sec').length === 5, '5 seções: Detection, Visualization, Labels, Connections, Colors');

console.log('Blob Tracker · detecção');

const puro = extrai('/* BLOB_PURO_INI */', '/* BLOB_PURO_FIM */');
const P = new Function(puro + '\nreturn { blobAnalisar, blobAtribuirIds };')();

function cena(w, h, retangulos, fundo = 0, frente = 255) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = fundo; d[i * 4 + 1] = fundo; d[i * 4 + 2] = fundo; d[i * 4 + 3] = 255; }
  for (const [x0, y0, x1, y1] of retangulos) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * 4; d[i] = frente; d[i + 1] = frente; d[i + 2] = frente;
  }
  return d;
}
const base = { sensitivity: 0.51, softness: 0, merge: 0, minSize: 0.001, maxSize: 1, maxBlobs: 208 };
const W = 100, H = 80;

const dois = P.blobAnalisar(cena(W, H, [[10, 10, 29, 29], [60, 40, 84, 64]]), W, H, base);
ok(dois.length === 2, 'detecta duas regiões distintas', dois.length);
ok(Math.abs(dois[0].cx - 19.5) < 1 && Math.abs(dois[0].frac - 400 / 8000) < 0.001, 'centróide e tamanho relativo (área ÷ quadro) corretos');
ok(dois.every(b => b.poly.length >= 8), 'cada blob tem contorno (polígono de borda)');

ok(P.blobAnalisar(cena(W, H, []), W, H, base).length === 0, 'quadro vazio: nenhum blob, sem erro');
ok(P.blobAnalisar(cena(W, H, [[10, 10, 29, 29]]), W, H, { ...base, minSize: 0.2 }).length === 0,
  'Min Size filtra região pequena demais');
ok(P.blobAnalisar(cena(W, H, [[10, 10, 69, 59]]), W, H, { ...base, maxSize: 0.35 }).length === 0
  && P.blobAnalisar(cena(W, H, [[10, 10, 69, 59]]), W, H, { ...base, maxSize: 1 }).length === 1,
  'Max Size filtra região grande demais (0,375 do quadro > 0,35)');
const muitos = P.blobAnalisar(cena(W, H, [[2, 2, 9, 9], [20, 2, 27, 9], [40, 2, 47, 9], [60, 2, 67, 9], [80, 2, 87, 9]]), W, H, { ...base, maxBlobs: 3 });
ok(muitos.length === 3, 'Max Blobs limita a quantidade exibida', muitos.length);
const juntos = P.blobAnalisar(cena(W, H, [[10, 10, 24, 24], [28, 10, 42, 24]]), W, H, { ...base, merge: 0 });
const unidos = P.blobAnalisar(cena(W, H, [[10, 10, 24, 24], [28, 10, 42, 24]]), W, H, { ...base, merge: 1 });
ok(juntos.length === 2 && unidos.length === 1, 'Merge une regiões próximas (0 separa, 1 une)', juntos.length + '/' + unidos.length);
ok(P.blobAnalisar(cena(W, H, [[10, 10, 29, 29]], 255, 30), W, H, base).length === 1,
  'fundo claro: detecta a região escura (polaridade automática)');
ok(P.blobAnalisar(cena(100, 80, [[10, 10, 29, 29]], 0, 200), W, H, { ...base, sensitivity: 0.05 }).length === 0,
  'Sensitivity baixa exige regiões muito claras (nada passa)');

console.log('Blob Tracker · IDs estáveis e fiação');

const q1 = P.blobAtribuirIds([], P.blobAnalisar(cena(W, H, [[10, 10, 29, 29], [60, 40, 84, 64]]), W, H, base), 1);
const q2 = P.blobAtribuirIds(q1.blobs, P.blobAnalisar(cena(W, H, [[12, 11, 31, 30], [60, 40, 84, 64]]), W, H, base), q1.proxId);
const idMovido = q2.blobs.find(b => Math.abs(b.cx - 21.5) < 2);
const idParado = q2.blobs.find(b => Math.abs(b.cx - 72) < 2);
ok(idMovido && idParado && idMovido.id === q1.blobs.find(b => Math.abs(b.cx - 19.5) < 1).id && idParado.id !== idMovido.id,
  'blob que se moveu 2px mantém o ID; o parado mantém o dele');
const q3 = P.blobAtribuirIds(q2.blobs, P.blobAnalisar(cena(W, H, [[60, 40, 84, 64], [5, 55, 15, 70]]), W, H, base), q2.proxId);
ok(q3.blobs.length === 2 && q3.blobs.find(b => Math.abs(b.cx - 72) < 2).id === idParado.id
  && q3.blobs.find(b => Math.abs(b.cx - 10) < 2).id >= q2.proxId,
  'blob que some não deixa overlay fantasma; blob novo ganha ID novo');

ok(/blobTracker: \(n, \[a\]\) => \(a \? fx7Canvas/.test(html), 'RUN usa o pipeline de canvas existente (fx7Canvas)');
ok(/rt\._blobPrev/.test(html) && /n\.runtime/.test(html), 'estado do tracking mora no runtime (nunca serializa)');

process.exit(resumo() ? 0 : 1);
