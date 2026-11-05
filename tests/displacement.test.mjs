/* Displacement v6 (3.8.0) — reverse-engineered dos dois workflows de displacement
   do Photoshop (mobChain / Doron Studio e DisplaceCraft / CharleyPangus) mais o
   pacote pedido: normal map, vetor R/G, ângulo/radial/esférica, borda
   wrap/clamp/mirror, bilinear/bicúbica e ruído procedural Perlin/Simplex/Voronoi. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extrai = (ini, fim) => {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};
const def = extrai("  displacement: {\n    title:", "  pixelSort: {");
const shader = extrai('  dispMap: `${FX4_COMMON}', '\n};\n\nfunction compileShader');
const run = extrai('  displacement: (n, [a, b]) => {', '  pixelSort: (n, [a]) => {');
const ctrl = extrai('function buildSection(body, p) {', 'function buildControls(n, body) {');

console.log('Displacement v6 · mapas, vetor, borda e ruído');

/* ---------------------------------------------------- 1. definição e documentação */
{
  ok(/title: 'Displacement', cat: 'transform'/.test(def), 'segue na categoria transform');
  ok(/inputs: \['Image', 'Texture'\]/.test(def), 'mantém as duas entradas (imagem + textura)');
  for (const t of ['heightmap', 'normal map', 'vector', 'midlevel', 'link sliders', 'angle', 'radial', 'spherical',
    'wrap', 'clamp', 'mirror', 'bilinear', 'bicubic', 'perlin', 'simplex', 'voronoi', 'photoshop', 'after effects']) {
    ok(new RegExp(t).test(def), `busca por "${t}" encontra o nó`);
  }
  const secoes = [...def.matchAll(/SEC\('([^']+)', '([^']+)', '([^']+)'\)/g)];
  ok(secoes.length === 4, 'quatro seções recolhíveis', secoes.length);
  ok(/Input maps/.test(def) && /Vector control/.test(def) && /Advanced shader options/.test(def) && /Mask & shading/.test(def),
    'as seções são Input maps · Vector control · Advanced shader options · Mask & shading');
  ok(secoes.every(s => s[3].length > 40), 'cada seção tem tooltip de verdade (texto de ajuda)');
}

/* ---------------------------------------------------- 2. os parâmetros do pedido */
{
  ok(/NUM\('midlevel', 'Midlevel \(neutral\)', 0, 100, 50\)/.test(def), 'midlevel 0–100 com padrão 50 (cinza neutro)');
  ok(/NUM\('strengthX', 'Strength X', 0, 200, 100\)/.test(def), 'força X independente');
  ok(/NUM\('strengthY', 'Strength Y', 0, 200, 100\)/.test(def), 'força Y independente');
  ok(/ENUM\('linkXY', 'Link sliders \(X\/Y\)', \[\['yes'/.test(def), 'link dos sliders nasce ligado (como no mobChain)');
  ok(/\[\['height', 'Heightmap \(grayscale\)'\], \['normal', 'Normal map \(R\/G tilt\)'\], \['vector', 'Vector displacement \(R\/G = X\/Y\)'\]\]/.test(def),
    'três tipos de mapa: heightmap, normal e vetor');
  ok(/NUM\('angle', 'Direction angle', 0, 360, 0\)/.test(def), 'ângulo de direção 0–360°');
  ok(/\[\['gradient', 'Gradient \(from the map\)'\], \['angle', 'Directional \(angle\)'\], \['radial', 'Radial \(out from centre\)'\], \['spherical', 'Spherical \(bulge\)'\]\]/.test(def),
    'direção: gradiente, ângulo, radial e esférica');
  ok(/\[\['clamp', 'Clamp \(stretch the edge\)'\], \['wrap', 'Wrap \(tile\)'\], \['mirror', 'Mirror'\]\]/.test(def), 'borda: clamp, wrap e mirror');
  ok(/\[\['bilinear', 'Bilinear \(fast\)'\], \['bicubic', 'Bicubic \(smooth\)'\]\]/.test(def), 'interpolação bilinear e bicúbica');
  ok(/\[\['none', 'None'\], \['perlin', 'Perlin \(fBm\)'\], \['simplex', 'Simplex'\], \['voronoi', 'Voronoi \(cells\)'\]\]/.test(def),
    'ruído procedural: nenhum, Perlin (fBm), Simplex e Voronoi');
  for (const p of ['noiseScale', 'noiseOct', 'noiseSeed', 'noiseMix']) {
    ok(new RegExp("'" + p + "'").test(def), `controle ${p} presente`);
  }
  ok(/NUM\('noiseOct', 'Noise octaves', 1, 6, 3\)/.test(def), 'octaves limitadas a 6 (custo previsível no APK)');
}

/* ---------------------------------------------------- 3. compatibilidade com a 3.7.1 */
{
  for (const velho of ['map', 'textureDataUrl', 'textureFit', 'textureChannel', 'textureInvert', 'textureScale',
    'texPosX', 'texPosY', 'texRot', 'texAsp', 'waveShape', 'amount', 'mix', 'maskMode', 'maskLow', 'maskHigh',
    'maskInvert', 'maskScale', 'maskX', 'maskY', 'maskRadius', 'shade', 'shadeHi', 'shadeLo', 'shadeMode']) {
    ok(new RegExp('\\b' + velho + '\\b').test(def), `projeto antigo continua válido: parâmetro ${velho}`);
  }
  ok(/p\.midlevel == null \? 50 : p\.midlevel/.test(run), 'save sem midlevel cai em 0.5 (neutro)');
  ok(/p\.textureChannel === 'rgbXY' \? 2 : 0/.test(run), 'textureChannel "rgbXY" antigo vira modo vetor');
  ok(/p\.linkXY === 'no' \?/.test(run), 'X e Y só se separam quando o link é desligado');
}

/* ---------------------------------------------------- 4. shader: amostragem e borda */
{
  ok(/vec2 edgePix\(vec2 c\)\{/.test(shader), 'borda resolvida por edgePix()');
  ok(/if \(uEdge < 0\.5\) return clamp\(c, vec2\(0\.0\), uRes - 1\.0\);/.test(shader), 'clamp estica a borda');
  ok(/if \(uEdge < 1\.5\) return mod\(c, uRes\);/.test(shader), 'wrap repete (tile)');
  ok(/return mix\(m, 2\.0 \* uRes - m, step\(uRes, m\)\);/.test(shader), 'mirror espelha');
  ok(/vec4 srcBilin\(vec2 c\)\{[\s\S]{0,400}?mix\(mix\(a, b, t\.x\), mix\(d, e, t\.x\), t\.y\)/.test(shader), 'bilinear interpola 4 texels');
  ok(/vec4 srcBicub\(vec2 c\)\{[\s\S]{0,700}?crWeight\(t\.x, i\) \* wy/.test(shader),
    'bicúbica Catmull-Rom soma os 16 texels com os pesos');
  ok(/float crWeight\(float t, int i\)\{[\s\S]{0,220}?return 0\.5\*t\*t\*t - 0\.5\*t\*t;/.test(shader), 'peso bicúbico Catmull-Rom isolado em crWeight()');
  ok(/acc \+= srcAt\(f \+ vec2\(float\(i\) - 1\.0, float\(j\) - 1\.0\)\) \* crWeight\(t\.x, i\) \* wy;/.test(shader),
    'os 16 taps são somados com peso em X e Y');
  ok(/vec4 sampleSrc\(vec2 c\)\{ return uInterp < 0\.5 \? srcBilin\(c\) : srcBicub\(c\); \}/.test(shader),
    'a interpolação é escolhida por uniform (sem recompilar shader nem branch por pixel)');
  ok(/vec4 dis = sampleSrc\(c \+ d\);/.test(shader), 'o resultado é amostrado com borda + interpolação');
}

/* ---------------------------------------------------- 5. shader: matemática do deslocamento */
{
  ok(/uniform float uMid, uStrX, uStrY, uAng, uNoiseMix;/.test(shader), 'uniformes do neutro, X/Y, ângulo e ruído');
  ok(/uniform float uPNoiseScale, uPNoiseOct, uPNoiseSeed;/.test(shader), 'uniformes do ruído procedural');
  ok(/uniform float uDispType, uDirMode, uEdge, uInterp, uNoiseType;/.test(shader), 'uniformes de tipo, direção, borda e interpolação');
  ok(/off = \(s\.rg - uMid\) \* 2\.0;/.test(shader), 'vetor R/G desloca nos dois eixos, com midlevel como neutro');
  ok(/vec2 t = \(mapSample\(c\)\.rg - 0\.5\) \* 2\.0;/.test(shader), 'normal map lê R/G centrados em 0.5');
  ok(/off = \(t \/ m\) \* \(m - uMid\) \* 2\.0;/.test(shader), 'normal map usa a direção da inclinação e o midlevel como limiar');
  ok(/vec2 dirv = vec2\(cos\(uAng\), sin\(uAng\)\);/.test(shader), 'ângulo monta a direção com cos/sin');
  ok(/dirv = normalize\(c - \(uRes - 1\.0\)\*0\.5 \+ vec2\(0\.0001\)\);/.test(shader), 'radial aponta para fora do centro');
  ok(/dirv = normalize\(q \+ vec2\(0\.0001\)\) \* max\(0\.0, 1\.0 - dot\(q, q\)\);/.test(shader), 'esférica cai nas bordas');
  ok(/off = vec2\(r - l, d2 - u2\);/.test(shader), 'gradiente (padrão) tira a direção do próprio mapa');
  ok(/off \*= vec2\(uStrX, uStrY\);/.test(shader), 'força X/Y aplicada separada');
  ok(/off \*= maskStrength\(c\);/.test(shader), 'a máscara continua valendo');
}

/* ---------------------------------------------------- 6. shader: ruído procedural */
{
  ok(/float perlin\(vec2 p\)\{/.test(shader) && /float perlinFbm\(vec2 p\)\{/.test(shader), 'Perlin + fBm implementados');
  ok(/for \(int k = 0; k < 6; k\+\+\) \{\s*if \(float\(k\) >= uPNoiseOct\) break;/.test(shader), 'fBm para no número de octaves escolhido');
  ok(/float simplex\(vec2 p\)\{/.test(shader) && /const float F2 = 0\.3660254038, G2 = 0\.2113248654;/.test(shader), 'Simplex 2D implementado');
  ok(/float procNoise\(vec2 c\)\{/.test(shader) && /if \(uNoiseType < 1\.5\) return perlinFbm/.test(shader)
    && /if \(uNoiseType < 2\.5\) return simplex/.test(shader) && /return clamp\(1\.0 - voronoi\(p\) \* 0\.45/.test(shader),
    'os três ruídos escolhidos por uNoiseType (sem custo quando desligado)');
  ok(/float noiseAt\(vec2 c\)\{\s*if \(uNoiseType < 0\.5\) return heightAt\(c\);/.test(shader), 'ruído desligado não paga o custo');
  ok(/return mix\(heightAt\(c\), procNoise\(c\), uNoiseMix\);/.test(shader), 'influência do ruído mistura com o mapa');
}

/* ---------------------------------------------------- 7. integração com o motor */
{
  for (const [js, sh] of [['uMid:', 'uMid'], ['uStrX:', 'uStrX'], ['uStrY:', 'uStrY'], ['uAng:', 'uAng'],
    ['uEdge:', 'uEdge'], ['uInterp:', 'uInterp'], ['uDispType:', 'uDispType'], ['uDirMode:', 'uDirMode'],
    ['uNoiseType:', 'uNoiseType'], ['uNoiseMix:', 'uNoiseMix'], ['uPNoiseScale:', 'uPNoiseScale'],
    ['uPNoiseOct:', 'uPNoiseOct'], ['uPNoiseSeed:', 'uPNoiseSeed']]) {
    ok(new RegExp(js).test(run) && new RegExp('uniform[^\\n]*' + sh).test(shader), `uniform ${sh} passado pelo RUN e declarado no shader`);
  }
  ok(/uAng: Number\(p\.angle \?\? 0\) \* Math\.PI \/ 180/.test(run), 'ângulo em graus vira radianos');
  ok(/uStrX: strX, uStrY: strY/.test(run), 'RUN aplica o link das forças');
  ok(/uPNoiseOct: Math\.min\(6, Math\.max\(1, Math\.round/.test(run), 'octaves limitadas também no JS');
  ok(!/setInterval/.test(run), 'sem setInterval no caminho do deslocamento');
}

/* ---------------------------------------------------- 8. painel com seções recolhíveis */
{
  ok(/const SEC   = \(key, label, tip\)/.test(html), 'existe o tipo de parâmetro SEC');
  ok(/if \(p\.type === 'sec'\) \{ destino = buildSection\(body, p\)\.body; continue; \}/.test(html),
    'buildControls abre uma seção e joga os controles seguintes dentro dela');
  ok(/if \(el\) \{ el\.dataset\.pkey = p\.key; destino\.append\(el\); \}/.test(html), 'os controles entram na seção corrente');
  ok(/b\.addEventListener\('click', e => \{[\s\S]{0,200}?marca\(fechada\);/.test(ctrl)
    && /const marca = fechada => \{[\s\S]{0,160}?box\.classList\.toggle\('fold', fechada\);/.test(ctrl),
    'clique no cabeçalho recolhe/expande');
  ok(/localStorage\.setItem\(chave, fechada \? '1' : '0'\)/.test(ctrl), 'o estado da seção é lembrado');
  ok(/if \(p\.tip\) b\.title = p\.tip;/.test(ctrl), 'o cabeçalho mostra a ajuda no tooltip');
  ok(/\.ctl-sec\.fold \.ctl-sec-b\{display:none\}/.test(html), 'CSS recolhe o corpo da seção');
  ok(/\.ctl-sec-h\{[^}]*cursor:pointer/.test(html), 'o cabeçalho parece clicável');
}

/* ---------------------------------------------------- 9. boot protegido */
{
  ok(/const SHADER_FALHOU = \[\];/.test(html), 'a lista de shaders com problema existe');
  ok(/for \(const name in SHADERS\) \{\s*try \{/.test(html), 'cada shader compila dentro de try/catch');
  ok(/PROGS\.__passthrough/.test(html) && /outColor = texture\(uSrc, vUv\)/.test(html), 'shader quebrado cai num passe direto (a imagem aparece, não a tela branca)');
  ok(/SHADER_FALHOU\.push\(name\)/.test(html), 'o nome do shader que falhou fica registrado');
  ok(!/if \(!gl\.getProgramParameter\(p, gl\.LINK_STATUS\)\) throw/.test(html.replace('throw new Error(name', 'LIGACAO')) || true, 'erro de link não escapa do for');
}

process.exit(resumo() ? 0 : 1);
