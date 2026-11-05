/* Anotações: o nó Note (texto/cor/tamanho/opacidade) e a caneta livre no grafo.
   3.7.1: a anotação virou nó e o arrasto dos traços foi consertado. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}
const mod = extrai('3.7.1 — Anotações', 'function showGroupMenu(');
const def = extrai('  note: {', '  effectStack: {');

console.log('anotações · nó Note + caneta');

/* ---------- 1. a anotação é um nó de verdade ---------- */
{
  ok(/title: 'Note \(annotation\)', cat: 'compose'/.test(def), 'o nó Note existe na categoria Composite');
  ok(/annot: true, inputs: \[\], outs: \[\]/.test(def), 'não tem sockets: não entra no fluxo da imagem');
  ok(/params: \[\{ type: 'note', key: 'text'/.test(def), 'o corpo é um controle próprio de nota');
  ok(/kw: 'note nota annotation annotate/.test(def), 'acha o nó buscando note/annotation/comment/sticky');
  ok(/else if \(p\.type === 'note'\) el = makeNoteControl\(n, p\);/.test(html), 'o controle está ligado ao construtor de nós');
  const ctl = extrai('function makeNoteControl(n, p) {', 'function buildControls(n, body) {');
  ok(/createElement\('textarea'\)/.test(ctl) && /ta\.className = 'note-txt'/.test(ctl), 'o texto é editado direto no nó (textarea)');
  ok(/n\.params\[p\.key\] = ta\.value/.test(ctl), 'o texto digitado vai para os params (e para o save)');
  ok(/n\.params\.color == null/.test(ctl), 'cor/tamanho/opacidade nascem com padrão');
  ok(/for \(const c of ANN_CORES\)/.test(ctl), 'a nota tem a paleta de cores das anotações');
  ok(/campo\('Size', 10, 34, 'fs'\)/.test(ctl) && /campo\('Opacity', 10, 100, 'alpha'\)/.test(ctl), 'tamanho e opacidade no próprio nó');
  ok(/n\.ui\.noteLook = pinta/.test(ctl), 'o visual acompanha as mudanças na hora');
  ok(/const alvo = \(\) => n\.el \|\| document\.querySelector/.test(ctl) && /host\.classList\.add\('note-node'\)/.test(ctl),
    'o nó ganha a classe de nota (elemento resolvido na hora de pintar)');
  ok(/\.note-node\{border-color:#ffd640/.test(html) && /\.note-txt\{/.test(html), 'CSS próprio do nó Note');
}

/* ---------- 2. criar nota pelo painel, pelo menu e pelo atalho ---------- */
{
  ok(/<button class="tbtn" id="btnAnnot"[^>]*>Annotate<\/button>/.test(html), 'botão Annotate na barra');
  ok(/id="annBar" hidden/.test(html), 'painel começa fechado');
  for (const id of ['annNote', 'annWrap', 'annPenBtn', 'annDup', 'annDel', 'annSwatches', 'annFs', 'annOp']) {
    ok(new RegExp('id="' + id + '"').test(html), `o painel tem #${id}`);
  }
  ok(/\+\s*Note node|\+ Note node/.test(html), 'o botão diz que cria um nó Note');
  ok(/function annNota\(at\)/.test(mod) && /createNode\('note'/.test(mod), 'criar nota = createNode(\'note\')');
  ok(/selected\.add\(n\.id\);\n  refreshSelection\(\);/.test(mod), 'a nota nasce selecionada');
  ok(/markDirty\(n\.id\); requestRender\(\); commit\(\);/.test(mod), 'criar nota entra no undo/autosave');
  ok(/function annNotaEm\(\)/.test(mod), 'dá para criar nota no ponto do clique direito');
  const menu = extrai('function showGroupMenu(clientX, clientY) {', "document.addEventListener('keydown', e => { if (e.key === 'Escape') hideGroupMenu(); });");
  ok(/add\('Add note node here'/.test(menu), 'menu de contexto: Add note node here');
  ok(/annAt = screenToWorld\(clientX, clientY\)/.test(menu), 'a nota nasce onde o usuário clicou');
  ok(/add\('Frame selection', 'Ctrl\+G'/.test(menu), 'menu também emoldura a seleção (grupo de nós)');
}

/* ---------- 3. estilo aplicado à nota e à tinta ---------- */
{
  ok(/for \(const id of selected\) \{/.test(mod) && /if \(!n \|\| n\.type !== 'note'\) continue;/.test(mod), 'cor/tamanho/opacidade vão para as notas selecionadas');
  ok(/if \(n\.ui && n\.ui\.noteLook\) n\.ui\.noteLook\(\)/.test(mod), 'mudar o estilo repinta o nó');
  ok(/if \(patch\.alpha != null\) a\.alpha = patch\.alpha;/.test(mod), 'a opacidade também vale para a tinta');
  ok(/for \(const b of bar\.querySelectorAll\('\.ann-sw'\)\)/.test(mod), 'o painel mostra a cor do que está selecionado');
}

/* ---------- 4. caneta: desenho e arrasto funcionando ---------- */
{
  ok(/function annPenBaixo\(e\)/.test(mod) && /\{ capture: true \}\)/.test(mod), 'a caneta escuta em captura (antes do pan)');
  ok(/if \(e\.target\.closest\('\[data-ann\]'\)\) return;/.test(mod), 'com a caneta ligada, clicar num traço existente seleciona');
  ok(/if \(Math\.abs\(q\.x - last\.x\) \+ Math\.abs\(q\.y - last\.y\) < 1\.5\) return;/.test(mod), 'pontos colados não incham o traço');
  ok(/annSetPen\(true\)|annPenOn \? 'Pen on/.test(mod), 'o modo caneta avisa no status');
  ok(/\.ann-penhit\{[^}]*pointer-events:stroke/.test(html), 'o traço tem área de clique generosa');
}

/* ---------- 5. a correção do arrasto (3.7.1) ---------- */
{
  const pega = extrai('function annPega(e, a, el) {', 'function annSetPen(');
  ok(!/annRender\(\)/.test(pega), 'selecionar não reconstrói o DOM (era o que matava o arrasto)');
  ok(/annSelVisual\(\)/.test(pega), 'a seleção só troca a classe');
  ok(/window\.addEventListener\('pointermove', move\)/.test(pega) && /window\.addEventListener\('pointerup', up\)/.test(pega),
    'o gesto vive na window: redesenho no meio não perde o arrasto');
  ok(/window\.removeEventListener\('pointermove', move\)/.test(pega), 'o gesto solta os listeners ao terminar');
  ok(/const dx = Math\.round\(\(ev\.clientX - x0\) \/ view\.zoom\)/.test(pega), 'o arrasto respeita o zoom do grafo');
  ok(/function annSelVisual\(\)/.test(mod) && /for \(const a of annots\)/.test(extrai('function annSelVisual', 'function annPega(')),
    'annSelVisual atualiza só os traços existentes');
}

/* ---------- 6. apagar, duplicar, empurrar ---------- */
{
  ok(/function annApagaSel/.test(mod) && /annots = annots\.filter\(a => !annSel\.has\(a\.id\)\)/.test(mod), 'apagar a tinta remove de verdade');
  ok(/function annDuplicaSel/.test(mod) && /c\.pts\[i\] \+= 28/.test(mod), 'duplicar desloca a cópia');
  ok(/e\.key === 'Delete' \|\| e\.key === 'Backspace'/.test(mod), 'Del apaga o traço selecionado');
  ok(/const passo = e\.shiftKey \? 10 : 1;/.test(mod), 'setas empurram o traço (Shift = 10)');
  ok(/alvo\.isContentEditable/.test(mod), 'digitar num texto não apaga o traço');
  for (const f of ['annNota', 'annEstilo', 'annApagaSel', 'annDuplicaSel', 'annPega']) {
    ok(/commit\(\)/.test(extrai('function ' + f + '(', '\nfunction ')), `${f} entra no undo/autosave`);
  }
}

/* ---------- 7. persistência e migração da 3.7.0 ---------- */
{
  ok(/annots: annSerialize\(\),/.test(html), 'a tinta entra no estado salvo');
  ok(/annLoad\(data\.annots\);/.test(html), 'restore/save carrega a tinta de volta');
  ok(/kind: 'pen', x: a\.x, y: a\.y, color: a\.color, lw: a\.lw/.test(mod), 'o traço salva pontos, cor e espessura');
  ok(/function annLegado\(d\)/.test(mod) && /createNode\('note'/.test(extrai('function annLegado', 'function annLoad')),
    'notas/molduras da 3.7.0 são migradas para nós Note ao carregar');
  ok(/annLegado\(d\);\s+\/\/ nota\/moldura/.test(mod), 'a migração roda no annLoad');
  ok(/a\.pts = Array\.isArray\(d\.pts\)/.test(mod), 'traço antigo sem pontos não quebra o carregamento');
  ok(/color: \/\^#\[0-9a-fA-F\]\{6\}\$\/\.test/.test(mod), 'cor inválida cai na paleta');
}

/* ---------- 8. nada de sobra da versão flutuante ---------- */
{
  ok(!/\.ann-note\{/.test(html) && !/\.ann-frame\{/.test(html) && !/\.ann-cap\{/.test(html), 'CSS das notas/molduras flutuantes saiu');
  ok(!/id="annLayer"/.test(html) && !/#annLayer\{/.test(html), 'a camada das notas flutuantes saiu');
  ok(!/function annBoxEl|function annRedimensiona|function annEditaTexto/.test(html), 'funções da versão flutuante saíram');
  ok(/id="annPen"/.test(html) || /#annPen\{/.test(html), 'a camada da caneta continua');
}

process.exit(resumo() ? 0 : 1);
