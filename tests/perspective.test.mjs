/* Editor 3.1 — "Perspective Warp": engenharia reversa do Perspectivo (Figma).
   Cobre definição do nó, shader (mapa inverso), a homografia do plano e o
   executor (uniformes calculados a partir dos parâmetros). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const recorta = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

console.log('Perspective Warp (Perspectivo)');

/* ---------- definição do nó ---------- */
const def = recorta('  perspectiveWarp: {', '  flip: { title: \'Mirror\'');
ok(/title: 'Perspective Warp'/.test(def), 'nome do nó', 'title');
ok(/cat: 'transform'/.test(def), 'entra em Transform (junto do Warp / Puppet)');
ok(/inputs: \['S1', 'S2', 'S3', 'S4'\]/.test(def), 'sockets de imagem (base; a lista real é dinâmica)', 'sockets');
ok(/\{ type: 'hidden', key: 'sockets', label: 'Sockets', def: '1' \}/.test(def)
  && /\{ type: 'hidden', key: 'slot', label: 'Editing socket', def: '1' \}/.test(def)
  && /\{ type: 'hidden', key: 'saida', label: 'Output', def: 'comp' \}/.test(def),
  'contagem, socket em edição e saída saem dos selects (abas + e − cuidam disso)', 'dinamico');
