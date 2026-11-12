/* Artboards (1.1.0) — vários canvas independentes num projeto só.
   O grafo vivo continua sendo um só (o do Artboard ativo); cada Artboard
   guarda o seu grafo serializado, e o Output do documento compõe por ID
   (doc.order = sockets, esquerda → direita). Aqui testamos o núcleo puro
   (extraído do index.html) e a fiação com o resto do editor. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extrai = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim, a);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};
const puro = extrai('/* AB_PURO_INI */', '/* AB_PURO_FIM */');
const AB = new Function(puro + `
return { abIdNovo, abNomePadrao, abDimOk, abDimsDeSer, abEntradaNova, abNormaliza,
         abDeLegado, abComposeDims, abConectados, abDesconectados, abOrdemLiga, abOrdemMove };`)();
const { abDimsDeSer, abEntradaNova, abNormaliza, abDeLegado, abComposeDims,
        abConectados, abDesconectados, abOrdemLiga, abOrdemMove } = AB;

console.log('Artboards · núcleo');

/* ---------- 1. documento novo nasce com Artboard 1 ---------- */
const legadoVazio = abDeLegado({ nodes: [], links: [] });
ok(legadoVazio.list.length === 1 && legadoVazio.list[0].name === 'Artboard 1', 'projeto nasce com Artboard 1');
ok(legadoVazio.active === legadoVazio.list[0].id && legadoVazio.doc.order.join() === legadoVazio.list[0].id,
  'Artboard 1 ativo e ligado ao Output do documento');
ok(/abNovoDocumento\(W, H\)/.test(html) && /function ssNewDoc/.test(html), 'New Document cria o Artboard 1 nas medidas escolhidas');

/* ---------- 2. numeração monotônica, renomear não muda identidade ---------- */
const doc = abNormaliza(null);
let prox = doc.next;
const mk = () => { const e = abEntradaNova(prox, 800, 600); prox++; return e; };
const a1 = mk(), a2 = mk(), a3 = mk();
ok([a1, a2, a3].map(e => e.name).join('|') === 'Artboard 2|Artboard 3|Artboard 4', 'nomes nascem sequenciais');
ok(a1.seq === 2 && a2.seq === 3 && a3.seq === 4, 'sequência 2, 3, 4…', [a1.seq, a2.seq, a3.seq]);
const semA2 = [a1, a3];
const a4 = abEntradaNova(Math.max(...semA2.map(e => e.seq)) + 1, 800, 600);
ok(a4.name === 'Artboard 5', 'remover não reutiliza número (próximo é 5, não 2)', a4.name);
const renomeado = { ...a3, name: 'Capa final' };
ok(renomeado.id === a3.id && renomeado.seq === a3.seq, 'renomear preserva id e sequência');
ok(new Set([a1.id, a2.id, a3.id, a4.id]).size === 4, 'ids únicos e estáveis (nome não é id)');

/* ---------- 3. isolamento entre grafos ---------- */
const gA = { nodes: [{ id: 1, type: 'fill', params: { fw: 800, fh: 600 } }], links: [] };
const gB = { nodes: [{ id: 1, type: 'artboard', params: { fw: 400, fh: 400 } }, { id: 2, type: 'output', params: {} }], links: [] };
const dois = abNormaliza({ next: 3, active: 'x1', doc: { order: ['x1', 'x2'], spacing: 0 }, list: [
  { id: 'x1', name: 'Um', seq: 1, w: 800, h: 600, graph: JSON.parse(JSON.stringify(gA)) },
  { id: 'x2', name: 'Dois', seq: 2, w: 400, h: 400, graph: JSON.parse(JSON.stringify(gB)) },
]});
dois.list[0].graph.nodes[0].params.fw = 111;
ok(dois.list[1].graph.nodes[0].params.fw === 400, 'mexer num grafo não toca no outro');
ok(dois.list[0].graph !== dois.list[1].graph && dois.list[0].graph.nodes !== dois.list[1].graph.nodes, 'grafos não são o mesmo objeto');

/* ---------- 4. salvar e reabrir preserva tudo ---------- */
const salvo = JSON.parse(JSON.stringify(dois));
const reaberto = abNormaliza(salvo);
ok(reaberto.list.map(e => e.id).join() === 'x1,x2' && reaberto.list.map(e => e.name).join() === 'Um,Dois',
  'ids e nomes sobrevivem ao save/load');
