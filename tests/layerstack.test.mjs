/* Layer stack = "Layers (position)": grupo de camadas, máscara por
   camada, renomear no lugar e reordenar — sem tocar nas outras camadas. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}
const run = extrai('function runLayers(n, ins) {', 'function closeLayerContextMenu()');
const corpo = extrai('function layerBodyEl(n, i, render) {', '// Transform handles over the preview');
const linha = extrai('function layerRowEl(n, i, render, dnd) {', 'function layerBodyEl(');

console.log('layer stack · compositor de camadas');

/* ---------- 1. modelo da camada ---------- */
{
  const dl = extrai('function defaultLayer(patch) {', '\n}');
  ok(/grp: null/.test(dl), 'a camada guarda o grupo a que pertence');
  ok(/maskLayer: null/.test(dl), 'a camada tem um slot de máscara (vazio por padrão)');
  ok(/maskMode: 'alpha'/.test(dl) && /maskInv: false/.test(dl), 'máscara tem canal e inversão');
  ok(/opacity: 100/.test(dl) && /blend: 'normal'/.test(dl), 'opacidade e blend continuam por camada');
  const sync = extrai('function syncClippingHierarchy(list) {', '\n}\n');
  ok(/if \(L\.grp === undefined\) L\.grp = null;/.test(sync), 'projetos antigos ganham o campo do grupo');
  ok(/if \(L\.maskLayer === undefined\) L\.maskLayer = null;/.test(sync), 'projetos antigos ganham o slot de máscara');
  ok(/L\.maskInv = !!L\.maskInv;/.test(sync), 'a inversão é sempre booleana');
}

