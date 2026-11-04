/* Layer mix: aplica o modo de mesclagem na própria camada, no lugar.
   O nó não pode desenhar uma segunda cópia deslocada do que vem antes dele —
   para cópia com deslocamento existe o nó "Faded copy". */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extrai = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

console.log('Layer mix · mesclagem no lugar');

/* ---------------------------------------------------------------- definição do nó */
const def = extrai("  layerMix: {\n    title:", "  hueCurves: {");
ok(/title: 'Layer mix'/.test(def), 'o nó continua se chamando Layer mix');
ok(/cat: 'compose'/.test(def), 'segue na categoria compose');
ok(/inputs: \['Image'\]/.test(def), 'uma entrada só (a camada que chega)');
ok(/NUM\('opacity'/.test(def), 'mantém o controle de opacidade da mistura');
ok(/ENUM\('blend'/.test(def), 'mantém o modo de mesclagem');
ok(/biCanal/.test(def) && /biTLo0/.test(def) && /biUHi1/.test(def), 'mantém o Blend If completo');
ok(!/offsetX|offsetY/.test(def), 'não tem mais Offset X / Offset Y', def.slice(0, 200));
ok(!/NUM\('offset/.test(def), 'nenhum controle de deslocamento sobrou no painel');

/* nada de controle fantasma em outros lugares */
ok(!/layerMix: \['offsetX'/.test(html), 'FX_PXKEYS não escala mais offsets do layerMix');
ok(/fadedCopy: \['blur', 'offsetX', 'offsetY'\]/.test(html), 'quem tem offset é o Faded copy (capacidade preservada)');

/* ------------------------------------------------------------------- o efeito */
const fonte = extrai('function fx7LayerMix(', '// Hue Curves (fxHueCurves from v1.6)');
ok(!/offsetX|offsetY/.test(fonte), 'o efeito não lê mais deslocamento');

/* roda o efeito de verdade, com canvas de mentira que anota cada desenho */
function monta(bi) {
  const desenhos = [];
  const criados = [];
  const ctxNovo = (dono) => ({
    canvas: dono, globalAlpha: 1, globalCompositeOperation: 'source-over',
    drawImage(src, x, y) {
      desenhos.push({ dono, src, x, y, alpha: this.globalAlpha, op: this.globalCompositeOperation });
    },
    getImageData(x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() { desenhos.push({ dono, put: true }); },
  });
  const fx7NewCanvas = (W, H) => {
    const c = { width: W, height: H };
    c.getContext = () => (c.ctx || (c.ctx = ctxNovo(c)));
    criados.push(c);
    return c;
  };
  const biLe = () => bi;
  const biPeso255 = () => 1, biValor255 = () => 128;
  const fx = new Function('fx7NewCanvas', 'biLe', 'biPeso255', 'biValor255',
    fonte + '\nreturn fx7LayerMix;')(fx7NewCanvas, biLe, biPeso255, biValor255);
  return { fx, desenhos, criados };
}

const src = { id: 'entrada' };
const semBi = monta({ on: false, t: [0, 0, 255, 255], u: [0, 0, 255, 255], canal: 'cinza' });
const saida = semBi.fx(src, 4, 4, { opacity: 45, blend: 'screen' });

ok(semBi.desenhos.length === 2, 'desenha a camada exatamente duas vezes (base + mistura)', semBi.desenhos.length);
ok(semBi.desenhos.every(d => d.x === 0 && d.y === 0), 'as duas no mesmo lugar — nada de cópia deslocada',
  semBi.desenhos.map(d => [d.x, d.y]));
ok(semBi.desenhos.every(d => d.src === src), 'e sempre a mesma camada de entrada (nenhuma cópia nova)');
ok(semBi.desenhos[0].op === 'source-over' && semBi.desenhos[0].alpha === 1, 'a base entra opaca e sem mesclagem');
ok(semBi.desenhos[1].op === 'screen' && Math.abs(semBi.desenhos[1].alpha - 0.45) < 1e-9, 'a mistura usa o blend e a opacidade escolhidos');
ok(semBi.criados.length === 1, 'sem Blend If cria um canvas só (o resultado)', semBi.criados.length);
ok(saida === semBi.criados[0], 'o resultado é esse canvas');
ok(saida.ctx.globalCompositeOperation === 'source-over' && saida.ctx.globalAlpha === 1, 'o contexto volta ao normal no fim');

const comBi = monta({ on: true, t: [40, 60, 200, 220], u: [0, 0, 255, 255], canal: 'r' });
comBi.fx(src, 4, 4, { opacity: 70, blend: 'multiply' });
ok(comBi.criados.length === 2, 'com Blend If monta a camada auxiliar para mascarar', comBi.criados.length);
ok(comBi.desenhos.filter(d => d.op === 'source-over' && !d.put).length === 2, 'base e auxiliar entram sem mesclagem');
ok(comBi.desenhos.some(d => d.put), 'o Blend If pesa pixel a pixel antes de misturar');
ok(comBi.desenhos[comBi.desenhos.length - 1].x === 0 && comBi.desenhos[comBi.desenhos.length - 1].y === 0,
  'e a mistura mascarada também cai no lugar da camada');

/* padrões: sem parâmetro vindo do nó, o efeito não quebra */
const padrao = monta({ on: false, t: [0, 0, 255, 255], u: [0, 0, 255, 255], canal: 'cinza' });
padrao.fx(src, 2, 2, {});
ok(padrao.desenhos[1].op === 'screen' && Math.abs(padrao.desenhos[1].alpha - 0.45) < 1e-9, 'padrão screen a 45%');

/* ligação com o resto do editor */
ok(/layerMix: \(n, \[a\]\) => \(a \? fx7Canvas\(a, \(s, W, H\) => fx7LayerMix\(s, W, H, n\.params\)\) : null\)/.test(html),
  'o renderizador continua chamando o efeito');
ok(/function fx7Canvas\(/.test(html), 'fx7Canvas preserva o tamanho da entrada (uma cópia só, a do pipeline)');

const tudo = resumo();
process.exit(tudo ? 0 : 1);