ok(reaberto.active === 'x1' && reaberto.doc.order.join() === 'x1,x2' && reaberto.next === 3,
  'ativo, ordem dos sockets e próximo número preservados');
ok(reaberto.list[1].graph.nodes.length === 2, 'grafo de cada Artboard preservado');

/* ---------- 5. Output local de 1 socket × Output do documento multi ---------- */
ok(/title: 'Output', cat: 'output', inputs: \['Image'\]/.test(html), 'Output local continua com um único socket');
ok(abConectados(dois).length === 2, 'Output do documento aceita várias entradas (por ID)');

/* ---------- 6. ordem dos sockets manda (não a alfabética) ---------- */
const tres = abNormaliza({ next: 4, active: 'z', doc: { order: ['z', 'a', 'm'], spacing: 0 }, list: [
  { id: 'z', name: 'Zulu', seq: 1, w: 100, h: 50, graph: null },
  { id: 'a', name: 'Alfa', seq: 2, w: 80, h: 80, graph: null },
  { id: 'm', name: 'Mike', seq: 3, w: 120, h: 60, graph: null },
]});
ok(abConectados(tres).map(e => e.name).join() === 'Zulu,Alfa,Mike', 'composição segue a ordem dos sockets: Zulu, Alfa, Mike');
const dims6 = abComposeDims(abConectados(tres).map(e => ({ w: e.w, h: e.h })), 0);
ok(dims6.w === 300 && dims6.h === 80, 'carrossel soma larguras e usa a maior altura', dims6);
ok(dims6.offsets.map(o => o.x).join() === '0,100,180', 'cada um encosta no anterior (espaçamento 0)');
ok(dims6.offsets.map(o => o.y).join() === '15,0,10', 'centrados na vertical, sem distorcer');

/* ---------- 7. reordenar e desconectar ---------- */
let ordem = ['z', 'a', 'm'];
ordem = abOrdemMove(ordem, 'm', -1);
ok(ordem.join() === 'z,m,a', 'mover socket troca a posição na composição');
ordem = abOrdemMove(ordem, 'z', -1);
ok(ordem.join() === 'z,m,a', 'mover para fora da ponta não quebra a ordem');
ordem = abOrdemLiga(ordem, 'm', false);
ok(ordem.join() === 'z,a', 'desconectar tira da composição sem índice inválido');
ordem = abOrdemLiga(ordem, 'm', true);
ok(ordem.join() === 'z,a,m', 'reconectar entra à direita');
const tres2 = abNormaliza({ ...tres, doc: { order: ordem, spacing: 0 } });
ok(abConectados(tres2).map(e => e.id).join() === ordem.join(), 'ordem nova persiste ao salvar/reabrir');

/* ---------- 8/9. export individual e carrossel: dimensões nativas ---------- */
const um = abComposeDims([{ w: 1920, h: 1080 }], 0);
ok(um.w === 1920 && um.h === 1080 && um.offsets[0].x === 0 && um.offsets[0].y === 0, 'individual sai no tamanho nativo');
ok(/c\.width = ent\.w; c\.height = ent\.h/.test(html) && /drawImage\(base, 0, 0\)/.test(html),
  'recorte do Artboard é nas dimensões dele, sem escala (clip/pad)');
const comEspaco = abComposeDims([{ w: 100, h: 50 }, { w: 100, h: 50 }], 10);
ok(comEspaco.w === 210 && comEspaco.offsets[1].x === 110, 'espaçamento entra entre os Artboards (padrão 0)');

/* ---------- 10. dimensões diferentes + desconectados aparecem ---------- */
ok(abDesconectados(tres2).length === 0 && abDesconectados(tres).length === 0, 'todos ligados: nada some em silêncio');
const parcial = abNormaliza({ ...tres, doc: { order: ['a'], spacing: 0 } });
ok(abDesconectados(parcial).map(e => e.name).join() === 'Zulu,Mike', 'desconectados são listados para o usuário conectar');
ok(/Not connected to the document Output/.test(html) && /Connect all/.test(html),
  'gerenciador e exportação avisam e oferecem conectar todos');