/* ---------- 2. grupos de camadas ---------- */
{
  ok(/function layerGroups\(n\)/.test(html), 'existe uma lista de grupos por nó');
  ok(/n\.params\.groups = n\.params\.groups\.filter\(g => g && g\.id && vivos\.has\(g\.id\)\)/.test(html), 'grupo sem camada é descartado (nada de grupo fantasma)');
  ok(/function layerLigada\(n, P\)/.test(html), 'a visibilidade soma camada + grupo');
  ok(/if \(!L \|\| !P \|\| !layerLigada\(n, P\) \|\| Number\(P\.opacity\) <= 0\)/.test(run), 'camada de grupo escondido não é composta');
  ok(/if \(!CL \|\| !CP \|\| !layerLigada\(n, CP\)/.test(run), 'o mesmo vale para a camada de clipping');
  ok(/function layerGroupEl\(n, g, render\)/.test(html), 'o grupo tem cabeçalho próprio no painel');
  ok(/olho\.checked = g\.enabled !== false/.test(html), 'o cabeçalho mostra o olho do grupo');
  ok(/g\.collapsed = !g\.collapsed/.test(html), 'o grupo recolhe e volta');
  ok(/if \(g && g\.collapsed\) continue;/.test(html), 'recolhido, as camadas do grupo saem da lista');
  ok(/const idg = g \? g\.id : null;\n      if \(idg !== grupoAtual\)/.test(html), 'um cabeçalho por grupo, na ordem da pilha');
  ok(/function agruparComAcima/.test(html), 'dá para agrupar uma camada com a de cima');
  ok(/for \(const L of layerList\(n\)\) if \(L\.grp === g\.id\) L\.grp = null;/.test(html), 'Ungroup solta todas as camadas do grupo');
  ok(/addItem\('Group with the layer above'/.test(html) && /addItem\('Remove from group'/.test(html), 'o menu ••• também agrupa e desagrupa');
}

/* ---------- 3. máscara por camada ---------- */
{
  ok(/layerMask: `/.test(html), 'há um passe de shader para a máscara');
  const sh = extrai('layerMask: `', '`,\n\n');
  ok(/uniform sampler2D uA, uB;/.test(sh), 'o passe recebe camada e máscara');
  ok(/uLuma, uInvert/.test(sh), 'canal (alpha/luma) e inversão são uniformes');
  ok(/outColor = vec4\(a\.rgb, a\.a \* clamp\(m, 0\.0, 1\.0\)\);/.test(sh), 'a máscara multiplica só o alpha (cor intacta)');
  ok(/function layerMascara\(n, P, list, ins, t, OW, OH\)/.test(html), 'aplicar a máscara é uma função isolada');
  ok(/let grp = layerMascara\(n, P, list, ins, evalLayerToTarget\(/.test(run), 'a camada base passa pela máscara');
  ok(/const ct = layerMascara\(n, CP, list, ins, evalLayerToTarget\(/.test(run), 'a camada de clipping também');
  ok(/const mi = list\.findIndex\(L => L\.id === P\.maskLayer\);/.test(html), 'a máscara é escolhida pelo id, não pelo índice');
  ok(/if \(j === i\) return;/.test(corpo), 'a camada não pode ser máscara de si mesma');
  ok(/semMascara\.textContent = 'None'/.test(corpo), 'o slot de máscara aceita ficar vazio');
  ok(/P\.maskLayer = mascara\.value \|\| null;/.test(corpo), 'escolher máscara marca o nó para redesenhar');
  ok(/P\.maskMode = canal\.value/.test(corpo) && /P\.maskInv = inv\.checked/.test(corpo), 'canal e inversão entram no estado');
}

/* ---------- 4. não destrutivo: cada camada no seu alvo ---------- */
{
  ok(/function evalLayerToTarget/.test(html), 'cada camada é desenhada no próprio alvo');
  ok(/const t = acquire\(OW, OH\);/.test(extrai('function evalLayerToTarget', '\n}')), 'o alvo vem do pool (nada de reusar o da vizinha)');
  ok(/uOp: Number\(P\.opacity\) \/ 100,/.test(html), 'a opacidade é aplicada no passe da camada');
  ok(/uMode: Math\.max\(0, BLEND\.findIndex\(m => m\[0\] === P\.blend\)\)/.test(run), 'o blend de cada camada entra na composição');
  ok(/const BLEND = \[\['normal', 'Normal'\], \['multiply', 'Multiply'\], \['screen', 'Screen'\], \['overlay', 'Overlay'\], \['add', 'Add'\], \['difference', 'Difference'\]/.test(html), 'os modos pedidos estão na lista');
  for (const modo of ['subtract', 'darken', 'lighten', 'softlight', 'divide', 'colorDodge', 'hardMix', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']) {
    ok(new RegExp("'" + modo + "'").test(html), `blend "${modo}" disponível`);
  }
}

/* ---------- 5. renomear, duplicar, apagar e reordenar ---------- */
{
  ok(/function editaNomeEm\(el, valor, aoSalvar\)/.test(html), 'renomear no lugar é um componente só');
  ok(/editaNomeEm\(nome, g\.name \|\| ''/.test(html), 'o cabeçalho do grupo usa esse componente');
  ok(/editaNomeEm\(name, P\.name \|\| ''/.test(linha), 'a camada usa o mesmo componente');
  ok(/if \(v != null\) P\.name = v;/.test(linha), 'renomear a camada guarda o nome novo');
  ok(/addItem\('Duplicate Layer'/.test(html), 'duplicar camada continua no menu');
  ok(/addItem\('Delete Layer'/.test(html), 'apagar camada continua no menu');
  ok(/let targetIdx = upper \? i \+ 1 : i;/.test(linha), 'arrastar reordena com prévia de cima/baixo');
  ok(/grip\.setPointerCapture\(e\.pointerId\)/.test(linha), 'reordenar funciona no toque (APK)');
  ok(/btn\('▲', 'Bring forward \(up in the stack\)'/.test(linha) && /btn\('▼', 'Send backward \(down in the stack\)'/.test(linha), 'setas sobem e descem a camada');
}

/* ---------- 6. achável na pesquisa de nós (3.7.1) ---------- */
{
  const def = extrai('  layers: {', '  text: {');
  ok(/title: 'Layers \(position\)'/.test(def), 'o nó se chama Layers (position) — e não Layer Comp');
  ok(!/Layer Comp/.test(def), 'o nome duplicado "Layer Comp" não está na definição do nó');
  ok(/kw: '[^']*position/.test(def), 'as palavras-chave trazem "position"');
  ok(/kw: '[^']*layer comp/.test(def), '"layer comp" continua funcionando como SINÔNIMO na busca (não é outro nó)');
  for (const termo of ['camadas', 'stack', 'photoshop', 'after effects', 'blend', 'opacity', 'mask', 'clipping', 'grupo']) {
    ok(new RegExp(termo).test(def), `busca por "${termo}" encontra o nó`);
  }
  ok(/function buscaCasa\(q, tipo, def, cat\)/.test(html), 'a busca é por palavras, não por trecho literal');
  ok(/split\(\/\\s\+\/\).filter\(Boolean\).every\(p => alvo.includes\(p\)\)/.test(html),
    'todas as palavras digitadas precisam casar (ex.: "layer comp")');
  ok(/buscaCasa\(q, t, d, cat\)/.test(html), 'o menu de nós usa a busca nova');
  ok(/buscaCasa\(q, t, d, null\)/.test(html), 'a galeria usa a mesma busca');
}

/* ---------- 7. restauração da 3.8.1: parâmetros intocados ---------- */
{
  ok(html.includes("    params: [{ type: 'layers', key: 'layers', label: 'Layers', def: [] }],"),
    'a definição do nó é idêntica à da 3.7.1 (nenhum parâmetro tocado)');
  ok(/inputs: \['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5', 'Layer 6'\]/.test(html.includes('  layers: {') ? html.slice(html.indexOf('  layers: {'), html.indexOf('  text: {', html.indexOf('  layers: {'))) : ''),
    'os seis sockets continuam iguais');
  ok(/var LAYER_INITIAL_COUNT = 6;/.test(html), 'seis camadas iniciais, como antes');
  ok(/function defaultLayer\(patch\)/.test(html) && /blend: 'normal'/.test(html), 'defaultLayer com os mesmos campos e padrões');
  ok(/function syncClippingHierarchy\(list\)/.test(html), 'hierarquia de clipping mask restaurada');
  ok(/layers: \(n, ins\) => runLayers\(n, ins\),/.test(html), 'o RUN do nó voltou');
  ok(/else if \(p\.type === 'layers'\) el = makeLayersControl\(n\);/.test(html), 'o painel do stack voltou ao buildControls');
  ok(/if \(toNode && toNode\.type === 'layers'\)/.test(html), 'fio novo abre socket novo, como antes');
  ok(/if \(livre == null && alvo\.type === 'layers'\) livre = addLayer\(alvo\);/.test(html), 'arrastar fio em espaço vazio cria camada');
  ok(/g\.mode === 'layer'|mode === 'layer'/.test(html) || /const sel = pn && pn\.type === 'layers'/.test(html),
    'alças de transformação por camada restauradas');
}

process.exit(resumo() ? 0 : 1);
