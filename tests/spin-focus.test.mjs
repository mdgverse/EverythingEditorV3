/* Editor 3.0 — efeito "Spin Focus Light Leak": parâmetros, shader e uniforms. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const recorta = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

console.log('Spin Focus Light Leak');

/* ---------- definição do nó ---------- */
const def = recorta('  spinFocus: {', '    title: \'Transform\'');
ok(/title: 'Spin Focus Light Leak'/.test(def), 'nome do preset', 'title');
ok(/cat: 'style'/.test(def), 'entra na categoria de estilo (junto do Spin Blur)');
ok(/inputs: \['Image'\]/.test(def), 'aplica em qualquer imagem/camada');
ok(/kw: '[^']*spin[^']*light leak[^']*/.test(def), 'palavras-chave para a busca', 'kw');

const pedidos = [
  ['Center Focus Size', /NUM\('core', 'Center Focus Size', \d+, \d+, \d+\)/],
  ['Spin Blur Strength', /NUM\('strength', 'Spin Blur Strength', 0, 100, 70\)/],
  ['Spin Blur Quality', /NUM\('samples', 'Spin Blur Quality', 8, 64, 32, 1\)/],
  ['Light Leak Intensity', /NUM\('leak', 'Light Leak Intensity', 0, 100, 50\)/],
  ['Light Leak Warmth', /NUM\('warmth', 'Light Leak Warmth', 0, 100, 78\)/],
  ['Vignette Strength', /NUM\('vig', 'Vignette Strength', 0, 100, 35\)/],
];
for (const [nome, re] of pedidos) ok(re.test(def), 'controle: ' + nome);
ok(/ENUM\('blend', 'Leak blend', \[\['screen', 'Screen'\], \['add', 'Add'\], \['overlay', 'Overlay'\]\], 'screen'\)/.test(def),
  'blend do leak: Screen / Add / Overlay', 'blend');
ok(/NUM\('centerX', 'Center X'/.test(def) && /NUM\('centerY', 'Center Y'/.test(def), 'posição do núcleo ajustável');

/* ---------- shader ---------- */
const sh = recorta('  spinFocusFx: `', '  /* Spin Blur (standalone)');
ok(/smoothstep\(uCore, uCore \+ uCoreSoft, r\)/.test(sh), 'rampa: zero no núcleo → máximo na borda', 'ramp');
ok(/float ang = uSweep \* \(t - 0\.5\) \* ramp;/.test(sh), 'giro proporcional à rampa (spin tangencial)');
ok(/for \(int i = 0; i < 64; i\+\+\) \{\s*if \(i >= uCount\) break;/.test(sh), 'amostras controladas por uCount (limite 64)');
ok(/uChroma \* 0\.005 \* ramp/.test(sh), 'aberração cromática só na zona girada', 'chroma');
ok(/base\.r = mix/.test(sh) && /base\.b = mix/.test(sh), 'canais R/B deslocados');
ok(/eeLeaks\(/.test(sh) && /vec3\(1\.00, 0\.78, 0\.36\)/.test(sh), 'light leaks quentes procedurais', 'leaks');
ok(/vec3\(1\.00, 0\.34, 0\.60\)/.test(sh), 'magenta suave no alto (film burn)');
ok(/vec3\(1\.00, 0\.52, 0\.16\)/.test(sh), 'âmbar no canto inferior');
ok(/uWarmth/.test(sh), 'temperatura do leak no shader');
ok(/uBlend == 1/.test(sh) && /uBlend == 2/.test(sh) && /\(1\.0 - base\) \* \(1\.0 - clamp\(lk/.test(sh), 'Screen, Add e Overlay no shader');
ok(/smoothstep\(0\.35, 1\.05, r\)/.test(sh), 'vignette nos cantos');
ok(/outColor = vec4\(clamp\(outc, 0\.0, 1\.0\), 1\.0\);/.test(sh), 'saída normalizada');
ok(!/\bqTime\b|uTime/.test(sh), 'determinístico: sem tempo, export = preview', 'sem tempo');
const equilibrio = (sh.match(/\{/g) || []).length === (sh.match(/\}/g) || []).length;
ok(equilibrio, 'chaves equilibradas no GLSL');

/* ---------- execução: uniformes calculados a partir dos parâmetros ---------- */
const corpo = recorta('  spinFocus: (n, [a]) => {', '  transform: (n, [a]) => {')
  .replace(/^\s*spinFocus:\s*/, '')
  .replace(/,\s*$/, '');
let uni = null;
const render = new Function('pointOp', 'const f = ' + corpo + '; return f;')(
  (a, prog, u) => { uni = { prog, u }; return { ok: true }; }
);
const n = { params: { centerX: 50, centerY: 40, core: 40, coreSoft: 22, strength: 70, samples: 32, leak: 50, warmth: 78, vig: 35, haze: 30, chroma: 25, blend: 'screen' } };
const r = render(n, [{ w: 1600, h: 1000, tex: 1 }]);
ok(r && r.ok, 'renderiza sem imagem nula');
ok(uni.prog === 'spinFocusFx', 'usa o programa spinFocusFx (mesmo nome que está em SHADERS)', uni.prog);
ok(Math.abs(uni.u.uCenter[0] - 0.5) < 1e-9 && Math.abs(uni.u.uCenter[1] - 0.6) < 1e-9, 'centro convertido (y invertido)', uni.u.uCenter);
ok(Math.abs(uni.u.uAspect - 1.6) < 1e-9, 'proporção da imagem', uni.u.uAspect);
ok(Math.abs(uni.u.uSweep - 0.7 * 55 * Math.PI / 180) < 1e-9, 'força vira ângulo de giro', uni.u.uSweep);
ok(uni.u.uCount === 32, 'qualidade vira número de amostras', uni.u.uCount);
ok(Math.abs(uni.u.uLeak - 0.50) < 1e-9 && Math.abs(uni.u.uWarmth - 0.78) < 1e-9, 'leak e temperatura em 0..1');
ok(Math.abs(uni.u.uVig - 0.35) < 1e-9, 'vignette em 0..1');
ok(uni.u.uBlend === 0, 'blend screen = 0', uni.u.uBlend);
const add = render({ params: { ...n.params, blend: 'add', samples: 999 } }, [{ w: 10, h: 10, tex: 1 }]);
ok(uni.u.uBlend === 1 && uni.u.uCount === 64, 'add = 1 e amostras limitadas a 64', [uni.u.uBlend, uni.u.uCount]);
render({ params: { ...n.params, blend: 'overlay', samples: 1 } }, [{ w: 10, h: 10, tex: 1 }]);
ok(uni.u.uBlend === 2 && uni.u.uCount === 8, 'overlay = 2 e amostras no mínimo 8', [uni.u.uBlend, uni.u.uCount]);
ok(!!add, 'desenha também no modo add');
ok(render({ params: n.params }, [null]) === null, 'sem imagem de entrada não desenha');

/* ---------- uniformes inteiros declarados ---------- */
ok(/const INT_UNIFORMS = new Set\(\[[\s\S]*'uCount', 'uBlend'/.test(html), 'uCount/uBlend entram como int no WebGL');

/* ---------- registrado no dicionário de shaders ---------- */
ok(/const SHADERS = \{/.test(html), 'dicionário de shaders existe');
ok((html.match(/spinFocusFx: `/g) || []).length === 1, 'shader registrado uma única vez');

process.exit(resumo() ? 0 : 1);
