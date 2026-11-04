/* Add menu · Gallery (3.4.0) — alternativa ao círculo: grade de nós com
   amostra (a foto embutida) + controles, como uma galeria de filtros. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const recorta = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

console.log('Add menu · Gallery');

/* ---------- a preferência, logo abaixo do Node / Noodle Curve ---------- */
const marca = recorta('<div class="brand-menu" id="brandMenu"', '<div id="projTabs"');
ok(/id="addViewSel"/.test(marca), 'a opção mora no menu da marca (preferências)', 'sel');
ok(/<option value="wheel">Wheel \(base\)<\/option><option value="gallery">Gallery \(alternative\)<\/option>/.test(marca),
  'nomes exatos: Wheel (base) / Gallery (alternative)', 'nomes');
ok(marca.indexOf('id="curveSel"') < marca.indexOf('id="addViewSel"'),
  'vem logo depois da seleção do tipo de node/noodle', 'ordem');
ok(marca.indexOf('id="addViewSel"') - marca.indexOf('id="curveSel"') < 700, 'é o vizinho imediato dessa seção', 'vizinho');

ok(/const ADD_MENU_KEY = 'ee_add_menu'/.test(html), 'a escolha é salva no navegador', 'chave');
ok(/function setAddMenuMode\(m\) \{[\s\S]*?localStorage\.setItem\(ADD_MENU_KEY/.test(html), 'trocar a opção persiste');
ok(/if \(ADD_MENU_MODE === 'gallery'\) \{ openAddGallery\(\); return; \}/.test(html),
  'Shift+A / Add / botão direito abrem a galeria quando ela é a escolhida', 'openAddMenu');
ok(/if \(sel\) sel\.addEventListener\('change', \(\) => setAddMenuMode\(sel\.value\)\)/.test(html), 'o select aplica na hora');
ok(/aplicaAddMenuMode\(\);/.test(html) && /sel\.value = ADD_MENU_MODE/.test(html), 'o select começa com a preferência salva');

/* ---------- a tela ---------- */
ok(/<div id="addGal" class="gal" hidden role="dialog"/.test(html), 'overlay próprio da galeria', 'overlay');
for (const id of ['galBig', 'galBusca', 'galCats', 'galGrid', 'galNome', 'galParams', 'galAdd', 'galCancelar', 'galFechar']) {
  ok(new RegExp('id="' + id + '"').test(html), 'peça da galeria: ' + id);
}
ok(/limite|disabled/.test(html), 'painel de controles existe');
ok(/\.gal\{position:fixed;inset:0/.test(html), 'cobre a tela (como um diálogo)');
ok(/@media \(max-width: 900px\)\{[\s\S]*?\.gal\{grid-template-columns:1fr/.test(html), 'no celular empilha (preview em cima, grade no meio, controles embaixo)');

/* ---------- a amostra (a foto do usuário) embutida ---------- */
const amostra = /const GAL_SAMPLE = 'data:image\/jpeg;base64,([A-Za-z0-9+/=]+)';/.exec(html);
ok(!!amostra, 'a amostra é uma foto JPEG embutida (o APK leva só o index.html)');
ok(amostra && amostra[1].length > 12000, 'amostra em resolução decente', amostra ? amostra[1].length : 0);
ok(/function galAmostraTex\(largura\)/.test(html) && /gl\.pixelStorei\(gl\.UNPACK_FLIP_Y_WEBGL, true\)/.test(html),
  'a amostra sobe para a GPU como textura (texto ao contrário não acontece)', 'textura');

/* ---------- cada cartão roda o próprio nó sobre a amostra ---------- */
const roda = recorta('function galRoda(tipo, over, largura) {', '/* cobre o canvas');
ok(/run = RUN\[tipo\];/.test(roda), 'o cartão usa o executor de verdade do nó', 'RUN');
ok(/run\(n, nodeInputs\(n\)\.map\(\(\) => src\)\)/.test(roda), 'a amostra entra pelas entradas do nó', 'entradas');
ok(/tipo === 'output' \|\| def\.cat === 'audio'/.test(roda), 'nós de saída/áudio não geram miniatura', 'pula');
ok(/if \(!nodeInputs\(n\)\.length\) return null;/.test(roda), 'gerador mostra a amostra crua', 'gerador');
ok(/catch \(e\) \{ return null; \}/.test(roda), 'nó que falha não derruba a galeria', 'try');

const desenha = recorta('function galDesenha(cv, res, largura) {', 'function galEnfileira');
ok(/Math\.max\(cv\.width \/ img\.width, cv\.height \/ img\.height\)/.test(desenha), 'a miniatura cobre o cartão (object-fit: cover)', 'cover');
ok(/\(cv\.width - dw\) \/ 2/.test(desenha), 'e fica centralizada');

ok(/function galEnfileira\(tipo, cv\)/.test(html) && /galFila\.set\(tipo, cv\)/.test(html),
  'as miniaturas são desenhadas em fila (não travam a abertura)', 'fila');
ok(/feitos < 2/.test(html) && /requestAnimationFrame\(passo\)/.test(html), 'duas por frame, sem travar');
ok(/if \(res && res\.pooled\) res\.pooled\.busy = false;/.test(html), 'a textura volta para o pool (não vaza memória)');
ok(/if \(alvo\.isConnected && !galEl\.hidden\)/.test(html), 'só desenha cartão visível e com a galeria aberta');

/* ---------- busca, categorias e seleção ---------- */
ok(/function galFiltrados\(\)/.test(html) && /d\.kw \|\| ''\)\.toLowerCase\(\)\.includes\(q\)/.test(html),
  'a busca usa as palavras-chave dos nós', 'busca');
ok(/mk\('All', null\)/.test(html) && /for \(const k of Object\.keys\(CATS\)\) if \(addContar\(k\)\)/.test(html),
  'chips de categoria com a contagem do menu', 'chips');
ok(/function addIndisponivel\(t\)/.test(html) && /filter\(\(\[t\]\) => !addIndisponivel\(t\)\)/.test(html),
  'respeita o que não encaixa (link pendente, nó já existente)');
ok(/card\.addEventListener\('click', \(\) => \{ galEstado\.tipo = t;/.test(html), 'clicar no cartão escolhe o nó');

/* ---------- painel de controles ---------- */
const painel = recorta('function galMontaParams() {', 'function galMonta() {');
ok(/p\.type === 'num'/.test(painel) && /inp\.type = 'range'/.test(painel), 'sliders dos parâmetros numéricos', 'num');
ok(/p\.type === 'enum'/.test(painel) && /p\.type === 'color'/.test(painel), 'selects e cores também aparecem');
ok(/guarda\(p\.key, \+inp\.value\); val\.textContent = inp\.value; galPrevAgenda\(\)/.test(painel),
  'mexer no controle atualiza o preview grande na hora', 'live');
ok(/const galOver = new Map\(\)/.test(html), 'os ajustes ficam guardados por tipo enquanto a galeria está aberta');
ok(/galOver\.clear\(\)/.test(html), 'e são limpos ao fechar');

/* ---------- aplicar / cancelar ---------- */
const aplica = recorta('function galAplica() {', 'if (galBusca) galBusca.addEventListener');
ok(/const n = addNodeAt\(tipo, addPos\.x, addPos\.y\);/.test(aplica), 'Add cria o nó no mesmo lugar do menu', 'add');
ok(/Object\.assign\(n\.params, over\)/.test(aplica) && /markDirty\(n\.id\)/.test(aplica),
  'os ajustes do painel vão junto com o nó', 'params');
ok(/return n;/.test(recorta('function addNodeAt(type, x, y) {', 'addSearch.addEventListener')), 'addNodeAt devolve o nó criado');

const fecha = recorta('function galFecha(cancelado) {', 'function galAplica() {');
ok(/if \(cancelado\) \{/.test(fecha) && /pl\.restore/.test(fecha), 'Cancelar devolve o fio que tinha sido solto', 'restore');
ok(/galFila\.clear\(\)/.test(fecha), 'fechar limpa a fila de miniaturas');
ok(/if \(e\.key === 'Escape'\) \{ if \(galEl && !galEl\.hidden\) galFecha\(true\);/.test(html), 'Esc fecha a galeria', 'esc');
ok(/if \(galEl && !galEl\.hidden\) \{ galFecha\(true\); return true; \}/.test(html), 'botão Voltar do Android fecha a galeria primeiro');

/* ---------- matemática da capa (comportamental) ---------- */
{
  const fonte = desenha + '\nreturn galDesenha;';
  const chamadas = [];
  const ctx = {
    setTransform() {}, clearRect() {}, drawImage(...a) { chamadas.push(a); },
    imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
  };
  const cv = { width: 132, height: 156, getContext: () => ctx };
  const galDesenha = new Function('readResult', 'galPronta', 'galBase', fonte + ';')(
    () => ({ width: 240, height: 320 }), () => true, () => null);
  galDesenha(cv, { tex: 1, w: 240, h: 320 });
  ok(chamadas.length === 1, 'desenha uma vez por cartão', chamadas.length);
  ok(chamadas[0] && chamadas[0][3] >= 132 && chamadas[0][4] >= 156,
    'a imagem cobre o cartão inteiro (sem tarja)', chamadas[0] ? chamadas[0].slice(3, 5).join('x') : '');
  ok(Math.abs(chamadas[0][1] + chamadas[0][3] / 2 - 66) < 0.001, 'centralizada na horizontal',
    chamadas[0][1] + chamadas[0][3] / 2);
}

process.exit(resumo() ? 0 : 1);
