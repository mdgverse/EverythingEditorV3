/* Nó Scribble (3.6.0) — reescrito a partir do processo do post:
   a textura de rabisco é gerada no próprio app (nada de asset externo), entra como
   mapa de deslocamento, puxa a cor ao longo do traço (smear), é achatada por cima
   com layer mix, e pode fechar com margem de papel + dither/paleta. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

console.log('Nó Scribble (textura de pincel)');

/* ---------- o nó existe e mora na categoria certa ---------- */
const def = extrai('  scribble: {\n    title:', '  shapeGrid: {');
ok(/cat: 'style', inputs: \['Image'\]/.test(def), 'nó de estilo, entrada de imagem', 'cat');
ok(/title: 'Scribble \(brush texture\)'/.test(def), 'título novo (textura de pincel)', 'title');

/* ---------- parâmetros x defaults ---------- */
const linha = html.match(/^  scribble: \{ (.*) \},$/m);
ok(!!linha, 'defaults do scribble declarados em FX38_DEFAULTS');
const chavesDefaults = (linha ? linha[1] : '').match(/([A-Za-z_]\w*):/g)?.map(s => s.slice(0, -1)) || [];
const chavesParams = [...def.matchAll(/(?:NUM|ENUM|COL)\('([A-Za-z_]\w*)'/g)].map(m => m[1]);
ok(chavesParams.length >= 15, 'painel completo de controles', chavesParams.length);
ok(JSON.stringify([...chavesParams].sort()) === JSON.stringify([...chavesDefaults].sort()),
  'todo controle tem default e todo default tem controle',
  chavesParams.filter(k => !chavesDefaults.includes(k)).concat(chavesDefaults.filter(k => !chavesParams.includes(k))));
ok(new Set(chavesParams).size === chavesParams.length, 'sem controle repetido');

/* ---------- nada do nó antigo sobrou ---------- */
ok(!/NUM\('amount'|NUM\('threshold'/.test(def), "controles antigos (amount/threshold) saíram do painel");
const bloco = extrai('// ---- Scribble (rabisco de pincel) ----', '// ---- Shape Grid');
ok(!/\bp\.amount\b|\bp\.threshold\b/.test(bloco), 'a implementação não lê mais amount/threshold');
ok(/^function fx38Scribble\(srcCanvas, W, H, p\) \{/m.test(bloco), 'a função do nó continua fx38Scribble(src, W, H, p)');

/* ---------- etapa 1: a textura é gerada aqui ---------- */
for (const nome of ['fx38ScribbleDir', 'fx38ScribbleGrid', 'fx38ScribbleTex', 'fx38ScribbleField', 'fx38ScribbleAt', 'fx38ScribbleBlend']) {
  ok(new RegExp('function ' + nome + '\\(').test(bloco), 'helper ' + nome + ' definido');
}
ok(/ctx\.lineTo\(x, y\)/.test(bloco) && /ctx\.stroke\(\)/.test(bloco), 'a textura são traços de pincel de verdade');
ok(/\['angle', 'Fixed angle'\], \['jitter', 'Jittered'\], \['image', 'Follow image gradient'\]/.test(def),
  'três modos de direção: ângulo, jitter e gradiente da foto');
ok(/Math\.atan2\(dy, dx\) \+ Math\.PI \/ 2/.test(bloco), 'no modo imagem o traço corre através da borda');

/* ---------- etapa 2: texture blur ---------- */
ok(/NUM\('textureBlur'/.test(def) && /fx28Blurred\(tex, W, H, blur\)/.test(bloco), 'a textura é desfocada num campo próprio');
ok(/const tl = FD === F \? t : fx38ScribbleAt\(FD, x, y\)/.test(bloco), 'a camada de cima usa a textura desfocada');

/* ---------- etapa 3: displacement anisotrópico ---------- */
ok(/const push = \(1 - t\) \* disp/.test(bloco) && /dir\.cs/.test(bloco) && /dir\.sn/.test(bloco),
  'o deslocamento escorrega ao longo do traço (não em todas as direções)');
ok(/NUM\('displace'/.test(def), 'intensidade do deslocamento no painel');
ok(/Math\.min\(W, H\) \* 0\.07/.test(bloco), 'deslocamento proporcional ao tamanho do quadro (preview = render)');

/* ---------- etapa 4: smear + layer mix ---------- */
ok(/NUM\('smear'/.test(def) && /const m = stroke \* 0\.9/.test(bloco), 'smear leva a cor para dentro do traço');
ok(/fx38ScribbleBlend\(r, tr, mode\)/.test(bloco), 'o layer mix reusa a textura como camada');
for (const modo of ['overlay', 'multiply', 'screen', 'normal']) {
  ok(new RegExp("\\['" + modo + "'").test(def), 'modo de camada disponível: ' + modo);
}

/* ---------- etapa 5: papel, dither e paleta ---------- */
ok(/NUM\('border', 'Paper border'/.test(def) && /0\.55 \+ 0\.45 \* t/.test(bloco), 'margem de papel irregular na borda');
ok(/const FX38_BAYER = \[0, 8, 2, 10/.test(bloco), 'matriz de dither ordenado própria');
ok(/\['none', 'Off'\], \['duotone', 'Duotone \(ink \+ paper\)'\], \['poster', 'Poster \(4 levels\)'\]/.test(def),
  'três paletas: crua, duotone e posterizada');
ok(/NUM\('mix', 'Blend', 0, 100, 100\)/.test(def) && /fx34Blend\(srcCanvas, cv, p\.mix, W, H\)/.test(bloco),
  'o nó termina com o blend padrão do editor');

/* ---------- o preset "rabisco" acompanha o nó novo ---------- */
const preset = (html.match(/\['scribble', \d+, \d+, \{([^}]*)\}\]+/) || ['', ''])[1];
ok(!!preset, 'preset "rabisco" monta o nó scribble');
ok(/'palette': 'duotone'|palette: 'duotone'/.test(preset) && /dither: 45/.test(preset), 'preset usa a paleta duotone com dither');
const presetChaves = [...preset.matchAll(/([A-Za-z_]\w*):/g)].map(m => m[1]);
const foraDoPainel = presetChaves.filter(k => !chavesParams.includes(k));
ok(foraDoPainel.length === 0, 'preset só usa controles que existem', foraDoPainel);

/* ---------- o nó está ligado no RUN com os defaults ---------- */
ok(/scribble: \(n, \[a\]\) => \(a \? fx7Canvas\(a, \(s, W, H\) => fx38Scribble\(s, W, H, \{ \.\.\.FX38_DEFAULTS\.scribble, \.\.\.n\.params \}\)\) : null\)/.test(html),
  'RUN chama fx38Scribble com os defaults do FX38');

/* ---------- o miolo puro funciona ---------- */
const fonte =
  extrai('function fx38Luma(', '// RGBA index') + extrai('function fx38Idx(', '// ---- creative-mode helpers') +
  extrai('// amostra bilinear de um campo n x n do nó', '// a textura: traços') +
  extrai('// campo da textura em grade grossa', '// modos de camada') +
  extrai('// modos de camada (0..1 em cada canal)', 'function fx38Scribble(srcCanvas');
const api = new Function(fonte + '\nreturn { fx38ScribbleGrid, fx38ScribbleField, fx38ScribbleAt, fx38ScribbleBlend };')();

const chapado = new Uint8ClampedArray(16 * 16 * 4).fill(200);
const campo = api.fx38ScribbleField(chapado, 16, 16, 3);
ok(Math.abs(api.fx38ScribbleAt(campo, 8, 8) - 200 / 255) < 1e-6, 'campo constante é lido como constante');
ok(Math.abs(api.fx38ScribbleAt(campo, -50, 400) - 200 / 255) < 1e-6, 'leitura fora do quadro é presa na borda');
ok(Number.isFinite(api.fx38ScribbleAt(campo, 15.5, 0.5)), 'nenhum NaN na interpolação');

const grade = new Float32Array([0, 10, 20, 30]);            // 2x2: 0 10 / 20 30
ok(Math.abs(api.fx38ScribbleGrid(grade, 2, 2, 2, 2, 2) - 30) < 1e-6, 'grade 2x2: canto = último valor');
ok(Math.abs(api.fx38ScribbleGrid(grade, 2, 2, 0, 2, 2) - 10) < 1e-6, 'grade 2x2: outro canto = 10');
ok(Math.abs(api.fx38ScribbleGrid(grade, 2, 1, 1, 2, 2) - 15) < 1e-6, 'grade 2x2: meio interpola os quatro');

ok(Math.abs(api.fx38ScribbleBlend(0.4, 0.5, 'multiply') - 0.2) < 1e-9, 'multiply multiplica');
ok(Math.abs(api.fx38ScribbleBlend(0.4, 0, 'screen') - 0.4) < 1e-9, 'screen com preto não muda nada');
ok(Math.abs(api.fx38ScribbleBlend(0.4, 0.7, 'normal') - 0.7) < 1e-9, 'normal devolve a textura');
ok(api.fx38ScribbleBlend(0.2, 0.9, 'softlight') > 0.2 && api.fx38ScribbleBlend(0.9, 0.1, 'softlight') < 0.9,
  'soft light clareia no escuro e escurece no claro');

const tudo = resumo();
process.exit(tudo ? 0 : 1);
