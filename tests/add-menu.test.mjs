/* Menu radial de categorias (Shift+A): anel de fatias → lista da categoria → seta de volta.
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
    tagName: tag, parent: null, children: [], dataset: {}, attrs: {}, _cls: new Set(), _txt: '',
    hidden: false, title: '', type: '', value: '', _path: null, _txtEl: null,
    _h: {},
    style: { setProperty(k, v) { this[k] = v; } },
    classList: {
      add: (...c) => c.forEach(x => el._cls.add(x)),
      remove: (...c) => c.forEach(x => el._cls.delete(x)),
      contains: c => el._cls.has(c),
      toggle: (c, on) => { const v = on === undefined ? !el._cls.has(c) : !!on; if (v) el._cls.add(c); else el._cls.delete(c); return v; },
    },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
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
  Object.defineProperty(el, 'className', {
    get() { return [...el._cls].join(' '); },
    set(v) { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  Object.defineProperty(el, 'innerHTML', { get() { return ''; }, set() { el.children = []; el._txt = ''; } });
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
  const addSvg = criaEl('svg');
  const addSectors = criaEl('g');
  addSvg.append(addSectors);
  addWheel.append(addSvg);
  const addPanel = criaEl('div'); addPanel.hidden = true;
  const addSearch = criaEl('input');
  const addList = criaEl('div');
  const addBack = criaEl('button');
  const addTitle = criaEl('span');
  const addHub = criaEl('button');
  const addHubTxt = criaEl('span');
  addWheel.append(addHub); addHub.append(addHubTxt);

  const documentStub = {
    createElement: criaEl,
    createElementNS: (ns, tag) => criaEl(tag),
    body: criaEl('body'),
    addEventListener() {},
  };
  const viewEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 900 }) };
  const inseridos = [];

  const src = bloco();
  const fabrica = new Function(
    'document', 'window', 'E', 'clamp', 'CATS', 'NODE_TYPES', 'MACHINE_HIDDEN_PICK', 'noDesativado', 'outputNode',
    'addMenu', 'addSearch', 'addList', 'addWheel', 'addPanel', 'addBack', 'addTitle', 'addHub', 'addHubTxt',
    'addSvg', 'addSectors',
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
    addSvg, addSectors,
    viewEl, (x, y) => ({ x, y }),
    entradas => entradas.sort((a, b) => a[1].title.localeCompare(b[1].title)),
    t => inseridos.push(t), () => {}, () => {}, () => {}, () => false, () => {}
  );
  return { api, addMenu, addWheel, addSvg, addSectors, addPanel, addList, addBack, addTitle, addSearch, addHub, inseridos };
}

/* ---------- testes ---------- */
console.log('menu radial de categorias');

