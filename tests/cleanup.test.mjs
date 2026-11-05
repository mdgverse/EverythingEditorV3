/* 3.8.0 — remoções pedidas pelo usuário:
   · o nó "Layers (Layer Comp)" saiu (é o mesmo terreno do Layer mix / layer position)
   · as anotações saíram inteiras (o nó Note não criava a notinha na prática)
   Ficam: layer position/mix, Effect stack e Mix. Nada de nó fantasma, código
   morto, CSS órfão, teste verde de mentira ou passo de CI sobrando. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ci = fs.readFileSync(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8');
const arquivos = fs.readdirSync(new URL('../tests', import.meta.url));

console.log('3.8.0 · remoções do Layer Comp e das anotações');

/* ---------------------------------------------------- 1. o que sai */
{
  ok(!/title: 'Layers \(Layer Comp\)'/.test(html), 'o nó Layer Comp não está mais no NODE_TYPES');
  ok(!/^  layers: \{/m.test(html), 'a chave "layers" saiu do NODE_TYPES');
  ok(!/RUN\.layers|  layers: \(n, ins\) =>/.test(html), 'o RUN do layer stack saiu');
  for (const f of ['makeLayersControl', 'runLayers', 'layerList', 'syncClippingHierarchy', 'defaultLayer',
    'addLayer', 'duplicateLayer', 'removeLayer', 'moveLayer', 'swapLayers', 'createClippingMask',
    'releaseClippingMask', 'toggleClippingMask', 'composeLayerClipCanvas2D', 'renderLayerStackCanvas2D',
    'layerGroupDe', 'layerRowEl', 'layerBodyEl', 'layerSnap', 'layerCenterOffset', 'layerVisibleBox']) {
    ok(!new RegExp('function ' + f + '\\(').test(html), `função ${f} removida`);
  }
  ok(!/lyr-row|lyr-ctx-menu|lyr-group-head|lyr-grip|lyr-clip-ind|lyr-tools|lyr-count/.test(html), 'CSS e classes do layer stack saíram');
  ok(!/Layer Comp/.test(html), 'nem o nome "Layer Comp" sobrou na interface');
  ok(!/id="annBar"|id="btnAnnot"|id="annPen"|ann-pen|note-node|makeNoteControl/.test(html), 'painel, caneta e nó Note das anotações saíram');
  ok(!/annSerialize|annLoad|annRender|annPega|ANN_CORES/.test(html), 'módulo de anotações removido inteiro');
  ok(!/annots:/.test(html), 'o save não grava mais tinta de anotação');
}

/* ---------------------------------------------------- 2. o que fica */
{
  const def = nome => {
    const i = html.indexOf('  ' + nome + ': {');
    return i < 0 ? '' : html.slice(i, html.indexOf('\n  },', i));
  };
  ok(/title: 'Layer mix'/.test(def('layerMix')), 'Layer mix (position) continua');
  ok(/title: 'Effect stack'/.test(def('effectStack')), 'Effect stack continua');
  ok(/title: 'Mix'/.test(def('mix')), 'Mix continua');
  ok(/runLayers|makeLayersControl/.test(html) === false, 'e o stack não deixou chamada pendurada');
  ok(/  layerMix: \(n, \[a\]\) =>/.test(html), 'o RUN do Layer mix segue intacto');
}

/* ---------------------------------------------------- 3. save antigo não quebra */
{
  ok(/const dados = \{[\s\S]{0,400}?nodes:/.test(html) || /nodes: \[\.\.\.nodes\.values\(\)\]/.test(html), 'o save continua serializando os nós existentes');
  ok(!/data\.layers|params\.layers/.test(html), 'nenhum restaurador procura a chave "layers"');
  ok(!/type === 'layers'/.test(html) && !/type !== 'layers'/.test(html), 'nenhum caminho de código compara com o tipo removido');
  ok(/removeLink\(l\) \{/.test(html), 'ligar/desligar fios não depende mais do stack');
  ok(/if \(!NODE_TYPES\[nd\.type\]\) continue;/.test(html), 'projeto antigo com o nó removido abre: o nó é ignorado');
  ok(/links = links\.filter\(l => nodes\.has\(l\.from\) && nodes\.has\(l\.to\)\);/.test(html), 'os fios que apontavam para ele caem junto');
  ok(!/type === 'note'|'note'/.test(html), 'o tipo de nó das anotações também não é mais reconhecido');
}

/* ---------------------------------------------------- 4. suíte e CI limpos */
{
  ok(!arquivos.includes('layerstack.test.mjs'), 'tests/layerstack.test.mjs removido');
  ok(!arquivos.includes('annotations.test.mjs'), 'tests/annotations.test.mjs removido');
  ok(!/layerstack|annotations/.test(ci), 'o CI não roda mais essas suítes');
  ok(arquivos.includes('displacement.test.mjs') && ci.includes('tests/displacement.test.mjs'), 'o teste novo do Displacement roda no CI');
  ok(arquivos.includes('cleanup.test.mjs') && ci.includes('tests/cleanup.test.mjs'), 'este teste roda no CI');
}

process.exit(resumo() ? 0 : 1);
