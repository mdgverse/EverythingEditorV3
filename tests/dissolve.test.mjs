/* Dissolve nos três lugares onde o usuário mistura camadas:
   Layer Position (GPU e Canvas 2D), nó Mix e nó Layer mix.
   Dissolve não é uma função de cor nem um globalCompositeOperation:
   pixels inteiros trocam de lado, com probabilidade = fator × alfa
   efetivo da camada de cima; o pixel trocado entra com alfa cheio. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extrai = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim, a);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};
const shader = name => {
  const corpo = extrai(`\n  ${name}: \``, '`,\n');
  return corpo;
};

console.log('Dissolve · Layer Position, Mix e Layer mix');

/* ---------- a lista geral e o índice do modo ---------- */
const blendList = extrai('const BLEND = [', '];');
const modos = [...blendList.matchAll(/\['(\w+)',/g)].map(m => m[1]);
ok(modos.indexOf('dissolve') === 26, 'Dissolve é o modo 26 da lista BLEND', modos.indexOf('dissolve'));
ok(/for \(const \[k, lbl\] of BLEND\)/.test(html), 'o Layer Position monta o select a partir de BLEND (Dissolve incluído)');
ok(/ENUM\('mode', 'Mode', BLEND, 'normal'\)/.test(html), 'o nó Mix monta os modos a partir de BLEND (Dissolve incluído)');

/* ---------- Layer Position (GPU) ---------- */
const over = shader('layerOver');
ok(/if \(uMode == 26\)/.test(over) && /h < ab \? vec4\(b\.rgb, 1\.0\) : a/.test(over),
  'Layer Position: pixel sorteado entra com a cor de cima e alfa cheio');
const clip = shader('layerClip');
ok(/if \(uMode == 26\)/.test(clip) && /vec4\(top\.rgb, base\.a\)/.test(clip),
  'clipping do Layer Position: dissolve mantém o alfa da camada base');
ok(/uMode: Math\.max\(0, BLEND\.findIndex\(m => m\[0\] === P\.blend\)\)/.test(html),
  'o blend de cada camada chega ao shader pelo índice da lista');

/* ---------- Layer Position (Canvas 2D) ---------- */
ok(/function dissolveCanvasOnto\(ctx, srcCanvas\)/.test(html), 'o motor Canvas 2D tem dissolve pixel a pixel');
ok(/function dissolveClippedCanvasOnto\(ctx, clippedCanvas\)/.test(html), 'o clipping Canvas 2D tem a variante que preserva o alfa base');
ok(/if \(o\.blend === 'dissolve'\) \{ dissolveClippedCanvasOnto\(ctx, clipped\); return out; \}/.test(html),
  'composeLayerClipCanvas2D desvia para o dissolve (sem globalCompositeOperation inválido)');
ok(/if \(P\.blend === 'dissolve'\) dissolveCanvasOnto\(octx, grp\);/.test(html),
  'renderLayerStackCanvas2D desvia para o dissolve');

/* ---------- nó Mix ---------- */
const mistura = extrai('SHADERS.misturaBl = `', '`;');
ok(/float prob = clamp\(f, 0\.0, 1\.0\) \* b\.a;/.test(mistura),
  'Mix: a probabilidade do dissolve é fator × alfa de B');
ok(/outColor = h < prob \? vec4\(b\.rgb, 1\.0\) : a;/.test(mistura),
  'Mix: pixel sorteado é o B com alfa cheio (funciona sobre A transparente)');
ok(!/outColor = vec4\(h < f \? b\.rgb : a\.rgb, a\.a\);/.test(mistura),
  'Mix: o dissolve não herda mais o alfa de A');
const generico = shader('mix');
ok(/float prob = clamp\(uFac, 0\.0, 1\.0\) \* b\.a;/.test(generico),
  'o shader mix genérico usa a mesma semântica de dissolve');

/* ---------- nó Layer mix ---------- */
const def = extrai("  layerMix: {\n    title:", "  hueCurves: {");
ok(/\['dissolve', 'Dissolve'\]/.test(def), 'Layer mix oferece Dissolve no select');
const fonte = extrai('function fx7LayerMix(', '// Hue Curves');
ok(/const dissolve = p\.blend === 'dissolve';/.test(fonte), 'fx7LayerMix reconhece o modo dissolve');
ok(/hash < opacity \* \(dd\[i \+ 3\] \/ 255\) \* w \? 255 : 0/.test(fonte),
  'Layer mix: probabilidade = opacidade × alfa da fonte × peso do Blend If');
ok(/dd\[i \+ 3\] = hash < opacity/.test(fonte) && /374761393/.test(fonte),
  'Layer mix: o sorteio é determinístico por pixel (sem cintilar entre renders)');
ok(/ctx\.globalCompositeOperation = dissolve \? 'source-over' : \(p\.blend \|\| 'screen'\)/.test(fonte),
  "Layer mix: dissolve não cai num globalCompositeOperation 'dissolve' inválido");

process.exit(resumo() ? 0 : 1);
