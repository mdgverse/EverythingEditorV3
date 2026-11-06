/* tests/shader-nodes.test.mjs — 3.11.0 Shader Nodes (port do Blender)
   Valida o que foi realmente entregue no index.html:
   1) os nós e sockets (nomes/tipos/defaults/faixas) extraídos do próprio arquivo;
   2) os uniforms que o GLSL declara × os que o JS envia em draw() (pega typo);
   3) a matemática microfacet transposta do GLSL para JS e verificada por
      integração numérica (D_GGX/Charlie normalizados, Fresnel, Smith, energia).
   Sem navegador no sandbox: o teste lê o código de produção, não uma cópia. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

let passaram = 0, falharam = 0;
const falhas = [];
function ok(cond, nome, extra) {
  if (cond) { passaram++; return true; }
  falharam++; falhas.push(nome + (extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  return false;
}
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/* ---------------- 1. nós e sockets ---------------- */
const NUMr = (key, label, min, max, def, step = 1) => ({ type: 'num', key, label, min, max, def, step });
const ENUMr = (key, label, options, def) => ({ type: 'enum', key, label, options, def });
const COLr = (key, label, def) => ({ type: 'color', key, label, def });
const SECr = (key, label, tip) => ({ type: 'sec', key, label, tip });

const iPrev = html.indexOf('const BP_PREVIEW_PARAMS = [');
const fPrev = html.indexOf('];', iPrev) + 2;
const BP_PREVIEW_PARAMS = new Function('NUM', 'ENUM', 'COL', 'SEC',
  html.slice(iPrev, fPrev) + '; return BP_PREVIEW_PARAMS;')(NUMr, ENUMr, COLr, SECr);

const iDefs = html.indexOf('const NODE_TYPES = {') + 'const NODE_TYPES = {'.length;
const fDefs = html.indexOf('  image: {', iDefs);
const bloco = html.slice(iDefs, fDefs);
const BP = new Function('NUM', 'ENUM', 'COL', 'SEC', 'BP_PREVIEW_PARAMS',
  'return {' + bloco + '};')(NUMr, ENUMr, COLr, SECr, BP_PREVIEW_PARAMS);

