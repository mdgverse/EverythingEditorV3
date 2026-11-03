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
ok(/inputs: \['Image'\]/.test(def), 'recebe imagem de qualquer nó');
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

/* ---------- executor: uniformes ---------- */
const corpo = recorta('  perspectiveWarp: (n, [a]) => {', '  brightness: (n, [a]) => {')
  .replace(/^\s*perspectiveWarp:\s*/, '')
  .replace(/,\s*$/, '');
const roda = new Function('perspH', 'mat3InvertCols', 'perspFitMap', 'pointOp', 'const f = ' + corpo + '; return f;')(
  perspH, mat3InvertCols, perspFitMap, (a, prog, u) => ({ prog, u })
);

{
  const r = roda({ params: { modo: 'persp', horiz: 20, vert: -10, depth: 100, zoom: 100, amount: 95, radius: 60, centerX: 50, centerY: 50, clip: '0' } },
    [{ w: 1600, h: 1000 }]);
  ok(r.prog === 'perspectiveFx', 'executor chama o shader perspectiveFx', r.prog);
  ok(r.u.uMode === 0, 'modo perspectiva = uMode 0');
  ok(Math.abs(r.u.uAspect - 1.6) < 1e-9, 'uAspect vem do tamanho de entrada', r.u.uAspect);
  const fin = perspFitMap(perspH(20, -10, 100), 1.6, 1.6);
  ok(r.u.uHx.join() === [fin[0], fin[3], fin[6]].join() && r.u.uHz.join() === [fin[2], fin[5], fin[8]].join(),
    'passa a inversa reenquadrada nas três colunas');
  ok(Math.abs(r.u.uCenter[0] - 0.5) < 1e-9 && Math.abs(r.u.uCenter[1] - 0.5) < 1e-9, 'centro 50/50 = meio da fonte');
}

{
  const r = roda({ params: { modo: 'sphere', horiz: 0, vert: 0, depth: 100, zoom: 100, amount: 80, radius: 40, centerX: 25, centerY: 75, clip: '1' } },
    [{ w: 1000, h: 1000 }]);
  ok(r.u.uMode === 1, 'modo esfera = uMode 1');
  ok(Math.abs(r.u.uAmount - 0.8) < 1e-9 && Math.abs(r.u.uRadius - 0.4) < 1e-9, 'amount/radius em 0..1');
  ok(r.u.uClip === 1, 'clip ligado chega como 1');
  // 25% / 75%: x à esquerda e y para baixo (vUv cresce para cima, logo y negativo)
  ok(Math.abs(r.u.uCenter[0] - 0.25) < 1e-9 && Math.abs(r.u.uCenter[1] - 0.25) < 1e-9,
    'centerX/centerY viram UV da fonte (75% de cima = 0.25 de baixo)', r.u.uCenter.join());
}

{
  const r = roda({ params: { modo: 'persp', horiz: 0, vert: 0, depth: 100, zoom: 250 } }, [{ w: 800, h: 800 }]);
  ok(Math.abs(r.u.uZoom - 2.5) < 1e-9, 'zoom em múltiplo (100 → 1.0)', r.u.uZoom);
  const sem = roda({ params: { modo: 'persp' } }, [{ w: 800, h: 800 }]);
  ok(sem.u.uZoom >= 0.05 && sem.u.uAmount >= 0.05, 'parâmetros ausentes caem em valores seguros');
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
  ok(/const arte = pviewArte\(n\);/.test(vis), 'desenha a arte da entrada (ou a grade de teste)', 'arte');
  ok(/const uv = perspMapUV\(p, asp, m, px, py\);/.test(vis), 'cada pixel do preview passa pelo mesmo mapa do shader', 'mapa');
  ok(/setParam\(n, def\('horiz'\), arrasto\.h \+ dx\)/.test(vis) && /setParam\(n, def\('vert'\), arrasto\.v - dy\)/.test(vis),
    'arrastar muda Horizontal/Vertical', 'drag');
  ok(/arrasto\.w \* 180 \* k/.test(vis), 'uma largura do canvas = 180° (arrasto proporcional)', 'escala');
  ok(/const chave = n\.params\.modo === 'sphere' \? 'radius' : 'depth';/.test(vis), 'roda muda Depth (na esfera, o raio)', 'wheel');
  ok(/setParam\(n, def\('centerX'\), arrasto\.cx \+ dx \/ 1\.8\)/.test(vis), 'na esfera o arrasto move o centro', 'centro');
  ok(/ev\.shiftKey \? 0\.2 : 1/.test(vis), 'Shift = ajuste fino');
  ok(/requestAnimationFrame\(\(\) => \{ pendente = false;/.test(vis), 'redesenho coalescido por frame (não trava o arrasto)', 'raf');
  ok(/dica\.textContent = esfera/.test(vis), 'a dica muda com o modo');

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
