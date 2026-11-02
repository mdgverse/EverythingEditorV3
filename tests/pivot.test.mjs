/* Quinas do fio (pivôs): o traçado precisa mudar ao criar e ao arrastar,
   mesmo em fio reto e mesmo com zip tie no mesmo fio. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

const fonte =
  extrai('const ROUTE_R = 10;', '// orthogonal vertices') +
  extrai('function routeVerts(', '// SVG of the orthogonal path') +
  extrai('function orthoPath(', 'function linkSamples(') +
  extrai('function pivotPerp(', 'function addPivotFromGesture(') +
  `
  function bezierHandle(a, b) { return Math.max(40, Math.abs(b.x - a.x) * 0.5); }
  function bezier(a, b) { const d = bezierHandle(a, b); return 'C' + a.x + ',' + a.y + ' ' + b.x + ',' + b.y; }
  let zipChamado = 0;
  function zipD(S, A, T) { zipChamado++; return 'ZIP'; }
  return { ROUTE_R, routeVerts, orthoPath, linkD, pivotPerp, zipChamado: () => zipChamado };`;

const g = new Function(fonte)();
const { routeVerts, orthoPath, linkD, pivotPerp, zipChamado } = g;

console.log('quinas do fio');

const S = { x: 300, y: 260 }, T = { x: 700, y: 330 };

/* ---------- criar muda o traçado ---------- */
{
  const l = {};
  const sem = linkD(l, S, T);
  l.pts = [{ x: 500, y: 300 }];
  const com = linkD(l, S, T);
  ok(sem !== com, 'criar a quina muda o fio', sem + ' → ' + com);
  ok(/^M300 260 L/.test(com) && com.indexOf('Q') > 0, 'o fio passa a ter cantos arredondados', com.slice(0, 40));
  ok(com.indexOf('500') > 0 && com.indexOf('300') > 0, 'o traçado passa pelo ponto criado');
}

/* ---------- arrastar muda o traçado ---------- */
{
  const l = { pts: [{ x: 500, y: 300 }] };
  const antes = linkD(l, S, T);
  l.pts[0] = { x: 500, y: 420 };
  const depois = linkD(l, S, T);
  ok(antes !== depois, 'arrastar a quina muda o fio');
  ok(depois.indexOf('420') > 0, 'a quina arrastada aparece no traçado');
}

/* ---------- duas quinas ---------- */
{
  const uma = { pts: [{ x: 500, y: 300 }] }, duas = { pts: [{ x: 500, y: 300 }, { x: 600, y: 420 }] };
  ok(linkD(uma, S, T) !== linkD(duas, S, T), 'cada quina nova muda o fio');
}

/* ---------- fio reto: quina em cima do fio não muda nada → precisa do deslocamento ---------- */
{
  const S2 = { x: 300, y: 300 }, T2 = { x: 700, y: 300 };
  const l = { pts: [{ x: 500, y: 300 }] };
  const colinear = linkD(l, S2, T2);
  /* num fio já reto (modo reto/ortogonal) a quina em cima dele desenha a
     mesma linha: só aparece a bolinha. Com o deslocamento, a linha dobra. */
  const pontos = d => {
    const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number), out = [];
    for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
    return out;
  };
  ok(pontos(colinear).every(([, y]) => Math.abs(y - 300) < 0.01), 'quina em cima de um fio reto continua uma reta (era o “só a bolinha”)', colinear);
  ok(pontos(orthoPath(routeVerts(S2, [], T2))).every(([, y]) => Math.abs(y - 300) < 0.01), 'o próprio fio reto é a mesma reta');

  const q = pivotPerp(S2, T2, { x: 500, y: 300 }, 24);
  ok(Math.abs(q.x - 500) <= 1 && Math.abs(Math.abs(q.y - 300) - 24) <= 1, 'desloca 24 px na perpendicular', q);
  l.pts[0] = q;
  ok(linkD(l, S2, T2) !== colinear && pontos(linkD(l, S2, T2)).some(([, y]) => Math.abs(y - 300) > 5), 'com o deslocamento a quina dobra o fio de verdade');
}

/* ---------- perpendicular em fio vertical e diagonal ---------- */
{
  const v = pivotPerp({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 50 }, 20);
  ok(Math.abs(Math.abs(v.x) - 20) <= 1 && Math.abs(v.y - 50) <= 1, 'fio vertical desloca na horizontal', v);
  const d = pivotPerp({ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 50, y: 50 }, 10);
  const dist = Math.hypot(d.x - 50, d.y - 50);
  ok(Math.abs(dist - 10) <= 1.5, 'fio diagonal desloca em diagonal contrária', [d, dist]);
  const zero = pivotPerp({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 }, 24);
  ok(Number.isFinite(zero.x) && Number.isFinite(zero.y), 'fio de comprimento zero não gera NaN', zero);
}

/* ---------- zip tie não pode engolir a quina ---------- */
{
  const antes = zipChamado();
  const l = { pts: [{ x: 500, y: 300 }] };
  l.zt = { id: 'z1' };                       // fio amarrado
  const d = linkD(l, S, T);
  ok(zipChamado() === antes, 'com quina, o zip tie não é usado no traçado', zipChamado());
  ok(d.indexOf('ZIP') < 0 && d.indexOf('L') > 0, 'o fio segue as quinas', d.slice(0, 30));
  const semQuina = { zt: { id: 'z1' } };
  ok(linkD(semQuina, S, T) === 'ZIP', 'sem quina o zip tie continua mandando');
}

/* ---------- ligação com o app ---------- */
{
  const f = extrai('function addPivotFromGesture(', '// touch: double tap');
  ok(/saiuDoTie/.test(f), 'criar quina em fio amarrado avisa que ele saiu do pacote');
  ok(/t\.keys = t\.keys\.filter\(x => x !== k\)/.test(f), 'o fio sai do zip tie');
  ok(/removeZipTie\(t\.id, ''\)/.test(f), 'pacote vazio é removido');
  ok(/l\.pts\[idx\] = pivotPerp\(S, T, l\.pts\[idx\], 24\)/.test(f), 'deslocamento aplicado quando o traçado não mudaria');
  ok(/setStatus\(saiuDoTie \?/.test(f), 'a barra de status explica o que aconteceu');
  ok(/startPivotDrag\(e, l, idx\)/.test(f), 'já sai arrastando a quina criada');
}

ok(/if \(l\.pts && l\.pts\.length\) return orthoPath\(routeVerts\(S, l\.pts, T\)\);/.test(html), 'linkD dá prioridade à quina');
ok(/if \(l\.zt && !\(l\.pts && l\.pts\.length\)\) return zipSamples/.test(html), 'as amostras do fio seguem a mesma regra');
ok(/insertPivotAt, pivotPerp, deletePivot/.test(html), 'funções da quina expostas no ?debug=1');

const tudo = resumo();
process.exit(tudo ? 0 : 1);