const tipos = ['bpPrincipled', 'bpDiffuse', 'bpGlossy', 'bpGlass', 'bpEmission', 'bpTransparent', 'bpMixShader', 'bpAddShader'];
ok(tipos.every(t => BP[t]), 'os 8 nós de shader existem no NODE_TYPES', Object.keys(BP));
ok(tipos.every(t => BP[t].cat === 'shader'), 'todos na categoria shader');
ok(/shader:\s*\{ label: 'Shader \(Blender\)'/.test(html), 'categoria Shader (Blender) registrada em CATS');
ok(/Socket|SEC\('s_/.test(html) && html.includes("const SOCKET_COR = { color: '#c7c729', vector: '#6363c7', float: '#a1a1a1', shader: '#5ac85a' }"),
  'cores de socket do Blender (amarelo/azul/cinza/verde)');

const pr = BP.bpPrincipled;
const par = k => pr.params.find(p => p.key === k && p.type !== 'sec');
ok(JSON.stringify(pr.inputs) === JSON.stringify(['Base Color', 'Roughness', 'Metallic', 'Normal', 'Tangent', 'Coat Normal', 'Emission']),
  'Principled: sockets de entrada na ordem do Blender', pr.inputs);
ok(JSON.stringify(pr.socketTypes) === JSON.stringify(['color', 'float', 'float', 'vector', 'vector', 'vector', 'color']),
  'Principled: tipos dos sockets (Color/Float/Float/Vector/Vector/Vector/Color)', pr.socketTypes);
ok(JSON.stringify(pr.outs) === JSON.stringify(['BSDF']) && JSON.stringify(pr.outTypes) === JSON.stringify(['shader']),
  'Principled: saída é uma closure (verde)');

const bl = {
  cor: ['Base Color', '#cccccc'], metalico: ['Metallic', 0], rugosidade: ['Roughness', 0.5],
  ior: ['IOR', 1.45], alpha: ['Alpha', 1],
  subs: ['Subsurface Weight', 0], subsEscala: ['Subsurface Scale', 0.05], subsAniso: ['Subsurface Anisotropy', 0],
  subsIor: ['Subsurface IOR', 1.4],
  specNivel: ['Specular IOR Level', 0.5], aniso: ['Anisotropic', 0], anisoRot: ['Anisotropic Rotation', 0],
  trans: ['Transmission Weight', 0],
  coatPeso: ['Coat Weight', 0], coatRug: ['Coat Roughness', 0.03], coatIor: ['Coat IOR', 1.5],
  sheenPeso: ['Sheen Weight', 0], sheenRug: ['Sheen Roughness', 0.5],
  emisForca: ['Emission Strength', 0], filmeEsp: ['Thin Film Thickness', 0], filmeIor: ['Thin Film IOR', 1.33],
};
for (const [k, [rotulo, def]] of Object.entries(bl)) {
  const p = par(k);
  ok(!!p, `Principled: socket "${rotulo}" existe`, k);
  if (p) {
    ok(p.label === rotulo, `Principled: "${rotulo}" com o nome do Blender`, p.label);
    ok(p.def === def, `Principled: "${rotulo}" com o default do Blender`, [p.def, def]);
  }
}
for (const [k, hex] of [['cor', '#cccccc'], ['specTinta', '#ffffff'], ['coatTinta', '#ffffff'],
                        ['sheenTinta', '#ffffff'], ['emisCor', '#ffffff'], ['subsRaio', '#ff3319']]) {
  ok(par(k) && par(k).def === hex, `Principled: cor ${k} = ${hex}`, par(k) && par(k).def);
}
ok(par('rugosidade').min === 0 && par('rugosidade').max === 1 && par('rugosidade').step === 0.01,
  'Principled: Roughness 0..1 passo 0.01');
ok(par('ior').min === 1 && par('ior').max === 3, 'Principled: IOR 1..3');
ok(par('subsAniso').min === -1 && par('subsAniso').max === 1, 'Principled: Subsurface Anisotropy -1..1');
ok(BP.bpPrincipled.params.filter(p => p.type === 'sec').map(p => p.label).join('|') ===
  'Base|Subsurface|Specular|Transmission|Coat|Sheen|Emission|Thin Film|Preview',
  'Principled: seções recolhíveis (grupos do Blender)',
  BP.bpPrincipled.params.filter(p => p.type === 'sec').map(p => p.label));

ok(JSON.stringify(BP.bpDiffuse.inputs) === JSON.stringify(['Color', 'Roughness', 'Normal']), 'Diffuse: sockets');
ok(BP.bpDiffuse.params.find(p => p.key === 'rugosidade').def === 0, 'Diffuse: Roughness default 0 (Blender)');
ok(JSON.stringify(BP.bpGlossy.inputs) === JSON.stringify(['Color', 'Roughness', 'Normal', 'Tangent']), 'Glossy: sockets com Tangent');
ok(BP.bpGlossy.params.find(p => p.key === 'rugosidade').def === 0.5, 'Glossy: Roughness default 0.5');
ok(BP.bpGlossy.params.find(p => p.key === 'aniso').label === 'Anisotropic', 'Glossy: Anisotropic');
ok(BP.bpGlass.params.find(p => p.key === 'ior').def === 1.45, 'Glass: IOR default 1.45');
ok(BP.bpEmission.params.find(p => p.key === 'emisForca').def === 1, 'Emission: Strength default 1');
ok(BP.bpTransparent.params.find(p => p.key === 'alpha').def === 0, 'Transparent: alpha 0 (como no Blender)');
ok(JSON.stringify(BP.bpMixShader.socketTypes) === JSON.stringify(['shader', 'shader', 'float']),
  'Mix Shader: duas closures + fator', BP.bpMixShader.socketTypes);
ok(BP.bpMixShader.params.find(p => p.key === 'fator').def === 0.5, 'Mix Shader: Factor default 0.5');
ok(JSON.stringify(BP.bpAddShader.inputs) === JSON.stringify(['Shader (A)', 'Shader (B)']) && BP.bpAddShader.params.length === 0,
  'Add Shader: duas closures, sem controles');
ok(['bpPrincipled','bpDiffuse','bpGlossy','bpGlass','bpEmission','bpTransparent']
  .every(t => BP[t].params.some(p => p.type === 'sec')), 'os nós BSDF têm seções colapsáveis (grupos do Blender)');

/* ---------------- 2. GLSL × uniforms enviados ---------------- */
const iBsdf = html.indexOf('SHADERS.bsdf = `');
const iMix = html.indexOf('SHADERS.shaderMix = `');
ok(iBsdf > 0 && iMix > iBsdf, 'os dois programas novos estão no SHADERS');
const glslBsdf = html.slice(iBsdf, html.lastIndexOf('`;', iMix));
const glslMix = html.slice(iMix, html.indexOf('`;', iMix) + 2);
ok(glslBsdf.includes('void main()') && glslMix.includes('void main()'), 'ambos têm main()');

function uniformsDe(glsl) {
  const nomes = [];
  for (const m of glsl.matchAll(/uniform\s+\w+\s+([^;]+);/g)) {
    m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(n => nomes.push(n));
  }
  return nomes;
}
function chavesDoBloco(texto, inicio) {
  // pega as chaves dos objetos passados para draw(...): texMap e uniforms
  const i = texto.indexOf(inicio);
  const j = texto.indexOf('return mkRes(e);', i);
  const trecho = texto.slice(i, j);
  return new Set([...trecho.matchAll(/(\w+)\s*:/g)].map(m => m[1]));
}
const iRunBsdf = html.indexOf('function runBsdf(');
const iRunMix = html.indexOf('function runShaderMix(');
const envBsdf = chavesDoBloco(html.slice(iRunBsdf), "draw('bsdf'");
const envMix = chavesDoBloco(html.slice(iRunMix), "draw('shaderMix'");
for (const u of uniformsDe(glslBsdf)) ok(envBsdf.has(u), 'bsdf: uniform ' + u + ' é enviado pelo JS');
for (const u of uniformsDe(glslMix)) ok(envMix.has(u), 'shaderMix: uniform ' + u + ' é enviado pelo JS');
ok(uniformsDe(glslBsdf).length >= 30, 'bsdf: todos os sockets viram uniform', uniformsDe(glslBsdf).length);

for (const fn of ['bpD_GGX', 'bpD_GGXaniso', 'bpV_Smith', 'bpV_SmithAniso', 'bpFresnel', 'bpEnvBRDF',
                  'bpMS', 'bpD_Charlie', 'bpV_Neubelt', 'bpOrenNayar', 'bpThinFilm', 'bpLight', 'bpDielectricF0']) {
  ok(glslBsdf.includes('float ' + fn + '(') || glslBsdf.includes('vec3 ' + fn + '(') || glslBsdf.includes('vec2 ' + fn + '('),
    'GLSL: função ' + fn);
}
ok(glslBsdf.includes('pow(1.0 - bpSat(u), 5.0)'), 'GLSL: Fresnel de Schlick exato (potência 5)');
ok(glslBsdf.includes('if (uThinFilm > 0.0) F = bpThinFilm(F, uThinFilm, uThinIor, NoH);'), 'GLSL: película fina aplicada ao F0');
ok(!/\bfor\s*\(/.test(glslBsdf), 'GLSL: sem laço (as 3 luzes são chamadas literais)');
ok((glslBsdf.match(/bpLight\(m, Ns, V, T, Bv, vec3\(/g) || []).length === 3, 'GLSL: três luzes direcionais');
ok(glslBsdf.includes('bpMS(F0, NoV, m.rough)'), 'GLSL: compensação de energia múltipla no especular');
ok(glslMix.includes('mix(ca, cb, f)') && glslMix.includes('col = ca + cb;'), 'shaderMix: Mix e Add em luz linear');

/* ---------------- 3. matemática: GLSL → JS, por integração ---------------- */
const PI = Number(/#define BP_PI ([\d.]+)/.exec(glslBsdf)[1]);
ok(perto(PI, Math.PI, 1e-9), 'GLSL: BP_PI = π', PI);

function fnFloat(nome) {
  const marca = 'float ' + nome + '(';
  const i = glslBsdf.indexOf(marca);
  if (i < 0) return null;
  const j = glslBsdf.indexOf('{', i);
  let d = 0, k = j;
  for (; k < glslBsdf.length; k++) {
    if (glslBsdf[k] === '{') d++;
    else if (glslBsdf[k] === '}') { d--; if (!d) break; }
  }
  const params = glslBsdf.slice(glslBsdf.indexOf('(', i) + 1, j).trim().replace(/\)\s*$/, '');
  const corpo = glslBsdf.slice(j + 1, k).replace(/\bfloat (\w+)\s*=/g, 'let $1 =');
  const lista = params.split(',').map(s => s.trim().split(/\s+/).pop()).filter(Boolean);
  const f = new Function('bpSat', 'bpSq', 'BP_PI', 'max', 'min', 'sqrt', 'pow', 'clamp', 'exp2',
    'return function ' + nome + '(' + lista.join(',') + '){' + corpo + '};');
  return f(bpSatJs, x => x * x, PI, Math.max, Math.min, Math.sqrt, Math.pow,
    (x, a, b) => Math.min(b, Math.max(a, x)), x => Math.pow(2, x));
}
const bpSatJs = x => Math.min(1, Math.max(0, x));

const D_GGX = fnFloat('bpD_GGX'), V_Smith = fnFloat('bpV_Smith'), F1 = fnFloat('bpFresnel1'),
      D_Charlie = fnFloat('bpD_Charlie'), V_Neubelt = fnFloat('bpV_Neubelt'), F0d = fnFloat('bpDielectricF0');
ok(!!D_GGX && !!V_Smith && !!F1 && !!D_Charlie && !!V_Neubelt && !!F0d, 'funções escalares extraídas do GLSL');

// ∫ D(θh)·cosθh dω = 1 (normalização da NDF)
function integralD(fn, a, N = 2000) {
  let s = 0;
  for (let i = 0; i < N; i++) {
    const th = (i + 0.5) / N * (Math.PI / 2), ch = Math.cos(th), sh = Math.sin(th);
    s += fn(ch, a) * ch * sh * (Math.PI / 2 / N) * 2 * Math.PI;
  }
  return s;
}
for (const a of [0.05, 0.2, 0.5, 0.9]) {
  const v = integralD(D_GGX, a);
  ok(perto(v, 1, 0.02), `D_GGX(a=${a}) integra 1`, v.toFixed(4));
}
for (const r of [0.1, 0.3, 0.6]) {
  const v = integralD(D_Charlie, r);
  ok(perto(v, 1, 0.05), `D_Charlie(r=${r}) integra 1`, v.toFixed(4));
}
// Fresnel: F(0) = f0 e F(1) = 1 (rasante), monotônico
// u é o cosseno do ângulo de meia-verossimilhança: u=1 (normal) → F0, u=0 (rasante) → 1
ok(perto(F1(0.04, 1), 0.04, 1e-9) && perto(F1(0.04, 0), 1, 1e-9), 'Fresnel: u=1 ⇒ F0 e u=0 ⇒ 1 (rasante)');
let mono = true;
for (let i = 1; i <= 50; i++) if (F1(0.04, i / 50) > F1(0.04, (i - 1) / 50) + 1e-12) mono = false;
ok(mono, 'Fresnel: cresce em direção ao rasante');
ok(perto(F0d(1.45), Math.pow(0.45 / 2.45, 2), 1e-9), 'F0 dielétrico = ((η-1)/(η+1))² para IOR 1.45', F0d(1.45));
ok(perto(D_GGX(1, 0.5), 1 / (PI * 0.25), 1e-6), 'D_GGX no topo = 1/(π·α²) (α = rough²)');
// Smith: simétrico e positivo
ok(perto(V_Smith(0.3, 0.7, 0.4), V_Smith(0.7, 0.3, 0.4), 1e-12), 'Smith correlacionado simétrico em NoV/NoL');
ok(V_Smith(0.001, 0.999, 0.5) > 0 && V_Smith(1, 1, 1) > 0, 'Smith estritamente positivo (sem divisão por zero)');
ok(V_Neubelt(1, 1) > 0, 'Neubelt positivo no topo');
// Forno branco: albedo direcional do GGX com F = 1 não passa de 1 (e nunca é
// zero). Estimador por amostragem da NDF (H ~ D·NoH), que não sofre com o pico
// do lobo especular: f·NoL/pdf = 4·V·NoL·VoH/NoH.
function forno(a, NoV, N = 160) {
  const V = [Math.sqrt(Math.max(0, 1 - NoV * NoV)), 0, NoV];
  let soma = 0, cont = 0;
  for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
    // duas sequências descorrelacionadas (senão a amostragem fica enviesada)
    const u1 = ((ix + 0.5) / N + iy * 0.6180339887498949) % 1;
    const u2 = (iy + 0.5) / N;
    const phi = 2 * Math.PI * u2;
    const tanT = a * Math.sqrt(u1) / Math.sqrt(Math.max(1 - u1, 1e-9));
    const cosT = 1 / Math.sqrt(1 + tanT * tanT);
    const sinT = tanT * cosT;
    const H = [sinT * Math.cos(phi), sinT * Math.sin(phi), cosT];
    const VoH = V[0] * H[0] + V[1] * H[1] + V[2] * H[2];
    const L = [2 * VoH * H[0] - V[0], 2 * VoH * H[1] - V[1], 2 * VoH * H[2] - V[2]];
    const NoL = L[2];
    if (NoL <= 0 || VoH <= 0) { cont++; continue; }
    const NoH = cosT;
    soma += 4 * V_Smith(NoV, NoL, a) * NoL * VoH / NoH;
    cont++;
  }
  return soma / cont;
}
for (const a of [0.1, 0.3, 0.6, 0.9]) for (const NoV of [0.15, 0.6, 1]) {
  const v = forno(a, NoV);
  ok(v <= 1.005, `forno branco (α=${a}, NoV=${NoV}) ≤ 1`, v.toFixed(4));
  ok(v > 0.1, `forno branco (α=${a}, NoV=${NoV}) não é escuro`, v.toFixed(4));
}
// o GGX de um espalhamento perde energia com a rugosidade — é o que a
// compensação multiscatter (bpMS) devolve
{
  const serie = [0.1, 0.3, 0.6, 0.9].map(a => forno(a, 0.6));
  ok(serie.every((v, i) => i === 0 || v <= serie[i - 1] + 0.02), 'albedo do GGX cai com a rugosidade', serie.map(v => v.toFixed(3)));
  ok(serie[0] > serie[3], 'rugosidade alta perde mais energia que lisa', serie.map(v => v.toFixed(3)));
}
// bpMS: com F0 = 1 o ganho de energia é exatamente 1 (superfície branca não ganha luz)
const iMS = glslBsdf.indexOf('vec3 bpMS(');
const trechoMS = glslBsdf.slice(iMS, glslBsdf.indexOf('\n}', iMS));
ok(trechoMS.includes('float Ems = 1.0 - Ess;') && trechoMS.includes('vec3(1.0)/max(vec3(1.0) - Ems*Favg, vec3(1e-3))'),
  'bpMS: ganho = 1/(1 - Ems·Favg) — 1 quando F0 = 1');
{
  // espelho em JS do ajuste de envBRDF, só para checar a faixa do ganho
  const envBRDF = (NoV, rough) => {
    const r = [-1 * rough + 1, -0.0275 * rough + 0.0425, -0.572 * rough + 1.04, 0.022 * rough - 0.04];
    const a004 = Math.min(r[0] * r[0], Math.pow(2, -9.28 * NoV)) * r[0] + r[1];
    return [-1.04 * a004 + r[2], 1.04 * a004 + r[3]];
  };
  for (const rough of [0, 0.25, 0.5, 0.8]) for (const NoV of [0.1, 0.5, 1]) {
    const [x, y] = envBRDF(NoV, rough);
    const Ess = Math.min(1, Math.max(0, x + y));
    const Ems = 1 - Ess;
    ok(Ess > 0.3 && Ess <= 1, `Ess (albedo do split-sum) em faixa útil (rough=${rough}, NoV=${NoV})`, Ess.toFixed(3));
    // superfície metálica branca: Favg = 1 ⇒ ganho = 1/Ess, ou seja, o produto
    // albedo·ganho volta a 1 — a compensação devolve exatamente o perdido
    const ganho = 1 / Math.max(1 - Ems * 1, 1e-3);
    ok(perto(Ess * ganho, 1, 1e-6), `F0 = 1 ⇒ ganho 1/Ess e energia volta a 1 (rough=${rough})`, (Ess * ganho).toFixed(6));
    // dielétrico (F0 = 0.04): ganho pequeno e sempre ≥ 1
    const F0 = 0.04, Favg = F0 + (1 - F0) / 21;
    const gd = 1 / Math.max(1 - Ems * Favg, 1e-3);
    ok(gd >= 1 && gd < 1.06, `dielétrico recupera pouco e nunca menos que 1 (rough=${rough}, NoV=${NoV})`, gd.toFixed(4));
  }
}
// ganho total (difuso + especular) com base branca não passa de 1
for (const a of [0.1, 0.4, 0.8]) {
  const v = forno(a, 0.7);
  ok(v <= 1.005, `energia conservada (α=${a})`, v.toFixed(4));
}

/* ---------------- 4. execução: o código real do runner ---------------- */
// Extrai o bloco de verdade (bpNum … runShaderMix) e roda com stubs de GL: se
// algum parâmetro faltar, algum uniform ficar de fora ou a conta de fator
// quebrar, aqui estoura.
const iRunBloco = html.indexOf('function bpNum(');
const fRunBloco = html.indexOf('const RUN = {', iRunBloco);
ok(iRunBloco > 0 && fRunBloco > iRunBloco, 'bloco dos runners encontrado');
const BP_PADRAO = html.slice(html.indexOf('const BP_PADRAO = {'), html.indexOf('};', html.indexOf('const BP_PADRAO = {')) + 2);
const BP_MODELO = html.slice(html.indexOf('const BP_MODELO = {'), html.indexOf('};', html.indexOf('const BP_MODELO = {')) + 2);
const BP_ENTRADAS = html.slice(html.indexOf('const BP_ENTRADAS = {'), html.indexOf('\n};', html.indexOf('const BP_ENTRADAS = {')) + 3);
const BP_PREVIEW_N = Number(/const BP_PREVIEW = (\d+)/.exec(html)[1]);

const chamadas = [];
const alvo = { tex: 'TEX_ALVO', w: 640, h: 480 };
const API = new Function('draw', 'acquire', 'mkRes', 'blTexBranca', 'hexRgb01',
  BP_PADRAO + '\n' + BP_MODELO + '\n' + BP_ENTRADAS + '\nconst BP_PREVIEW = ' + BP_PREVIEW_N + ';\n' +
  html.slice(iRunBloco, fRunBloco) + '\nreturn { runBsdf, runShaderMix, bpNum };')(
  (prog, dest, texMap, uni) => chamadas.push({ prog, dest, texMap, uni }),
  (w, h) => ({ tex: 'TEX_ALVO', fbo: 'FBO', w, h }),
  e => ({ tex: e.tex, w: e.w, h: e.h, pooled: null }),
  () => 'TEX_BRANCA',
  h => { const v = hexToRgb(h); return [v[0] / 255, v[1] / 255, v[2] / 255]; });

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}
const paramsPadrao = def => Object.fromEntries(def.params.filter(p => p.type !== 'sec').map(p => [p.key, p.def]));

for (const t of tipos.filter(x => x.startsWith('bp') && !x.includes('Shader'))) {
  const n = { type: t, params: paramsPadrao(BP[t]) };
  chamadas.length = 0;
  let r = null, erro = null;
  try { r = API.runBsdf(n, [null, null, null, null, null, null, null]); } catch (e) { erro = e.message; }
  ok(!erro, `${t}: roda sem lançar (sem nenhuma entrada ligada)`, erro);
  ok(chamadas.length === 1 && chamadas[0].prog === 'bsdf', `${t}: desenha o programa bsdf`);
  ok(!!r && r.w === BP_PREVIEW_N && r.h === BP_PREVIEW_N, `${t}: devolve a esfera ${BP_PREVIEW_N}px`, r && [r.w, r.h]);
  const uni = chamadas[0].uni, tex = chamadas[0].texMap;
  ok(Object.keys(uni).length >= 40, `${t}: envia todos os uniforms (${Object.keys(uni).length})`);
  ok(Object.values(tex).every(v => v === 'TEX_BRANCA'), `${t}: sem entrada usa a textura branca`);
  ok(uni.uHasBase === 0 && uni.uHasNormal === 0, `${t}: nenhum mapa marcado como ligado`);
  ok(uni.uModel === ({ bpPrincipled: 0, bpDiffuse: 1, bpGlossy: 2, bpGlass: 3, bpEmission: 4, bpTransparent: 5 })[t],
    `${t}: modelo certo no shader`, uni.uModel);
}

// os defaults do Blender chegam no shader
{
  const n = { type: 'bpPrincipled', params: paramsPadrao(BP.bpPrincipled) };
  chamadas.length = 0;
  API.runBsdf(n, [null, null, null, null, null, null, null]);
  const u = chamadas[0].uni;
  ok(perto(u.uMetallic, 0) && perto(u.uRough, 0.5) && perto(u.uIor, 1.45), 'Principled: Metallic/Roughness/IOR chegam no shader',
    [u.uMetallic, u.uRough, u.uIor]);
  ok(perto(u.uBase[0], 0.8, 0.005), 'Principled: Base Color 0.8 → uBase 0.8 (cinza do Blender)', u.uBase);
  ok(perto(u.uSpecLevel, 0.5) && perto(u.uSpecTint[0], 1), 'Principled: Specular IOR Level 0.5 + Tint branco');
  ok(perto(u.uAlpha, 1) && perto(u.uTrans, 0) && perto(u.uCoatW, 0) && perto(u.uSheenW, 0), 'Principled: Alpha 1, sem transmissão/coat/sheen');
  ok(perto(u.uSssRadius[0], 1) && perto(u.uSssRadius[1], 0.2, 0.005) && perto(u.uSssRadius[2], 0.1, 0.005),
    'Principled: Subsurface Radius (1, 0.2, 0.1)', u.uSssRadius);
  // mexer no painel muda o uniform (é o "gesto" do slider, sem recompilar)
  n.params.rugosidade = 0.85; n.params.metalico = 1; n.params.cor = '#ff8800';
  chamadas.length = 0;
  API.runBsdf(n, [null, null, null, null, null, null, null]);
  ok(perto(chamadas[0].uni.uRough, 0.85) && perto(chamadas[0].uni.uMetallic, 1), 'slider de Roughness/Metallic atualiza o shader');
  ok(perto(chamadas[0].uni.uBase[0], 1) && perto(chamadas[0].uni.uBase[1], 0x88 / 255, 0.002),
    'trocar a Base Color atualiza o shader', chamadas[0].uni.uBase);
}

// ligar uma imagem numa entrada muda o uniform e usa a textura do fio
{
  const n = { type: 'bpPrincipled', params: paramsPadrao(BP.bpPrincipled) };
  const entrada = { tex: 'TEX_BASE', w: 800, h: 600 };
  chamadas.length = 0;
  API.runBsdf(n, [entrada, null, null, null, null]);
  ok(chamadas[0].uni.uHasBase === 1, 'Base Color ligada marca uHasBase');
  ok(chamadas[0].texMap.uSrc === 'TEX_BASE', 'Base Color ligada usa a textura do fio');
  chamadas.length = 0;
  API.runBsdf(n, [null, null, null, { tex: 'TEX_NRM' }, null]);
  ok(chamadas[0].uni.uHasNormal === 1 && chamadas[0].texMap.uSrcNormal === 'TEX_NRM', 'Normal ligada usa o mapa de normal');
  chamadas.length = 0;
  API.runBsdf(n, [null, { tex: 'TEX_R' }, { tex: 'TEX_M' }, null, null]);
  ok(chamadas[0].uni.uHasRough === 1 && chamadas[0].uni.uHasMetal === 1, 'Roughness/Metallic ligados marcam os mapas');
  // Glossy: o 4º socket é Tangent e não deve ser confundido com Normal
  const g = { type: 'bpGlossy', params: paramsPadrao(BP.bpGlossy) };
  chamadas.length = 0;
  API.runBsdf(g, [null, null, { tex: 'TEX_N' }, { tex: 'TEX_T' }]);
  ok(chamadas[0].texMap.uSrcNormal === 'TEX_N' && chamadas[0].uni.uHasNormal === 1, 'Glossy: Normal é o 3º socket');
  ok(chamadas[0].texMap.uSrcTang === 'TEX_T' && chamadas[0].uni.uHasTang === 1, 'Glossy: Tangent (4º socket) vai para o eixo da anisotropia');
  const pn = { type: 'bpPrincipled', params: paramsPadrao(BP.bpPrincipled) };
  chamadas.length = 0;
  API.runBsdf(pn, [null, null, null, null, { tex: 'TEX_TG' }, { tex: 'TEX_CN' }, null]);
  ok(chamadas[0].uni.uHasTang === 1 && chamadas[0].texMap.uSrcTang === 'TEX_TG', 'Principled: socket Tangent ligado');
  ok(chamadas[0].uni.uHasCoatN === 1 && chamadas[0].texMap.uSrcCoatN === 'TEX_CN', 'Principled: socket Coat Normal ligado');
}

// Mix / Add Shader
{
  const A = { tex: 'TEX_A', w: 512, h: 512 }, B = { tex: 'TEX_B', w: 300, h: 200 };
  const mix = { type: 'bpMixShader', params: { fator: 0.5, fatorDe: 'valor' } };
  chamadas.length = 0;
  let r = API.runShaderMix(mix, [A, B, null]);
  ok(chamadas[0].prog === 'shaderMix' && perto(chamadas[0].uni.uFactor, 0.5) && chamadas[0].uni.uMode === 0, 'Mix Shader: fator 0.5 em modo Mix');
  ok(r.w === 512 && r.h === 512, 'Mix Shader: usa o tamanho do maior fio', [r.w, r.h]);
  chamadas.length = 0;
  API.runShaderMix(mix, [A, null, null]);
  ok(perto(chamadas[0].uni.uFactor, 0), 'Mix Shader: só A ⇒ fator 0 (resultado é A)');
  chamadas.length = 0;
  API.runShaderMix(mix, [null, B, null]);
  ok(perto(chamadas[0].uni.uFactor, 1), 'Mix Shader: só B ⇒ fator 1 (resultado é B)');
  ok(API.runShaderMix(mix, [null, null, null]) === null, 'Mix Shader sem nada ligado não desenha');
  chamadas.length = 0;
  API.runShaderMix({ type: 'bpMixShader', params: { fator: 0.3, fatorDe: 'imagem' } }, [A, B, { tex: 'TEX_F' }]);
  ok(chamadas[0].uni.uUseFac === 1 && chamadas[0].texMap.uSrcFac === 'TEX_F', 'Mix Shader: fator vindo de imagem');
  chamadas.length = 0;
  API.runShaderMix({ type: 'bpAddShader', params: {} }, [A, B]);
  ok(chamadas[0].uni.uMode === 1, 'Add Shader: soma as closures (uMode 1)');
}

/* ---------------- 5. UI: cor e tipo de cada socket ---------------- */
const iSock = html.indexOf("const SOCKET_IMAGE = ");
const fSock = html.indexOf('\nconst BLEND = [', iSock);
const blocoSock = html.slice(iSock, fSock);
const UI = new Function('NODE_TYPES', blocoSock + '\nreturn { socketTipoDe, socketPreparar, SOCKET_COR, SOCKET_IMAGE };')(BP);
const NS = { ...BP, mix: { inputs: ['A', 'B'], params: [] } };   // nó antigo, sem tipos declarados
Object.assign(BP, { mix: NS.mix });

const el = () => ({ style: {}, dataset: {} });
{
  const n = { type: 'bpPrincipled' };
  const casos = [
    [0, 'in', '#c7c729', 'color'], [1, 'in', '#a1a1a1', 'float'], [2, 'in', '#a1a1a1', 'float'],
    [3, 'in', '#6363c7', 'vector'], [4, 'in', '#6363c7', 'vector'], [5, 'in', '#6363c7', 'vector'],
    [6, 'in', '#c7c729', 'color'], [0, 'out', '#5ac85a', 'shader'],
  ];
  for (const [i, io, cor, tipo] of casos) {
    const s = el();
    UI.socketPreparar(s, n, i, io);
    ok(s.style.background === cor, `Principled: socket ${io}[${i}] com a cor do Blender (${tipo})`, s.style.background);
    ok(s.dataset.tipo === tipo, `Principled: socket ${io}[${i}] marcado como ${tipo}`, s.dataset.tipo);
    ok(typeof s.title === 'string' && new RegExp(tipo === 'shader' ? 'Shader Closure' : tipo, 'i').test(s.title), `Principled: tooltip do socket ${io}[${i}]`, s.title);
  }
  const sMix = el();
  UI.socketPreparar(sMix, { type: 'bpMixShader' }, 0, 'in');
  ok(sMix.style.background === '#5ac85a' && sMix.dataset.tipo === 'shader', 'Mix Shader: entrada é closure (verde)');
  const sOld = el();   // nó comum do editor: continua amarelo e sem dataset.tipo
  UI.socketPreparar(sOld, { type: 'mix' }, 0, 'in');
  ok(sOld.style.background === UI.SOCKET_IMAGE && sOld.dataset.tipo === undefined, 'nós antigos seguem com o socket amarelo de sempre');
  ok(UI.SOCKET_COR.color === '#c7c729' && UI.SOCKET_COR.vector === '#6363c7'
    && UI.SOCKET_COR.float === '#a1a1a1' && UI.SOCKET_COR.shader === '#5ac85a', 'as quatro cores do Blender');
  ok(html.includes('socketPreparar(s, n, i, \'in\')') && html.includes('socketPreparar(s, n, k, \'out\')'),
    'buildNodeEl aplica as cores nos sockets de entrada e saída');
}

/* ---------------- resumo ---------------- */
console.log(`\n${passaram} passaram, ${falharam} falharam`);
if (falharam) { falhas.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
