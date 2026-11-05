/* 3.8.x — ajustes pedidos pelo usuário:
   · "Layers (Layer Comp)" e "Layers (position)" eram o MESMO nó: sai só o nome
     duplicado (Layer Comp), o nó volta como "Layers (position)" com os
     parâmetros intocados;
   · as anotações saíram inteiras (o nó Note não criava a notinha na prática).
   Ficam: Layers (position), Layer mix, Effect stack e Mix — sem código morto,
   CSS órfão, teste verde de mentira ou passo de CI sobrando. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ci = fs.readFileSync(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8');
const arquivos = fs.readdirSync(new URL('../tests', import.meta.url));
const defLayers = html.slice(html.indexOf('  layers: {'), html.indexOf('  text: {', html.indexOf('  layers: {')));

console.log('3.8.x · Layer Comp fora, Layers (position) de volta, anotações fora');

/* ---------------------------------------------------- 1. o nome "Layer Comp" não existe mais */
{
  ok(!/Layer Comp/.test(html), 'nenhuma ocorrência de "Layer Comp" na interface nem nos comentários');
  ok(!/title: 'Layers \(Layer Comp\)'/.test(html), 'o título duplicado saiu do NODE_TYPES');
  ok(/title: 'Layers \(position\)'/.test(defLayers), 'o nó se chama Layers (position)');
}

/* ---------------------------------------------------- 2. o nó voltou inteiro, com os mesmos parâmetros */
{
  ok(defLayers.includes("    params: [{ type: 'layers', key: 'layers', label: 'Layers', def: [] }],"),
    'definição de parâmetros idêntica à da 3.7.1');
  ok(/inputs: \['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5', 'Layer 6'\]/.test(defLayers), 'os seis sockets de camada continuam');
  for (const f of ['makeLayersControl', 'runLayers', 'layerList', 'syncClippingHierarchy', 'defaultLayer',
    'addLayer', 'duplicateLayer', 'removeLayer', 'moveLayer', 'swapLayers', 'createClippingMask',
    'releaseClippingMask', 'toggleClippingMask', 'composeLayerClipCanvas2D', 'renderLayerStackCanvas2D',
    'layerGroupDe', 'layerRowEl', 'layerBodyEl']) {
    ok(new RegExp('function ' + f + '\\(').test(html), `função ${f} restaurada`);
  }
  ok(/var LAYER_INITIAL_COUNT = 6;/.test(html), 'LAYER_INITIAL_COUNT = 6, como antes');
  ok(/\.lyr-row\{/.test(html) && /\.lyr-ctx-menu\{/.test(html), 'CSS do stack restaurado');
  ok(/createClippingMask, releaseClippingMask, toggleClippingMask, syncClippingHierarchy,/.test(html), 'API de debug volta a expor o stack');
}

/* ---------------------------------------------------- 3. o que os outros nós precisam continua */
{
  const def = nome => {
    const i = html.indexOf('  ' + nome + ': {');
    return i < 0 ? '' : html.slice(i, html.indexOf('\n  },', i));
  };
  ok(/title: 'Layer mix'/.test(def('layerMix')), 'Layer mix (position) continua');
  ok(/title: 'Effect stack'/.test(def('effectStack')), 'Effect stack continua');
  ok(/title: 'Mix'/.test(def('mix')), 'Mix continua');
  ok(/  layerMix: \(n, \[a\]\) =>/.test(html), 'o RUN do Layer mix segue intacto');
}

/* ---------------------------------------------------- 4. anotações continuam fora */
{
  ok(!/id="annBar"|id="btnAnnot"|id="annPen"|ann-pen|note-node|makeNoteControl/.test(html),
    'painel, caneta e nó Note das anotações saíram');
  ok(!/annSerialize|annLoad|annRender|annPega|ANN_CORES/.test(html), 'módulo de anotações removido inteiro');
  ok(!/annots:/.test(html), 'o save não grava mais tinta de anotação');
  ok(/if \(!NODE_TYPES\[nd\.type\]\) continue;/.test(html), 'projeto antigo com o nó Note abre: o nó é ignorado');
}

/* ---------------------------------------------------- 5. suíte e CI */
{
  ok(arquivos.includes('layerstack.test.mjs') && ci.includes('tests/layerstack.test.mjs'), 'o teste do stack voltou e roda no CI');
  ok(!arquivos.includes('annotations.test.mjs') && !/annotations\.test/.test(ci), 'o teste das anotações não existe mais (nem no CI)');
  ok(arquivos.includes('displacement.test.mjs') && ci.includes('tests/displacement.test.mjs'), 'o teste do Displacement roda no CI');
  ok(arquivos.includes('cleanup.test.mjs') && ci.includes('tests/cleanup.test.mjs'), 'este teste roda no CI');
}

process.exit(resumo() ? 0 : 1);
