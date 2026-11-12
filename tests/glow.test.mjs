/* Glow (Lightroom-style, 1.4.0): substituição completa do nó Glow.
   Painel Glow/Style/Range/Spread/Warmth/Direction/Saturation, 5 estilos
   (Bloom, Diffusion, Halation, Motion, Streak) e o pipeline em passos:
   highlights → espalhamento por estilo → warmth/saturação → Screen. */
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
const shader = nome => extrai('  ' + nome + ': `', '`,\n');

const NUM = (key, label, min, max, def, step = 1) => ({ type: 'num', key, label, min, max, def, step });
const ENUM = (key, label, options, def) => ({ type: 'enum', key, label, options, def });
const blocoNo = extrai("  glowEffect: {\n    title: 'Glow'", '  invertGhost: {').replace(/^\s*glowEffect:\s*/, '').replace(/,\s*$/, '');
const noDef = new Function('NUM', 'ENUM', 'return (' + blocoNo + ')')(NUM, ENUM);
const por = Object.fromEntries(noDef.params.map(d => [d.key, d]));

console.log('Glow · painel (Lightroom > Effects > Glow)');

ok(noDef.title === 'Glow' && noDef.cat === 'lens' && JSON.stringify(noDef.inputs) === JSON.stringify(['Image']),
  'nó Glow na categoria lens, socket Image');
ok(JSON.stringify(noDef.params.map(d => d.key)) === JSON.stringify(['glow', 'style', 'range', 'spread', 'warmth', 'direction', 'saturation']),
  'ordem do painel: Glow, Style, Range, Spread, Warmth, Direction, Saturation');
ok(por.glow.min === 0 && por.glow.max === 100 && por.glow.def === 0, 'Glow 0–100, default 0 (original intocado)');
ok(JSON.stringify(por.style.options.map(o => o[0])) === JSON.stringify(['bloom', 'diffusion', 'halation', 'motion', 'streak'])
  && por.style.def === 'bloom', 'Style com os 5 estilos: Bloom, Diffusion, Halation, Motion, Streak');
ok(por.range.min === 0 && por.range.max === 100 && por.spread.min === 0 && por.spread.max === 100,
  'Range e Spread 0–100');
ok(por.warmth.min === -100 && por.warmth.max === 100 && por.warmth.def === 0, 'Warmth −100…+100, default 0');
ok(por.direction.min === -180 && por.direction.max === 180 && por.direction.def === -90,
  'Direction −180…+180, default −90 (vertical, como no vídeo)');
ok(por.saturation.min === 0 && por.saturation.max === 100 && por.saturation.def === 100,
  'Saturation 0–100 do glow, default 100 (cor natural)');
ok(!('threshold' in por) && !('radius' in por) && !('intensity' in por), 'parâmetros antigos (threshold/radius/intensity) removidos');

console.log('Glow · regras puras');

const puro = extrai('/* GLOW_PURO_INI */', '/* GLOW_PURO_FIM */');
const P = new Function(puro + '\nreturn { GLOW_VIS, GLOW_HAL_TINT, glowKeysVisiveis, glowLimiar, glowNiveis, glowTrailLen, glowWarmTint };')();

ok(!P.glowKeysVisiveis({ style: 'bloom' }).has('direction') && !P.glowKeysVisiveis({ style: 'diffusion' }).has('direction')
  && !P.glowKeysVisiveis({ style: 'halation' }).has('direction'), 'Direction escondido em Bloom/Diffusion/Halation');
ok(P.glowKeysVisiveis({ style: 'motion' }).has('direction') && P.glowKeysVisiveis({ style: 'streak' }).has('direction'),
  'Direction visível só em Motion e Streak');
ok(['bloom', 'diffusion', 'halation', 'motion', 'streak'].every(st =>
  ['glow', 'style', 'range', 'spread', 'warmth', 'saturation'].every(k => P.glowKeysVisiveis({ style: st }).has(k))),
  'Glow/Style/Range/Spread/Warmth/Saturation visíveis em todos os estilos');
ok(Math.abs(P.glowLimiar(4) - 0.96) < 1e-9 && P.glowLimiar(100) === 0 && Math.abs(P.glowLimiar(18) - 0.82) < 1e-9,
  'Range vira limiar: 4 → 0.96 (só os brilhos mais fortes, como no vídeo), 18 → 0.82, 100 → 0');
ok(P.glowNiveis(0) === 2 && P.glowNiveis(100) === 7 && P.glowNiveis(50) > P.glowNiveis(10),
  'Spread controla os níveis da pirâmide (2–7, monotônico)');
