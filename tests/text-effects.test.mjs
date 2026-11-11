/* Text as an independent RGBA source: direct effects must keep the pixels
   outside the glyphs transparent, antialiased edges must not pick up the
   black RGB of transparent neighbours, and glow must own alpha outside the
   glyphs (no hidden black background and no Layer Position required). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const shader = name => {
  const m = new RegExp(`\\n  ${name}: \`([\\s\\S]*?)\`,\\n`).exec(html);
  return m ? m[1] : '';
};

console.log('Text → efeitos (RGBA direto)');

/* ---------- o Text solto nasce transparente, sem fundo ---------- */
ok(/if \(!a\) \{[\s\S]*?fx7NewCanvas\(S, S\)[\s\S]*?paintTextQ\(cv\.getContext\('2d'\), p, txt, S, S\)/.test(html),
  'Text sem imagem conectada rasteriza sobre canvas transparente');
ok(/text: \(n, \[a\]\) => drawTextNode\(n, a\)/.test(html), 'a saída do Text alimenta efeitos diretamente');

/* ---------- reamostragem em espaço pré-multiplicado (sem halo) ---------- */
ok(shader('premultiply').includes('s.rgb * s.a'), 'premultiply grava RGB pré-multiplicado pelo alfa');
ok(shader('unpremultiply').includes('s.rgb / s.a'), 'unpremultiply volta para RGBA straight ao gravar');
ok(/function spatialOp\(a, prog, uni, extra\)/.test(html) &&
   /draw\('premultiply', pre/.test(html) && /draw\('unpremultiply', out/.test(html),
  'spatialOp envolve o passe espacial com premultiply/unpremultiply');
ok(/return spatialOp\(a, 'transform'/.test(html), 'Transform reamostra sem halo escuro');
ok(/return spatialOp\(a, 'flip'/.test(html), 'Mirror reamostra sem halo escuro');
ok(/spatialOp\(a, 'perspectiveFx'/.test(html) && /spatialOp\(a, 'twistBend'/.test(html),
  'Perspective Warp e Twist/Bend reamostram sem halo escuro');
ok(/function gaussianBlurRes\(a, sigma\)/.test(html) && /draw\('premultiply', pre/.test(html),
  'Blur gaussiano roda em espaço pré-multiplicado');
ok(/return gaussianBlurRes\(a, sigma \* Math\.sqrt\(passes\)\)/.test(html), 'Blur usa o passe pré-multiplicado');
ok(/const blurred = gaussianBlurRes\(a, p\.radius\)/.test(html), 'Sharpen usa o blur pré-multiplicado');

/* ---------- glow/bloom/halation expandem o alfa ---------- */
const down = shader('bloomDown');
ok(/vec4 pre\(vec4 s\)/.test(down) && /if \(uPre < 0\.5\) return s;/.test(down),
  'pirâmide do glow preserva o RGBA pré-multiplicado nos níveis profundos');
ok(/\* s\.a;/.test(down) && /return vec4\(\(uUseTint > 0\.5 \? uTint : s\.rgb\) \* k, k\)/.test(down),
  'o bright-pass do glow é ponderado pelo alfa da fonte (transparente não brilha)');
const comp = shader('bloomComp');
ok(/float oa = s\.a \+ ga \* \(1\.0 - s\.a\);/.test(comp),
  'Bloom/Glow/Halation compõem o halo atrás da fonte e expandem o alfa');
ok(!/outColor = vec4\(mix\(s\.rgb, sc, a\), s\.a\);/.test(comp),
  'o glow não fica mais preso ao alfa original da fonte');
const add = shader('addGlow');
ok(/float oa = s\.a \+ ga \* \(1\.0 - s\.a\);/.test(add), 'o glow aditivo do Glitch também expande o alfa');

/* ---------- efeitos de cor preservam o alfa; sombra usa o alfa ---------- */
ok(/outColor = vec4\(clamp\(c \/ 255\.0, 0\.0, 1\.0\), s\.a\);/.test(shader('brightness')),
  'Brightness/Contrast preserva o alfa');
ok(/o\[i \+ 3\] = sd\[i \+ 3\];/.test(html), 'Color correction (CPU) preserva o alfa');
ok(/ctx\.shadowColor = p\.colorA/.test(html) && /function fx16Shadow/.test(html),
  'Shadow deriva a sombra do alfa da fonte');

process.exit(resumo() ? 0 : 1);
