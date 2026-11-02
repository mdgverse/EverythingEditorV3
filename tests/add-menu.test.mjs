/* Menu radial de categorias (Shift+A): círculo → lista da categoria → seta de volta.
   Roda o bloco real do index.html (marcadores ADD MENU) num DOM mínimo. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function bloco() {
  const a = html.indexOf('/* ==== ADD MENU (BEGIN) ==== */');
  const b = html.indexOf('/* ==== ADD MENU (END) ==== */');
  if (a < 0 || b < 0 || b < a) throw new Error('marcadores ADD MENU não encontrados');
  return html.slice(a, b);
}

/* ---------- DOM mínimo ---------- */
function busca(raiz, sel) {
  const cls = sel.replace(/^\./, '');
  const out = [];
  const anda = e => { for (const c of e.children) { if (c._cls && c._cls.has(cls)) out.push(c); anda(c); } };
  anda(raiz);
  return out;
}

function criaEl(tag = 'div') {
  const el = {
    tagName: tag, parent: null, children: [], dataset: {}, _cls: new Set(), _txt: '',
    hidden: false, title: '', type: '', value: '',
    _h: {},
    style: { setProperty(k, v) { this[k] = v; } },
    classList: {
      add: (...c) => c.forEach(x => el._cls.add(x)),
      remove: (...c) => c.forEach(x => el._cls.delete(x)),
      contains: c => el._cls.has(c),
    },
    append(...k) { for (const x of k) { x.parent = el; el.children.push(x); } },
    remove() { if (el.parent) el.parent.children = el.parent.children.filter(c => c !== el); },
    addEventListener(t, f) { (el._h[t] || (el._h[t] = [])).push(f); },
    fire(t, ev) {
      for (const f of (el._h[t] || [])) f(Object.assign({ preventDefault() {}, stopPropagation() {}, key: '' }, ev || {}));
    },
    focus() {},
    querySelector(sel) { return busca(el, sel)[0] || null; },
    querySelectorAll(sel) { return busca(el, sel); },
    get textContent() { return el._txt + el.children.map(c => c.textContent).join(''); },
    set textContent(v) { el._txt = String(v); el.children = []; },
  };
  Object.defineProperty(el, 'innerHTML', { get() { return ''; }, set() { el.children = []; el._txt = ''; } });
  Object.defineProperty(el, 'className', {
    get() { return [...el._cls].join(' '); },
    set(v) { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  return el;
}

/* ---------- dados falsos (mesmo formato do editor) ---------- */
const NODE_TYPES = {
  img: { title: 'Image', cat: 'input', inputs: [], kw: 'image' },
  fill: { title: 'Fill', cat: 'input', inputs: [], kw: 'solid' },
  blur: { title: 'Blur', cat: 'filter', inputs: [{}], kw: 'soft' },
  grain: { title: 'Grain', cat: 'filter', inputs: [{}], kw: 'noise' },
  mix: { title: 'Mix', cat: 'compose', inputs: [{}, {}], kw: 'mix' },
  out: { title: 'Output', cat: 'output', inputs: [{}], kw: 'out' },
};
const CATS = {
  input: { label: 'Input', color: '#3b6e54' },
  filter: { label: 'Filter', color: '#2f6190' },
  compose: { label: 'Composite', color: '#8c6228' },
  output: { label: 'Output', color: '#8a3b3b' },
};

function monta() {
  const addMenu = criaEl('div'); addMenu.hidden = true;
  const addWheel = criaEl('div');
  const addPanel = criaEl('div'); addPanel.hidden = true;
  const addSearch = criaEl('input');
  const addList = criaEl('div');
  const addBack = criaEl('button');
  const addTitle = criaEl('span');
  const addHub = criaEl('button');
  const addHubTxt = criaEl('span');
  addWheel.append(addHub); addHub.append(addHubTxt);

  const documentStub = { createElement: criaEl, body: criaEl('body'), addEventListener() {} };
  const viewEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 900 }) };
  const inseridos = [];

  const src = bloco();
  const fabrica = new Function(
    'document', 'window', 'E', 'clamp', 'CATS', 'NODE_TYPES', 'MACHINE_HIDDEN_PICK', 'noDesativado', 'outputNode',
    'addMenu', 'addSearch', 'addList', 'addWheel', 'addPanel', 'addBack', 'addTitle', 'addHub', 'addHubTxt',
    'viewEl', 'screenToWorld', 'sortTypesByTitle', 'addNodeAt', 'drawLinks', 'commit', 'requestRender', 'linkTo', 'connect',
    'let addPos = { x: 0, y: 0 };\nlet pendingLink = null;\n' + src +
    '\nreturn { openAddMenu, hideAddMenu, abrirLista, voltarCategorias, renderAddWheel, renderAddList,' +
    ' get view() { return addView; }, get cat() { return addCat; },' +
    ' setPending(v) { pendingLink = v; }, get pending() { return pendingLink; } };'
  );
  const api = fabrica(
    documentStub, { innerWidth: 1200, innerHeight: 900 },
    (tag, cls, text) => { const e = criaEl(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; },
    (v, a, b) => Math.min(b, Math.max(a, v)),
    CATS, NODE_TYPES, {}, () => false, () => null,
    addMenu, addSearch, addList, addWheel, addPanel, addBack, addTitle, addHub, addHubTxt,
    viewEl, (x, y) => ({ x, y }),
    entradas => entradas.sort((a, b) => a[1].title.localeCompare(b[1].title)),
    (t) => inseridos.push(t), () => {}, () => {}, () => {}, () => false, () => {}
  );
  return { api, addMenu, addWheel, addPanel, addList, addBack, addTitle, addSearch, addHub, inseridos };
}

/* ---------- testes ---------- */
console.log('menu radial de categorias');

{
  const { api, addWheel, addPanel } = monta();
  api.openAddMenu(600, 400);
  const cats = addWheel.querySelectorAll('.add-cat');
  ok(api.view === 'wheel', 'Shift+A abre no círculo');
  ok(addPanel.hidden === true, 'a lista começa escondida');
  ok(cats.length === 4, 'um botão por categoria com nós disponíveis', cats.length);
  ok(cats.every(b => b.dataset.cat), 'cada botão guarda a categoria');
  ok(cats.every(b => b.style['--wx'] && b.style['--wy']), 'cada botão recebe a posição no círculo');
  ok(cats.filter(b => b.classList.contains('hi')).length === 1, 'exatamente um item destacado');
  const rotulos = cats.map(b => b.textContent).join('|');
  ok(rotulos.includes('Input') && rotulos.includes('Composite'), 'rótulos das categorias no círculo', rotulos);
  ok(cats.some(b => /rgba\(/.test(b.style.background)), 'cada categoria usa a sua cor');
}

{
  const { api, addWheel, addPanel, addList, addTitle } = monta();
  api.openAddMenu(600, 400);
  const alvo = addWheel.querySelectorAll('.add-cat').find(b => b.dataset.cat === 'filter');
  alvo.fire('click');
  ok(api.view === 'list', 'escolher categoria troca para a lista');
  ok(api.cat === 'filter', 'a categoria escolhida fica ativa', api.cat);
  ok(addPanel.hidden === false, 'a lista aparece');
  ok(addTitle.textContent === 'Filter', 'o topo mostra o nome da categoria', addTitle.textContent);
  const itens = addList.querySelectorAll('.add-item').map(b => b.dataset.type);
  ok(itens.join(',') === 'blur,grain', 'lista só com os nós da categoria', itens.join(','));
  ok(addList.querySelectorAll('.add-group').length === 0, 'sem cabeçalho repetindo a categoria');
}

{
  const { api, addWheel, addPanel, addBack } = monta();
  api.openAddMenu(600, 400);
  addWheel.querySelectorAll('.add-cat').find(b => b.dataset.cat === 'compose').fire('click');
  addBack.fire('click');
  ok(api.view === 'wheel', 'a seta do topo volta ao círculo');
  ok(addPanel.hidden === true, 'a lista esconde ao voltar');
  ok(addWheel.hidden === false && addWheel.querySelectorAll('.add-cat').length === 4, 'círculo remontado');
}

{
  const { api, addWheel, addList } = monta();
  api.openAddMenu(600, 400, { outId: 'n1' });   // arrastando uma saída
  const cats = addWheel.querySelectorAll('.add-cat').map(b => b.dataset.cat);
  ok(!cats.includes('input'), 'categoria sem entrada livre sai do círculo', cats.join(','));
  api.abrirLista('filter');
  ok(addList.querySelectorAll('.add-item').length === 2, 'a lista segue o filtro do link pendente');
}

{
  const { api, addList, addTitle } = monta();
  api.openAddMenu(600, 400);
  api.abrirLista(null);                      // lupa do centro
  ok(addTitle.textContent === 'All nodes', 'a lupa mostra todas as categorias');
  ok(addList.querySelectorAll('.add-group').length === 4, 'com cabeçalho de categoria em cada grupo');
  api.renderAddList('blur');
  const itens = addList.querySelectorAll('.add-item').map(b => b.dataset.type);
  ok(itens.join(',') === 'blur', 'busca filtra dentro de todas as categorias', itens.join(','));
  api.renderAddList('zzz');
  ok(addList.querySelectorAll('.add-empty').length === 1, 'sem resultado mostra aviso');
}

{
  const { api, addList, inseridos } = monta();
  api.openAddMenu(600, 400);
  api.abrirLista('input');
  addList.querySelectorAll('.add-item')[0].fire('click');
  ok(inseridos.length === 1, 'clicar num nó cria o nó', inseridos[0]);
  ok(api.pending === null, 'o link pendente é consumido pelo nó escolhido');
}

{
  const { api, addMenu } = monta();
  api.openAddMenu(600, 400);
  api.hideAddMenu();
  ok(addMenu.hidden === true, 'Esc/fechar esconde o menu');
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