ok(P.glowTrailLen(0, 800, 600) === 0 && P.glowTrailLen(100, 800, 600) === 400 && P.glowTrailLen(25, 800, 600) === 100,
  'Spread controla o comprimento do rastro (0–50% do maior lado do buffer)');
const frio = P.glowWarmTint(-50), quente = P.glowWarmTint(100), neutro = P.glowWarmTint(0);
ok(neutro[0] === 1 && neutro[1] === 1 && neutro[2] === 1, 'Warmth 0 = neutro');
ok(frio[2] > 1 && frio[0] < 1, 'Warmth −50 (vídeo) desloca o glow para o ciano/azul');
ok(quente[0] > 1 && quente[2] < 1, 'Warmth +100 desloca o glow para o quente (laranja/vermelho)');
ok(P.GLOW_HAL_TINT[0] > 1 && P.GLOW_HAL_TINT[2] < 0.5, 'tint da Halation é quente/avermelhado');

console.log('Glow · pipeline (shaders)');

const ext = shader('glowExtract');
ok(/smoothstep\(uThr, uThr \+ 0\.15, lum\) \* lum/.test(ext), 'passo 1: máscara = smoothstep(Range, Range + 0.15, luminância) × luminância');
ok(/vec4\(s\.rgb \* m \* s\.a, m \* s\.a\) \* 0\.5/.test(ext), 'buffer premultiplicado com headroom (escala 1/2, sem clipar)');
ok(/pow\(m, uPower\)/.test(ext) && /uHal > 0\.5/.test(ext), 'power curve (Streak/Halation) e núcleo denso da Halation na extração');

const trail = shader('glowTrail');
ok(/for \(int i = 1; i <= 48; i\+\+\)/.test(trail), 'Motion/Streak: 48 amostras de cada lado (97 taps ≥ 32 exigidos)');
ok(/exp\(-3\.0 \* t\)/.test(trail), 'falloff exponencial ao longo do rastro (contínuo, sem fantasmas)');
ok(/uDir \* \(t \* uLen\)/.test(trail), 'rastro anisotrópico ao longo de Direction (não radial)');

const grade = shader('glowGrade');
ok(/mix\(vec3\(lum\), g\.rgb, uSat\)/.test(grade), 'passo 4: Saturation só na camada de glow');
ok(/g\.rgb \*= uTint/.test(grade) && /uCA > 0\.001/.test(grade), 'Warmth via tint + aberração cromática radial da Halation');
ok(/outColor = g \* 2\.0/.test(grade), 'headroom da extração desfeito no grade');

const comp = shader('glowComp2');
ok(/1\.0 - \(1\.0 - s\.rgb\) \* \(1\.0 - c\)/.test(comp), 'passo 5: composite em Screen (nunca escurece o original)');
ok(/mix\(s\.rgb, sc, ga\)/.test(comp), 'original misturado em direção ao Screen — base nunca borrada');
ok(/uDiff > 0\.5/.test(comp) && /\(1\.0 - lum\) \* 0\.35/.test(comp), 'Diffusion: véu leitoso levanta os meios-tons perto da luz');

console.log('Glow · fiação');

const run = funcao('runGlowV2');
ok(/if \(!\(glow > 0\)\) return ptRes\(a\)/.test(run), 'Glow = 0 devolve o original sem custo (passthrough)');
ok(/estilo|style === 'motion'/.test(run) && /style === 'streak'/.test(run) && /dir \+ Math\.PI \/ 2/.test(run),
  'Streak: eixo principal + eixo perpendicular curto (anamórfico em 2 eixos)');
ok(/style === 'diffusion'/.test(run) && /o\.levels \+ 1/.test(run), 'Diffusion usa um nível a mais de pirâmide (mais leitoso)');
ok(/glowWarmTint\(p\.warmth/.test(run) && /GLOW_HAL_TINT/.test(run), 'Warmth aplicado no runner; Halation soma o tint quente');
ok(/glowEffect: \(n, \[a\]\) => runGlowV2\(n, a\)/.test(html), 'RUN.glowEffect usa o pipeline novo');
ok(!/p\.threshold|p\.radius|p\.intensity/.test(run), 'runner não lê mais os parâmetros antigos');
ok(/function glowAplicaVis/.test(html) && /n\.type === 'glowEffect'\) glowAplicaVis\(body, n\.params\)/.test(html)
  && /n\.type === 'glowEffect' && p\.key === 'style' && n\.el\) glowAplicaVis\(n\.el, n\.params\)/.test(html),
  'visibilidade contextual ligada ao buildControls e à troca de Style');

process.exit(resumo() ? 0 : 1);
