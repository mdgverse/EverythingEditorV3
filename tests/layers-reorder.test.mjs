/* Layer Position (3.10.0) — prova de comportamento, não de string:
   extrai o código REAL de genLayerId/defaultLayer/syncClippingHierarchy/
   layerList/layerRotulo/moveLayer/duplicateLayer do index.html, roda num
   sandbox e verifica que o nome renomeado segue a camada em todas as
   reordenações, no duplicar, na migração de arquivo antigo e no undo. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pega = (nome) => {
  const a = html.indexOf('function ' + nome + '(');
  if (a < 0) throw new Error('função não encontrada: ' + nome);
  const b = html.indexOf('\n}\n', a);
  if (b < 0) throw new Error('fim não encontrado: ' + nome);
  return html.slice(a, b + 3);
};

const codigo = ['genLayerId', 'defaultLayer', 'syncClippingHierarchy', 'layerRotulo', 'layerList', 'moveLayer', 'duplicateLayer']
  .map(pega).join('\n');

const sb = { links: [] };
let chamadas = { sockets: 0, dirty: 0, drawLinks: 0, render: 0, commit: 0, connect: 0 };
const api = new Function('sb', 'st', `
  var links = sb.links;
  var LAYER_INITIAL_COUNT = 6;
  var _lyrUidCounter = 1;
  function syncLayerSockets() { st.sockets++; }
  function markDirty() { st.dirty++; }
  function drawLinks() { st.drawLinks++; }
  function requestRender() {}
  function commit() { st.commit++; }
  function linkTo() { return null; }
  function connect() { st.connect++; return {}; }
  ${codigo}
  return { layerList, layerRotulo, moveLayer, duplicateLayer, genLayerId, defaultLayer };
`)(sb, chamadas);

const novoNo = () => ({ id: 7, type: 'layers', params: { layers: [] }, ui: {}, el: null });
const nomes = (n) => n.params.layers.map(l => l.name || '');

/* ---------- 1. lista inicial: 6 camadas, ids únicos ---------- */
const n = novoNo();
const lista = api.layerList(n);
ok(lista.length === 6, 'a lista começa com 6 camadas', lista.length);
ok(new Set(lista.map(l => l.id)).size === 6, 'todas as camadas têm id único');
ok(nomes(n).every(x => x === ''), 'sem nome custom, tudo vazio');

/* ---------- 2. renomear 3 camadas (é o que o ✎/duplo clique fazem) ---------- */
n.params.layers[0].name = 'Fundo';
n.params.layers[2].name = 'Sujeito';
n.params.layers[5].name = 'Luz';
const idFundo = n.params.layers[0].id, idSujeito = n.params.layers[2].id, idLuz = n.params.layers[5].id;
ok(api.layerRotulo(n, 0) === '1 · Fundo', 'rótulo mostra posição + nome', api.layerRotulo(n, 0));
ok(api.layerRotulo(n, 1) === 'Layer 2', 'camada sem nome continua "Layer N"', api.layerRotulo(n, 1));

/* ---------- 3. reordenar: o nome viaja com a camada ---------- */
api.moveLayer(n, 0, 3);                       // Fundo desce para a posição 4
ok(n.params.layers[3].id === idFundo, 'a camada Fundo foi para o índice 3 (pelo id)');
ok(n.params.layers[3].name === 'Fundo', 'e continua chamando Fundo', n.params.layers[3].name);
ok(api.layerRotulo(n, 3) === '4 · Fundo', 'o rótulo acompanha a nova posição', api.layerRotulo(n, 3));
ok(nomes(n).filter(x => x === 'Fundo').length === 1, 'o nome não duplicou em outra camada');