{
  const { api, addSectors, addPanel, addSvg } = monta();
  api.openAddMenu(600, 400);
  const fatias = addSectors.children;
  ok(api.view === 'wheel', 'Shift+A abre no anel');
  ok(addPanel.hidden === true, 'a lista começa escondida');
  ok(addSvg.getAttribute('viewBox') !== null, 'o anel é desenhado em SVG');
  ok(fatias.length === 4, 'uma fatia por categoria com nós disponíveis', fatias.length);
  ok(fatias.every(g => g.dataset.cat), 'cada fatia guarda a categoria');
  ok(fatias.every(g => g._path && /^M[\d.,]+ A[\d.]+/.test(g._path.getAttribute('d') || '')), 'cada categoria é um setor do anel');
  ok(fatias.filter(g => g.classList.contains('hi')).length === 1, 'exatamente uma fatia destacada');
  const rotulos = fatias.map(g => g.textContent).join('|');
  ok(rotulos.includes('Input') && rotulos.includes('Composite'), 'nomes escritos dentro das fatias', rotulos);
  ok(fatias.some(g => /rgba\(/.test(g._path.getAttribute('fill') || '')), 'cada fatia usa a cor da categoria');

  /* geometria: em ordem, sem sobreposição e sem buraco */
  const ang = fatias.map(g => [Number(g.dataset.a0), Number(g.dataset.a1)]);
  ok(ang.every(([a0, a1]) => a1 > a0), 'cada fatia tem abertura positiva');
  ok(Math.abs(ang[0][0] + 90) < 3, 'a primeira fatia começa no topo', ang[0][0]);
  ok(ang.every((v, i) => i === 0 || v[0] >= ang[i - 1][1]), 'fatias em ordem e sem sobreposição');
  ok(ang.every((v, i) => i === 0 || v[0] - ang[i - 1][1] < 4), 'vão entre fatias é mínimo (anel contínuo)');
  const cobertura = ang.reduce((t, [a0, a1]) => t + (a1 - a0), 0);
  ok(cobertura > 360 - fatias.length * 4.5 && cobertura <= 360, 'as fatias cobrem o anel inteiro', cobertura);
}

{
  const { api, addSectors, addPanel, addList, addTitle } = monta();
  api.openAddMenu(600, 400);
  addSectors.children.find(b => b.dataset.cat === 'filter').fire('click');
  ok(api.view === 'list', 'escolher categoria troca para a lista');
  ok(api.cat === 'filter', 'a categoria escolhida fica ativa', api.cat);
  ok(addPanel.hidden === false, 'a lista aparece');
  ok(addTitle.textContent === 'Filter', 'o topo mostra o nome da categoria', addTitle.textContent);
  const itens = addList.querySelectorAll('.add-item').map(b => b.dataset.type);
  ok(itens.join(',') === 'blur,grain', 'lista só com os nós da categoria', itens.join(','));
  ok(addList.querySelectorAll('.add-group').length === 0, 'sem cabeçalho repetindo a categoria');
}

{
  const { api, addSectors, addPanel, addBack } = monta();
  api.openAddMenu(600, 400);
  addSectors.children.find(b => b.dataset.cat === 'compose').fire('click');
  addBack.fire('click');
  ok(api.view === 'wheel', 'a seta do topo volta ao anel');
  ok(addPanel.hidden === true, 'a lista esconde ao voltar');
  ok(addSectors.children.length === 4, 'anel remontado');
}

{
  const { api, addSectors, addList } = monta();
  api.openAddMenu(600, 400, { outId: 'n1' });   // arrastando uma saída
  const cats = addSectors.children.map(b => b.dataset.cat);
  ok(!cats.includes('input'), 'categoria sem entrada livre sai do anel', cats.join(','));
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

/* ---------- radial é o único modo (3.9.1: galeria removida) ---------- */
{
  const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const simbolo of ['ADD_MENU_MODE', 'ADD_MENU_KEY', 'openAddGallery', 'galEl', 'galFecha',
    'galMonta', 'galAplica', 'GAL_SAMPLE', 'addViewSel', "$gal(", 'ee-gallery-css', 'id="addGal"']) {
    ok(src.indexOf(simbolo) < 0, 'a galeria saiu por completo: ' + simbolo);
  }
  ok(!/Node picker/.test(src), 'a opção "Node picker" saiu das preferências');
  ok(/\.gal\{/.test(src) === false, 'nenhum CSS órfão de galeria');
  ok(/function openAddMenu\(clientX, clientY, pending = null\) \{\s*const w = screenToWorld\(clientX, clientY\);\s*addPos = \{ x: w\.x - 100, y: w\.y - 14 \};\s*pendingLink = pending;\s*addClique = \{ x: clientX, y: clientY \};\s*addMenu\.hidden = false;/.test(src),
    'abrir o menu vai direto para o radial, sem desvio');
  ok(/abrirCategorias\(\);/.test(src), 'o radial (círculo de categorias) continua sendo aberto');
  ok(/let addView = 'wheel';/.test(src), 'a única visão é a roda');
  ok(/const CATS = \{/.test(src) && /add-wheet|add-wheel|addWheel/.test(src), 'as categorias e o círculo seguem no lugar');
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