ok(!/ENUM\('sockets'/.test(def) && !/ENUM\('slot'/.test(def) && !/ENUM\('saida'/.test(def),
  'o teto fixo de 4 sockets saiu da definição do nó', 'sem teto');
ok(/\{ type: 'hidden', key: 'slots'/.test(def), 'dados por socket guardados fora dos controles', 'slots');
ok(/kw: '[^']*perspective[^']*sphere[^']*'/.test(def), 'palavras-chave para a busca', 'kw');

const controles = [
  ['modo (Perspective / Sphere)', /ENUM\('modo', 'Mode', \[\['persp', 'Perspective \(3D\)'\], \['sphere', 'Sphere \(ball\)'\]\], 'persp'\)/],
  ['Horizontal ±90°', /NUM\('horiz', 'Horizontal ±90°', -89, 89, 0, 1\)/],
  ['Vertical ±90°', /NUM\('vert', 'Vertical ±90°', -89, 89, 0, 1\)/],
  ['Depth', /NUM\('depth', 'Depth', 5, 150, 100\)|NUM\('depth', 'Depth', 5, 150, 100\)/],
  ['Zoom', /NUM\('zoom', 'Zoom', 40, 260, 100\)/],
  ['Sphere amount', /NUM\('amount', 'Sphere amount',/],
  ['Sphere radius', /NUM\('radius', 'Sphere radius',/],
  ['Center X', /NUM\('centerX', 'Center X', 0, 100, 50\)/],
  ['Center Y', /NUM\('centerY', 'Center Y', 0, 100, 50\)/],
  ['Clip to sphere', /ENUM\('clip', 'Clip to sphere', \[\['0', 'Off'\], \['1', 'On'\]\], '0'\)/],
];
for (const [nome, re] of controles) ok(re.test(def), 'controle: ' + nome);

/* ---------- shader ---------- */
const sh = recorta('  perspectiveFx: `', '  colorKey: `');
ok(/uniform vec3 uHx, uHy, uHz;/.test(sh), 'homografia em três colunas (uniform3fv)', 'uH');
ok(/vec3 hp = uHx \* \(p\.x \/ z\) \+ uHy \* \(p\.y \/ z\) \+ uHz;/.test(sh),
  'aplica a INVERSA no pixel de destino (mapeamento inverso)', 'inversa');
ok(/if \(hp\.z <= 0\.0001\) \{ outColor = vec4\(0\.0\); return; \}/.test(sh),
  'descarta o que caiu atrás da câmera (w ≤ 0)');
ok(/float lam = asin\(clamp\(pc\.x \* sAng \/ cphi, -1\.0, 1\.0\)\);/.test(sh), 'esfera: desfaz a longitude por asin', 'lambda');
ok(/float ang = HALFPI \* clamp\(uAmount, 0\.05, 1\.0\);/.test(sh), 'abertura angular da esfera = amount (até 90°)', 'abertura');
ok(/float phi = asin\(clamp\(pc\.y \* sAng, -1\.0, 1\.0\)\);/.test(sh), 'esfera: desfaz a latitude por asin (normalizada por sin A)', 'phi');
ok(/vec2 a = vec2\(lam, phi\) \/ ang;/.test(sh), 'λ e φ normalizados pela abertura (borda da arte = borda da esfera)');
ok(/dot\(pc, pc\) > 1\.0/.test(sh), 'fora do disco da esfera');
ok(/uClip > 0\.5 \? vec4\(0\.0\) : texture\(uSrc, vUv\)/.test(sh), 'Clip On = transparência, Off = mantém o plano');
ok(/uv\.x < 0\.0 \|\| uv\.x > 1\.0 \|\| uv\.y < 0\.0 \|\| uv\.y > 1\.0/.test(sh), 'fora da fonte = alpha 0 (sem arrastar borda)');
ok(/float rShort = min\(asp, 1\.0\) \/ m;/.test(sh), 'raio da esfera em espaço métrico (bola redonda em qualquer proporção)', 'rShort');
ok(/uv = uCenter \+ a \* vec2\(s \* m \/ \(2\.0 \* asp\), s \* m \* 0\.5\);/.test(sh), 'quadrado da arte em volta do disco vira UV da fonte', 'quadrado');
ok(/float m = max\(asp, 1\.0\);/.test(sh), 'normaliza pelo maior lado (círculo continua redondo)');
ok(/uniform int uMode;/.test(sh), 'uMode é int no GLSL (INT_UNIFORMS manda uniform1i)');
const chaves = (sh.match(/\{/g) || []).length === (sh.match(/\}/g) || []).length;
ok(chaves, 'chaves equilibradas no GLSL');

/* ---------- matemática: perspH + inversa ---------- */
const mat = recorta('function perspH(', 'const RUN = {');
const { perspH, mat3InvertCols, mat3Mul, perspFitMap } =
  new Function(mat + '\nreturn { perspH, mat3InvertCols, mat3Mul, perspFitMap };')();

const aplica = (H, u, v) => {
  const w = H[6] * u + H[7] * v + H[8];
  return { x: (H[0] * u + H[1] * v + H[2]) / w, y: (H[3] * u + H[4] * v + H[5]) / w };
};
const perto = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const H0 = perspH(0, 0, 100);
{
  const p = aplica(H0, 0.37, -0.62);
  ok(perto(p.x, 0.37) && perto(p.y, -0.62), '0° é a identidade (Depth não deforma sozinho)', 'identidade');
}

{
  let erro = 0;
  for (const [hx, vy, d] of [[0, 0, 100], [22, 0, 100], [0, -35, 80], [30, 18, 40], [-52, 41, 150]]) {
    const cols = mat3InvertCols(perspH(hx, vy, d));
    const H = [cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]];
    for (const u of [-1, -0.4, 0, 0.55, 1]) for (const v of [-0.9, 0, 0.8]) {
      const d1 = aplica(perspH(hx, vy, d), u, v);
      const back = aplica(H, d1.x, d1.y);
      erro = Math.max(erro, Math.abs(back.x - u), Math.abs(back.y - v));
    }
  }
  ok(erro < 1e-9, 'inversa 3×3 fecha o ciclo destino → fonte', 'erro ' + erro.toExponential(2));
}

{
  // rotação horizontal: as duas laterais ficam com alturas diferentes (keystone)
  const H = perspH(35, 0, 100);
  const esq = aplica(H, -1, 1), dir = aplica(H, 1, 1);
  ok(Math.abs(Math.abs(esq.y) - Math.abs(dir.y)) > 0.05, 'rotacionar em Horizontal gera trapézio (perspectiva, não skew)', 'keystone');
  // rotação em Vertical: agora são as verticais que convergem (dois pontos de fuga)
  const V = perspH(0, 35, 100);
  const cima = aplica(V, 1, 1), baixo = aplica(V, 1, -1);
  ok(!perto(cima.x, baixo.x, 0.02), 'rotacionar em Vertical faz as laterais convergirem', 'convergencia');
}

{
  // Depth menor = perspectiva mais forte: a lateral direita encolhe mais
  const alturaDir = d => Math.abs(aplica(perspH(35, 0, d), 1, 1).y);
  ok(alturaDir(40) < alturaDir(100) && alturaDir(100) < alturaDir(150),
    'Depth baixo fortalece a perspectiva (ordem monotônica)', 'depth');
}

/* ---------- reenquadre (fit): o plano não foge para o canto ---------- */
{
  const asp = 1.6, m = 1.6, hx0 = asp / m, hy0 = 1 / m;   // meias-extensões do quadro
  const bordas = (H) => {
    const cols = mat3InvertCols(H);                              // destino final → fonte
    const F = [cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]];
    let mx = 0, my = 0;
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const p = aplica(F, u * asp / m, v / m);
      mx = Math.max(mx, Math.abs(p.x)); my = Math.max(my, Math.abs(p.y));
    }
    return { mx, my };
  };
  const id = bordas(perspFitMap(perspH(0, 0, 100), asp, m));
  ok(perto(id.mx, hx0, 1e-9) && perto(id.my, hy0, 1e-9), '0° com fit continua exatamente o original', 'fit identidade');
  for (const [hx, vy, d] of [[35, 0, 100], [0, -40, 60], [50, 30, 150], [-25, 12, 40]]) {
    const b = bordas(perspFitMap(perspH(hx, vy, d), asp, m));
    const dentro = b.mx <= hx0 + 1e-9 && b.my <= hy0 + 1e-9;
    const encosta = perto(b.mx, hx0, 1e-6) || perto(b.my, hy0, 1e-6);
    ok(dentro && encosta, `fit ${hx}/${vy}/${d}: cabe no quadro e encosta na borda`, `${b.mx.toFixed(3)}×${b.my.toFixed(3)}`);
  }
  // o bbox do plano deformado fica centrado no quadro (é o bbox que centraliza,
  // não o centro do plano — a perspectiva é assimétrica de propósito)
  const cols = mat3InvertCols(perspFitMap(perspH(35, 0, 100), asp, m));
  const F = [cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]];
  const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => aplica(F, u * asp / m, v / m));
  const cx = (Math.min(...pts.map(p => p.x)) + Math.max(...pts.map(p => p.x))) / 2;
  const cy = (Math.min(...pts.map(p => p.y)) + Math.max(...pts.map(p => p.y))) / 2;
  ok(Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9, 'bbox do plano deformado centrado no quadro', cx.toFixed(6));
}

/* ---------- um passe: uniformes ---------- */
const corpoMapa = recorta('function perspAplica(a, p) {', 'function perspSobre(a, b) {');
const passa = new Function('perspH', 'perspFitMap', 'pointOp', corpoMapa + '\nreturn perspAplica;')(
  perspH, perspFitMap, (a, prog, u) => ({ prog, u })
);

{
  const r = passa({ w: 1600, h: 1000 },
    { modo: 'persp', horiz: 20, vert: -10, depth: 100, zoom: 100, amount: 95, radius: 60, centerX: 50, centerY: 50, clip: '0' });
  ok(r.prog === 'perspectiveFx', 'cada socket passa pelo shader perspectiveFx', r.prog);
  ok(r.u.uMode === 0, 'modo perspectiva = uMode 0');
  ok(Math.abs(r.u.uAspect - 1.6) < 1e-9, 'uAspect vem do tamanho da entrada', r.u.uAspect);
  const fin = perspFitMap(perspH(20, -10, 100), 1.6, 1.6);
  ok(r.u.uHx.join() === [fin[0], fin[3], fin[6]].join() && r.u.uHz.join() === [fin[2], fin[5], fin[8]].join(),
    'passa a inversa reenquadrada nas três colunas');
  ok(Math.abs(r.u.uCenter[0] - 0.5) < 1e-9 && Math.abs(r.u.uCenter[1] - 0.5) < 1e-9, 'centro 50/50 = meio da fonte');
}

{
  const r = passa({ w: 1000, h: 1000 },
    { modo: 'sphere', horiz: 0, vert: 0, depth: 100, zoom: 100, amount: 80, radius: 40, centerX: 25, centerY: 75, clip: '1' });
  ok(r.u.uMode === 1, 'modo esfera = uMode 1');
  ok(Math.abs(r.u.uAmount - 0.8) < 1e-9 && Math.abs(r.u.uRadius - 0.4) < 1e-9, 'amount/radius em 0..1');
  ok(r.u.uClip === 1, 'clip ligado chega como 1');
  ok(Math.abs(r.u.uCenter[0] - 0.25) < 1e-9 && Math.abs(r.u.uCenter[1] - 0.25) < 1e-9,
    'centerX/centerY viram UV da fonte (75% de cima = 0.25 de baixo)', r.u.uCenter.join());
}

{
  const r = passa({ w: 800, h: 800 }, { modo: 'persp', horiz: 0, vert: 0, depth: 100, zoom: 250 });
  ok(Math.abs(r.u.uZoom - 2.5) < 1e-9, 'zoom em múltiplo (100 → 1.0)', r.u.uZoom);
  const sem = passa({ w: 800, h: 800 }, { modo: 'persp' });
  ok(sem.u.uZoom >= 0.05 && sem.u.uAmount >= 0.05, 'parâmetros ausentes caem em valores seguros');
}

/* ---------- executor: sockets, solo e composição ---------- */
{
  console.log('\nSockets e composição');
  const corpo = recorta('  perspectiveWarp: (n, ins) => {', '  brightness: (n, [a]) => {')
    .replace(/^\s*perspectiveWarp:\s*/, '')
    .replace(/,\s*$/, '');
  const chama = [];
  const fonteQtd = recorta('const PERSP_MAX =', 'function perspLeitura');
  const perspQtd = new Function(fonteQtd + '\nreturn perspQtd;')();
  const roda = new Function('perspAplica', 'perspSlotOf', 'perspSobre', 'perspQtd', 'const f = ' + corpo + '; return f;')(
    (a, p) => { chama.push({ w: a.w, slot: p.slot }); return { w: a.w, parte: chama.length }; },
    (n, i) => ({ slot: i }),
    (a, b) => ({ w: a.w, sobre: [a, b] }),
    perspQtd
  );
  const ent = w => ({ w, h: w });

  chama.length = 0;
  const um = roda({ params: { sockets: '1', saida: 'comp' } }, [ent(100), ent(200)]);
  ok(chama.length === 1 && !um.sobre, '1 socket: ignora a segunda entrada e não compõe', String(chama.length));

  chama.length = 0;
  const dois = roda({ params: { sockets: '2', saida: 'comp' } }, [ent(100), ent(200)]);
  ok(chama.length === 2, '2 sockets: cada entrada tem o seu passe', String(chama.length));
  ok(dois.sobre && dois.sobre[0].parte === 1 && dois.sobre[1].parte === 2, 'socket 1 embaixo, socket 2 por cima', 'ordem');

  chama.length = 0;
  const quatro = roda({ params: { sockets: '4', saida: 'comp' } }, [ent(10), ent(20), ent(30), ent(40)]);
  ok(chama.length === 4 && quatro.sobre && quatro.sobre[0].sobre, '4 sockets compõem em cadeia', String(chama.length));

  chama.length = 0;
  const solo = roda({ params: { sockets: '3', saida: '2' } }, [ent(10), ent(20), ent(30)]);
  ok(chama.length === 1 && chama[0].slot === 2, 'saída isolada deforma só o socket escolhido', JSON.stringify(chama));
  ok(!solo.sobre, 'socket isolado não compõe');

  chama.length = 0;
  const vazio = roda({ params: { sockets: '4', saida: 'comp' } }, [null, null, null, null]);
  ok(vazio === null, 'sem entrada ligada o nó não produz imagem');

  chama.length = 0;
  const sete = roda({ params: { sockets: '7', saida: 'comp' } },
    [ent(1), ent(2), ent(3), ent(4), ent(5), ent(6), ent(7)]);
  ok(chama.length === 7 && chama[6].slot === 7, 'passa de 4 sockets: todos entram no composto', String(chama.length));

  chama.length = 0;
  const ultimo = roda({ params: { sockets: '6', saida: '6' } }, [ent(1), ent(2), ent(3), ent(4), ent(5), ent(6)]);
  ok(chama.length === 1 && chama[0].slot === 6, 'saída isolada aceita socket acima de 4', JSON.stringify(chama));
}

/* ---------- parâmetros por socket (troca de slot) ---------- */
{
  const fonteSlots = recorta('const PERSP_CHAVES =', '/* um passe de perspectiva sobre uma entrada */')
    + recorta('function perspTrocSlot(n) {', 'const RUN = {');
  const defs = ['modo', 'horiz', 'vert', 'depth', 'zoom', 'amount', 'radius', 'centerX', 'centerY', 'clip']
    .map(k => (k === 'modo' || k === 'clip')
      ? { key: k, type: 'enum' }
      : { key: k, type: 'num', min: k === 'horiz' || k === 'vert' ? -89 : 0, max: k === 'horiz' || k === 'vert' ? 89 : 1000 });
  const api = new Function('clamp', 'NODE_TYPES',
    fonteSlots + '\nreturn { perspLeitura, perspSlots, perspSlotOf, perspTrocSlot, perspQtd, perspReindexa, perspMoldaSaida };')(
    (v, a, b) => Math.min(b, Math.max(a, Number(v))),
    { perspectiveWarp: { params: defs } }
  );
  const n = { params: { sockets: '4', slot: '1', modo: 'persp', horiz: 0, vert: 0, depth: 100, zoom: 100,
    amount: 95, radius: 60, centerX: 50, centerY: 50, clip: '0', slots: '' }, ui: {} };

  api.perspTrocSlot(n);
  ok(n.runtime.perspSlot === 1, 'socket 1 é o inicial');

  n.params.horiz = 40;
  n.params.slot = '2';
  api.perspTrocSlot(n);
  ok(JSON.parse(n.params.slots)['1'].horiz === 40, 'o socket anterior é gravado antes de trocar', n.params.slots);
  ok(n.params.horiz === 40, 'socket novo herda o ajuste atual (não zera na cara do usuário)');

  n.params.horiz = -25;
  n.params.slot = '1';
  api.perspTrocSlot(n);
  ok(n.params.horiz === 40, 'voltar ao socket 1 devolve o ajuste dele', String(n.params.horiz));
  const guardado = JSON.parse(n.params.slots);
  ok(guardado['2'].horiz === -25, 'o socket 2 guarda o ajuste próprio', JSON.stringify(guardado['2']));

  const p2 = api.perspSlotOf(n, 2), p1 = api.perspSlotOf(n, 1);
  ok(p1.horiz === 40 && p2.horiz === -25, 'cada socket lê o seu próprio conjunto', p1.horiz + '/' + p2.horiz);
  ok(p1.modo === 'persp' && p2.depth === 100, 'modo/profundidade também são por socket');

  /* quantidade de sockets: dinâmica, com teto */
  const q = v => api.perspQtd({ params: { sockets: v } });
  ok(q('1') === 1 && q('4') === 4 && q('9') === 9, 'a contagem vem dos parâmetros (não trava em 4)', [q('1'), q('4'), q('9')].join('/'));
  ok(q('0') === 1 && q('-3') === 1 && q('abc') === 1 && q(undefined) === 1, 'contagem inválida cai em 1 socket');
  ok(q('99') === 12, 'contagem absurda respeita o teto de 12 (' + q('99') + ')', 'teto');
  const n5 = { params: { sockets: '5', slot: '5', modo: 'persp', horiz: 0, vert: 0, depth: 100, zoom: 100,
    amount: 95, radius: 60, centerX: 50, centerY: 50, clip: '0', slots: '' }, ui: {} };
  api.perspTrocSlot(n5);
  ok(n5.runtime.perspSlot === 5, 'socket 5 pode ser editado (antes travava em 4)', String(n5.runtime.perspSlot));

  /* remover um socket: o mapa anda para baixo e a saída se ajusta */
  const mapa = { 1: { horiz: 10 }, 2: { horiz: 20 }, 3: { horiz: 30 } };
  const sem2 = api.perspReindexa(mapa, 2);
  ok(JSON.stringify(sem2) === JSON.stringify({ 1: { horiz: 10 }, 2: { horiz: 30 } }),
    'remover o socket 2 puxa o 3 para o lugar dele', JSON.stringify(sem2));
  ok(JSON.stringify(api.perspReindexa(mapa, 1)) === JSON.stringify({ 1: { horiz: 20 }, 2: { horiz: 30 } }),
    'remover o primeiro desce todos');
  ok(JSON.stringify(api.perspReindexa(mapa, 9)) === JSON.stringify(mapa), 'índice inexistente não mexe no mapa');
  ok(JSON.stringify(api.perspReindexa({}, 1)) === '{}', 'mapa vazio continua vazio');
  ok(api.perspMoldaSaida('comp', 2) === 'comp', 'saída composta continua composta');
  ok(api.perspMoldaSaida('3', 2) === '2', 'solo à frente do removido desce junto');
  ok(api.perspMoldaSaida('1', 2) === '1', 'solo atrás do removido não muda');
  ok(api.perspMoldaSaida('2', 2) === 'comp', 'solo do socket removido volta para composta');
}

/* ---------- adicionar / remover sockets (3.2.0) ---------- */
{
  console.log('\nSockets dinâmicos');
  ok(/if \(n\.type === 'perspectiveWarp'\) \{\s*const cnt = perspQtd\(n\);/.test(html),
    'nodeInputs monta S1..Sn a partir da contagem', 'nodeInputs');
  ok(/function syncPerspSockets\(n\)/.test(html) && /existing\.forEach\(r => r\.remove\(\)\)/.test(html),
    'as entradas do nó são refeitas ao mudar a contagem', 'sync');
  ok(/if \(toNode && toNode\.type === 'perspectiveWarp' && input >= perspQtd\(toNode\)/.test(html),
    'fio ligado num socket novo já abre o socket', 'connect');
  ok(/alvo\.type === 'perspectiveWarp'\) livre = perspAddSocket\(alvo\)/.test(html),
    'soltar o fio no corpo do nó cria mais um socket', 'drop');

  const fonteAux = recorta('const PERSP_CHAVES =', 'const RUN = {')
    + recorta('function perspAddSocket(n) {', 'function hexRgb01(h)');
  const defsP = ['modo', 'horiz', 'vert', 'depth', 'zoom', 'amount', 'radius', 'centerX', 'centerY', 'clip']
    .map(k => (k === 'modo' || k === 'clip')
      ? { key: k, type: 'enum' }
      : { key: k, type: 'num', min: k === 'horiz' || k === 'vert' ? -89 : 0, max: k === 'horiz' || k === 'vert' ? 89 : 1000 });
  const liga = [];
  const avisos = [];
  const api = new Function('clamp', 'NODE_TYPES', 'links', 'removeLink', 'syncPerspSockets', 'perspAtualizaUI',
    'markDirty', 'requestRender', 'commit', 'setStatus',
    fonteAux + '\nreturn { perspAddSocket, perspDelSocket, perspQtd };')(
    (v, a, b) => Math.min(b, Math.max(a, Number(v))),
    { perspectiveWarp: { params: defsP } },
    liga,
    l => { const i = liga.indexOf(l); if (i >= 0) liga.splice(i, 1); },
    () => {}, () => {}, () => {}, () => {}, () => {},
    m => avisos.push(m)
  );
  const node = () => ({ params: { sockets: '2', slot: '1', modo: 'persp', horiz: 0, vert: 0, depth: 100,
    zoom: 100, amount: 95, radius: 60, centerX: 50, centerY: 50, clip: '0', slots: '', saida: 'comp' }, ui: {} });

  const a = node();
  const idxNovo = api.perspAddSocket(a);
  ok(idxNovo === 2 && a.params.sockets === '3', 'adicionar socket sobe a contagem (devolve o índice do novo)', a.params.sockets);
  ok(a.params.slot === '3', 'o socket novo já fica em edição', a.params.slot);
  ok(a.runtime.perspSlot === 3, 'a troca de socket é registrada (nada é perdido no caminho)', String(a.runtime.perspSlot));

  const cheio = node();
  cheio.params.sockets = '12';
  ok(api.perspAddSocket(cheio) === -1 && cheio.params.sockets === '12', 'no teto o botão não faz nada');
  ok(avisos.some(m => /limit/.test(m)), 'o aviso do teto aparece na barra de status', avisos.join(' | '));

  const d = node();
  d.runtime = { perspSlot: 2 };
  d.params.sockets = '3';
  d.params.slot = '2';
  d.params.saida = '3';
  d.params.slots = JSON.stringify({ 1: { horiz: 10 }, 3: { horiz: 30 } });
  liga.push({ from: 9, to: d.id, input: 0 }, { from: 9, to: d.id, input: 1 }, { from: 9, to: d.id, input: 2 });
  ok(api.perspDelSocket(d, 2) === true, 'remover o socket em edição funciona');
  ok(d.params.sockets === '2', 'a contagem cai', d.params.sockets);
  ok(JSON.stringify(JSON.parse(d.params.slots)) === JSON.stringify({ 1: { horiz: 10 }, 2: { horiz: 30 } }),
    'os ajustes dos sockets de cima descem uma casa', d.params.slots);
  ok(d.params.saida === '2', 'a saída que apontava para o socket 3 passa a apontar para o 2', d.params.saida);
  ok(liga.length === 2 && !liga.some(l => l.input === 2), 'o fio do socket removido sai e os outros descem', JSON.stringify(liga));

  const um = node();
  um.params.sockets = '1';
  liga.length = 0;
  ok(api.perspDelSocket(um, 1) === false && um.params.sockets === '1', 'sempre sobra pelo menos um socket');

  /* projeto salvo com fio num socket que a contagem não cobre: o socket volta */
  const antigo = node();
  antigo.id = 77;
  antigo.params.sockets = '1';
  liga.length = 0;
  liga.push({ from: 5, to: 77, input: 0 }, { from: 6, to: 77, input: 3 });
  ok(api.perspQtd(antigo) === 4 && antigo.params.sockets === '4',
    'fio antigo num socket acima da contagem reabre o socket', antigo.params.sockets);
}

/* ---------- visualizador interno do nó (3.1.1) ---------- */
{
  console.log('\nVisualizador interno (pview)');
  ok(/\{ type: 'pview', key: 'pview', label: 'View', def: '' \}/.test(def), 'o nó declara o visualizador interno', 'param');
  ok(/else if \(p\.type === 'pview'\) el = makePerspView\(n\);/.test(html), 'buildControls cria o canvas do nó', 'build');
  ok(/if \(n\.type === 'perspectiveWarp'\) \{\s*body\.addEventListener\('input'/.test(html), 'slider do painel redesenha o visualizador');
  ok(/if \(n\.type === 'perspectiveWarp' && n\.ui\.pviewAgenda\) n\.ui\.pviewAgenda\(\);/.test(html), 'mudança programática de parâmetro também redesenha');
  ok(/nd\.type === 'perspectiveWarp' && nd\.ui\.pviewAgenda/.test(html), 'ligar/desligar a imagem na entrada atualiza o preview', 'markDirty');
  ok(/\.pview\{[^}]*\}/.test(html) && /\.pview-cv\{[^}]*\}/.test(html) && /\.pview-hint\{[^}]*\}/.test(html), 'CSS do visualizador', 'css');

  const vis = recorta('function makePerspView(n) {', 'function makeGradientPins(n) {');
  ok(/const arte = pviewArte\(n, ativo - 1\);/.test(vis), 'desenha a arte do socket em edição (ou a grade de teste)', 'arte');
  ok(/const p = perspSlotOf\(n, ativo\);/.test(vis), 'o preview usa os parâmetros do socket em edição', 'params');
  ok(/const b = E\('button', 'pview-tab'/.test(vis), 'uma aba por socket no visualizador', 'abas');
  ok(/n\.params\.slot = String\(i\);\s*perspTrocSlot\(n\);/.test(vis),
    'clicar na aba troca o socket em edição', 'troca');
  ok(/const mais = E\('button', 'pview-tab add', '\+'\)/.test(vis) && /perspAddSocket\(n\)/.test(vis),
    'aba + adiciona socket (como o Layers adiciona camada)', 'add');
  ok(/const menos = E\('button', 'pview-tab del', '−'\)/.test(vis) && /perspDelSocket\(n, ativo\)/.test(vis),
    'aba − remove o socket em edição', 'del');
  ok(/selSaida\.append\(o0\)/.test(vis) && /o\.textContent = 'Socket ' \+ i \+ ' only'/.test(vis),
    'a saída lista composta + todos os sockets criados', 'saida');
  ok(/n\.ui\.saida = pintaSaida;/.test(vis), 'trocar/adicionar socket atualiza a lista da saída', 'ui');
  ok(/solo === String\(i\) \? ' solo' : ''/.test(vis), 'aba marca o socket que está na saída', 'solo');
  ok(/\? 'Output: composited' : 'Output: socket ' \+ solo \+ ' only'/.test(vis), 'a dica mostra a saída escolhida');
  ok(/const uv = perspMapUV\(p, asp, m, px, py\);/.test(vis), 'cada pixel do preview passa pelo mesmo mapa do shader', 'mapa');
  ok(/setParam\(n, def\('horiz'\), arrasto\.h \+ dx\)/.test(vis) && /setParam\(n, def\('vert'\), arrasto\.v - dy\)/.test(vis),
    'arrastar muda Horizontal/Vertical', 'drag');
  ok(/arrasto\.w \* 180 \* k/.test(vis), 'uma largura do canvas = 180° (arrasto proporcional)', 'escala');
  ok(/const chave = n\.params\.modo === 'sphere' \? 'radius' : 'depth';/.test(vis), 'roda muda Depth (na esfera, o raio)', 'wheel');
  ok(/setParam\(n, def\('centerX'\), arrasto\.cx \+ dx \/ 1\.8\)/.test(vis), 'na esfera o arrasto move o centro', 'centro');
  ok(/ev\.shiftKey \? 0\.2 : 1/.test(vis), 'Shift = ajuste fino');
  ok(/requestAnimationFrame\(\(\) => \{ pendente = false;/.test(vis), 'redesenho coalescido por frame (não trava o arrasto)', 'raf');
  ok(/dica\.textContent = \(solo === 'comp'/.test(vis) && /esfera\s*\?/.test(vis), 'a dica muda com o modo');

  // mesma matemática do preview: identidade em 0° e disco da esfera
  const visMat = recorta('function perspMapUV(', '/* grade de teste');
  const { perspMapUV } = new Function(mat + visMat + '\nreturn { perspMapUV };')();
  const asp = 1.5, m = 1.5;
  const paraP = (u, v) => [(u - 0.5) * 2 * asp / m, (v - 0.5) * 2 / m];
  {
    let erro = 0;
    for (const [u, v] of [[0.5, 0.5], [0.2, 0.9], [0.8, 0.1], [0.05, 0.5]]) {
      const [px, py] = paraP(u, v);
      const uv = perspMapUV({ modo: 'persp', horiz: 0, vert: 0, depth: 100, zoom: 100 }, asp, m, px, py);
      erro = Math.max(erro, Math.abs(uv[0] - u), Math.abs(uv[1] - v));
    }
    ok(erro < 1e-9, 'preview em 0° devolve o mesmo ponto (identidade)', 'erro ' + erro.toExponential(1));
  }
  {
    const p0 = { modo: 'persp', horiz: 40, vert: 0, depth: 70, zoom: 100 };
    const uv = perspMapUV(p0, asp, m, 0, 0);
    // o fit centraliza o bbox do plano, então o centro cai perto (não exatamente) do meio
    ok(uv && Math.hypot(uv[0] - 0.5, uv[1] - 0.5) < 0.35, 'centro do preview continua dentro da arte', String(uv));
    const fora = perspMapUV(p0, asp, m, 9, 9);
    ok(fora === null || (Number.isFinite(fora[0]) && Number.isFinite(fora[1])), 'ponto extremo não gera NaN (sem furo no preview)');
  }
  {
    const pe = { modo: 'sphere', amount: 95, radius: 60, centerX: 50, centerY: 50, clip: '0' };
    ok(perspMapUV(pe, asp, m, 0, 0) !== null, 'esfera: centro do disco é amostrado');
    const meio = perspMapUV(pe, asp, m, 0.1, 0.1), borda = perspMapUV(pe, asp, m, 0.5, 0.5);
    ok(borda === null, 'esfera: fora do disco devolve null (o chamador decide clip/plano)', 'disco');
    ok(meio && meio[0] > 0.5, 'esfera: à direita do centro a amostra vem da direita da arte', String(meio));
  }
}

process.exit(resumo() ? 0 : 1);