/* ---------- 11. migração de projeto antigo ---------- */
const legado = { nodes: [
  { id: 1, type: 'fill', params: { fw: 800, fh: 600 } },
  { id: 2, type: 'output', params: {} },
], links: [{ from: 1, to: 2, input: 0 }] };
const mig = abDeLegado(JSON.parse(JSON.stringify(legado)));
ok(mig.list[0].name === 'Artboard 1' && mig.list[0].w === 800 && mig.list[0].h === 600,
  'projeto antigo vira Artboard 1 com as dimensões do Fill');
ok(mig.list[0].graph.nodes.length === 2 && mig.list[0].graph.links.length === 1, 'nós e conexões intactos na migração');
ok(abDimsDeSer(legado.nodes, legado.links).w === 800, 'dimensões vêm do Fill que alimenta o Output');
const comNo = { nodes: [{ id: 1, type: 'artboard', params: { fw: 640, fh: 480 } },
                        { id: 2, type: 'fill', params: { fw: 800, fh: 600 } }], links: [] };
ok(abDimsDeSer(comNo.nodes, comNo.links).w === 640, 'havendo nó Artboard, é ele quem define o canvas');

/* ---------- 12. fluxo de 1 Artboard não muda ---------- */
ok(/function exportPNG\(\) \{\n  if \(AB && AB\.list\.length > 1\) return abExportDialog\(\);\n  return exportPNGAtual\(\);\n\}/.test(html),
  'com um Artboard só, a exportação é a de sempre');
ok(/const a = createNode\('fill', 60, 140/.test(html), 'New Document continua nascendo com Fill → Output');

console.log('Artboards · integração');

/* ---------- nó Artboard na categoria Generative ---------- */
ok(/generative: \{ label: 'Generative'/.test(html), 'categoria Generative existe no menu Add');
ok(/artboard: \{\n    title: 'Artboard', cat: 'generative', inputs: \[\], outs: \['Image'\]/.test(html),
  'nó Artboard é fonte de imagem (sem entradas) na Generative');
ok(/artboard: n => runArtboard\(n\)/.test(html) && /function runArtboard/.test(html), 'RUN do Artboard registrado');
ok(/c\.width = W; c\.height = H;/.test(extrai('function runArtboard', '/* ---------- Fill gradient')) &&
   !/fillDesenha|fillGradFx/.test(extrai('function runArtboard', '/* ---------- Fill gradient')),
  'canvas do Artboard começa transparente (não pinta fundo)');
ok(/NUM\('fw', 'Width \(px\)', 1, 8192, 1024\)/.test(html), 'controles do nó são só as medidas do canvas');

/* ---------- fiação com o editor ---------- */
ok(/ab: abExporta\(\),/.test(html) && /if \(AB\) abDobraAtual\(\);/.test(html), 'serialize dobra o grafo vivo e anexa o bloco ab');
ok(/abCarregaDe\(data\);/.test(html), 'abrir projeto carrega/migra os Artboards (loadGraphData)');
ok(/function abTroca/.test(html) && /await ssSaveProject\(\)/.test(extrai('async function abTroca', 'function abNovo')),
  'trocar de Artboard salva antes (persistência existente)');
ok(/undoStack\.length = 0/.test(extrai('async function abTroca', 'function abNovo')), 'desfazer não vaza entre Artboards');
ok(/createNode\('artboard', 60, 140/.test(html) && /AB\.doc\.order\.push\(e\.id\)/.test(html),
  'novo Artboard nasce com nó Artboard → Output e ligado ao documento');
ok(/const imgIds = new Set\(\);/.test(html) && /data\.ab\.list/.test(html), 'salvar guarda as imagens de todos os Artboards');
ok(/id="abBar"/.test(html) && /id="abCrumb"/.test(html) && /id="abChips"/.test(html), 'barra com breadcrumb e chips no editor');
ok(/' › ' \+ \(ativo \? ativo\.name : ''\)/.test(html) || /›/.test(html), 'breadcrumb Documento › Artboard');
ok(/Socket ' \+ \(pos \+ 1\)/.test(html), 'sockets identificados pelo nome/posição no gerenciador');
ok(/'Artboard individual'/.test(html) && /'Carrossel — todos os Artboards'/.test(html), 'exportação oferece individual e carrossel');
ok(/JPG · com cor de fundo/.test(html) && /PNG · transparência/.test(html), 'formato sem alfa pede cor de fundo; PNG preserva transparência');
ok(/Artboards \/ Output/.test(html) && /id="abManage"/.test(html), 'gerenciador descobrível na barra do editor');

process.exit(resumo() ? 0 : 1);