api.moveLayer(n, 3, 0);                       // volta para o topo da pilha
ok(n.params.layers[0].id === idFundo && n.params.layers[0].name === 'Fundo', 'subir de volta mantém id e nome');
api.moveLayer(n, 2, 5);                       // Sujeito vai para o fim
const iSuj = n.params.layers.findIndex(l => l.id === idSujeito);
ok(iSuj === 5 && n.params.layers[5].name === 'Sujeito', 'Sujeito carrega o nome para o fim', iSuj);
const iLuz = n.params.layers.findIndex(l => l.id === idLuz);
ok(n.params.layers[iLuz].name === 'Luz', 'a camada Luz mantém o nome depois do reorder (' + (iLuz + 1) + 'º lugar)');

/* ---------- 4. fios e seleção seguem a camada ---------- */
sb.links.length = 0;
sb.links.push({ from: 99, to: 7, input: 0, out: 0 });   // fio na camada do índice 0
api.moveLayer(n, 0, 4);
ok(sb.links[0].input === 4, 'o fio da camada reordenada vai para a nova entrada', sb.links[0].input);
n.ui.layerSel = 0;
api.moveLayer(n, 0, 2);
ok(n.ui.layerSel === 2, 'a seleção segue a camada movida', n.ui.layerSel);

/* ---------- 5. duplicar: nome ganha sufixo e id novo ---------- */
const alvoDup = n.params.layers.findIndex(l => l.name === 'Fundo');
const idAntes = n.params.layers[alvoDup].id;
const posDup = api.duplicateLayer(n, alvoDup, null);
ok(posDup === alvoDup + 1, 'a cópia entra logo acima da original', posDup);
ok(n.params.layers[posDup].name === 'Fundo (copy)', 'a cópia é identificável', n.params.layers[posDup].name);
ok(n.params.layers[posDup].id !== idAntes, 'a cópia tem id próprio (não é a mesma camada)');
ok(n.params.layers[alvoDup].name === 'Fundo', 'a original fica intacta');

/* ---------- 6. arquivo antigo: camada sem id ganha id e mantém o nome ---------- */
const antigo = novoNo();
antigo.params.layers = [{ name: 'Camada velha' }, { name: 'Outra' }];
api.layerList(antigo);
ok(antigo.params.layers.every(l => !!l.id), 'camadas antigas recebem id na migração');
ok(antigo.params.layers[0].name === 'Camada velha', 'o nome da camada antiga sobrevive');
ok(api.layerRotulo(antigo, 0) === '1 · Camada velha', 'e aparece no rótulo', api.layerRotulo(antigo, 0));

/* ---------- 7. save/load e undo (JSON) mantêm o vínculo id → nome ---------- */
const salvo = JSON.stringify(n.params.layers);
const carregado = novoNo();
carregado.params.layers = JSON.parse(salvo);
api.layerList(carregado);
const fundoCarregado = carregado.params.layers.find(l => l.id === idAntes);
ok(fundoCarregado && fundoCarregado.name === 'Fundo', 'depois de salvar e carregar, o nome segue o mesmo id');

const iFundoAntes = n.params.layers.findIndex(l => l.id === idAntes);
const antesDoUndo = JSON.stringify(n.params.layers);
api.moveLayer(n, iFundoAntes, 0);
ok(n.params.layers.findIndex(l => l.id === idAntes) === 0, 'mover para o topo leva o id para o índice 0');
n.params.layers = JSON.parse(antesDoUndo);     // é o que o undo faz: restaura o snapshot
ok(n.params.layers.findIndex(l => l.id === idAntes) === iFundoAntes, 'o undo devolve a ordem original');
ok(n.params.layers[iFundoAntes].name === 'Fundo', 'com o nome na mesma camada (ids, não índices)');

/* ---------- 8. efeitos colaterais pedidos pelo app aconteceram ---------- */
ok(chamadas.sockets > 0, 'os sockets são ressincronizados a cada reordenação', chamadas.sockets);
ok(chamadas.commit > 0, 'cada reordenação entra no histórico', chamadas.commit);

process.exit(resumo() ? 0 : 1);
