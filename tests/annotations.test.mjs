/* Anotações do grafo (Node Annotator): notas adesivas, molduras e caneta,
   com mover/redimensionar/duplicar/apagar e persistência no save. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}
const mod = extrai('3.7.0 — Anotações do grafo', 'function showGroupMenu(');

console.log('anotações do grafo');

/* ---------- 1. acesso pelo toolbar, pelo menu de contexto e por atalho ---------- */
ok(/<button class="tbtn" id="btnAnnot"[^>]*>Annotate<\/button>/.test(html), 'botão Annotate na barra superior');
ok(/id="annBar" hidden/.test(html), 'o painel de anotações começa fechado');
for (const id of ['annNote', 'annFrame', 'annPenBtn', 'annWrap', 'annDup', 'annDel', 'annSwatches', 'annFs', 'annOp']) {
  ok(new RegExp('id="' + id + '"').test(html), `o painel tem #${id}`);
}
{
  const menu = extrai('function showGroupMenu(clientX, clientY) {', 'document.addEventListener(\'keydown\', e => { if (e.key === \'Escape\') hideGroupMenu(); });');
  ok(/add\('Add note here'/.test(menu), 'menu de contexto do grafo: Add note here');
  ok(/add\('Add frame here'/.test(menu), 'menu de contexto do grafo: Add frame here');
  ok(/annSetPen\(!annPenOn\)/.test(menu), 'menu de contexto liga/desliga a caneta');
  ok(/annAt = screenToWorld\(clientX, clientY\)/.test(menu), 'a anotação nasce no ponto do clique direito');
}

/* ---------- 2. modelo: nota, moldura e traço ---------- */
ok(/w: kind === 'frame' \? 320 : 220/.test(mod) && /h: kind === 'frame' \? 200 : 92/.test(mod), 'moldura e nota nascem com tamanhos diferentes');
ok(/text: kind === 'note' \? 'Double-click to write…' : ''/.test(mod), 'a nota já nasce com um convite ao duplo clique');
ok(/fs: 14, lw: 3/.test(mod), 'fonte e espessura do traço têm padrão');
ok(/'#ffd640'/.test(mod) && (mod.match(/#[0-9a-f]{6}/g) || []).length >= 6, 'paleta de cores própria das anotações');
ok(/alpha: 100/.test(mod), 'a opacidade é um campo do modelo');
ok(/pts: a.kind === 'pen' \? a.pts.slice\(\) : \[\]/.test(mod), 'só o traço guarda pontos');

/* ---------- 3. nota: texto, fonte, cor e opacidade ---------- */
ok(/txt\.contentEditable = 'false'/.test(mod), 'o texto só entra em edição no duplo clique');
ok(/txt\.addEventListener\('dblclick'/.test(mod) && /function annEditaTexto/.test(mod), 'duplo clique edita o texto');
ok(/a\.text = txt\.textContent/.test(mod), 'o que foi digitado volta para o modelo');
ok(/txt\.style\.fontSize = a\.fs \+ 'px'/.test(mod), 'o tamanho da fonte vem da anotação');
ok(/if \(patch\.fs != null && a\.kind === 'note'\) a\.fs = patch\.fs/.test(mod), 'o slider de fonte vale para as notas');
ok(/if \(patch\.alpha != null\) a\.alpha = patch\.alpha/.test(mod), 'o slider de opacidade vale para todas');
ok(/el\.style\.opacity = String\(Math\.max\(0\.1, a\.alpha \/ 100\)\)/.test(mod), 'a opacidade nunca some por completo');

/* ---------- 4. moldura: título, cor e recolher ---------- */
ok(/title: kind === 'frame' \? 'Frame' : ''/.test(mod), 'a moldura tem título');
ok(/function annEditaTitulo/.test(mod) && /ttl\.addEventListener\('dblclick'/.test(mod), 'duplo clique renomeia a moldura');
ok(/a\.collapsed = !a\.collapsed/.test(mod), 'a moldura recolhe e volta');
ok(/classList\.add\('collapsed'\)/.test(mod) && /\.ann\.collapsed \.ann-body\{display:none\}/.test(html), 'recolhida, esconde o corpo');
ok(/cap\.style\.background = a\.color/.test(mod), 'a barra de título usa a cor da moldura');

/* ---------- 5. caneta livre (marcador) ---------- */
ok(/function annPenBaixo/.test(mod) && /viewEl\.addEventListener\('pointerdown', annPenBaixo, \{ capture: true \}\)/.test(mod), 'a caneta escuta antes do pan/seleção');
ok(/e\.stopPropagation\(\);\n  const w = screenToWorld/.test(mod), 'desenhar não dispara a seleção do canvas');
ok(/a\.pts\.push\(Math\.round\(q\.x\), Math\.round\(q\.y\)\)/.test(mod), 'os pontos do traço são gravados');
ok(/if \(Math\.abs\(q\.x - last\.x\) \+ Math\.abs\(q\.y - last\.y\) < 1\.5\) return;/.test(mod), 'pontos colados não incham o traço');
ok(/classList\.toggle\('ann-draw', annPenOn\)/.test(mod), 'o cursor muda no modo caneta');
ok(/annPenOn \? 'Pen on: drag on the graph to draw\. Esc to stop\.' : 'Pen off\.'/.test(mod), 'o status avisa quando a caneta está ligada');

/* ---------- 6. mover, redimensionar, selecionar, duplicar, apagar ---------- */
ok(/if \(!annSel\.has\(a\.id\)\) \{/.test(mod) && /e\.shiftKey/.test(mod), 'clique seleciona, Shift soma à seleção');
ok(/const ini = new Map\(ids\.map/.test(mod), 'arrastar leva todas as anotações selecionadas');
ok(/const dx = Math\.round\(\(ev\.clientX - x0\) \/ view\.zoom\)/.test(mod), 'o arrasto respeita o zoom do grafo');
ok(/dataset\.d = d/.test(mod) && /function annRedimensiona\(e, a, d\)/.test(mod), 'quatro alças redimensionam pela direção');
ok(/a\.w = Math\.max\(90, Math\.round\(w\)\)/.test(mod), 'redimensionar tem tamanho mínimo');
ok(/function annDuplicaSel/.test(mod) && /c\.x \+= 24; c\.y \+= 24;/.test(mod), 'duplicar desloca a cópia');
ok(/function annApagaSel/.test(mod) && /annots = annots\.filter\(a => !annSel\.has\(a\.id\)\)/.test(mod), 'apagar remove de verdade (nada de fantasma)');
ok(/e\.key === 'Delete' \|\| e\.key === 'Backspace'/.test(mod), 'Del apaga a anotação selecionada');
ok(/const passo = e\.shiftKey \? 10 : 1;/.test(mod), 'setas empurram a anotação (Shift = 10)');
ok(/alvo\.isContentEditable/.test(mod), 'digitar num texto não apaga a nota');

/* ---------- 7. camadas certas: moldura atrás dos nós, caneta na frente ---------- */
ok(/function annLayer\(\)/.test(mod) && /worldEl\.prepend\(l\)/.test(mod), 'notas e molduras entram atrás dos nós');
ok(/function annPenLayer\(\)/.test(mod) && /worldEl\.append\(l\)/.test(mod), 'a caneta fica por cima (destaque)');
ok(/#annLayer\{position:absolute[^}]*pointer-events:none\}/.test(html), 'a camada das notas não rouba o clique do canvas');
ok(/#annPen\{position:absolute[^}]*pointer-events:none\}/.test(html), 'a camada da caneta também não');

/* ---------- 8. persistência, save e undo ---------- */
ok(/annots: annSerialize\(\),/.test(html), 'as anotações entram no estado salvo');
ok(/annLoad\(data\.annots\);/.test(html), 'restore/save carrega as anotações de volta');
ok(/function annSerialize\(\)/.test(mod) && /function annLoad\(list\)/.test(mod), 'serializar e carregar são funções próprias');
ok(/annLoad\(d\.annots\)|annLoad\(data\.annots\)/.test(html), 'o carregamento é o mesmo para arquivo, projeto e sessão');
ok(/alpha: Math\.min\(100, Math\.max\(10, \+d\.alpha \|\| 100\)\)/.test(mod), 'importar saneia a opacidade');
ok(/color: \/\^#\[0-9a-fA-F\]\{6\}\$\/\.test\(String\(d\.color \|\| ''\)\) \? d\.color : ANN_CORES\[0\]/.test(mod), 'cor inválida cai na paleta');
ok(/annSeq = Math\.max\(annSeq, parseInt\(d\.id\.slice\(2\), 10\) \+ 1\)/.test(mod), 'os ids continuam únicos depois de recarregar');
{
  const mutacoes = ['annAdd', 'annEstilo', 'annApagaSel', 'annDuplicaSel', 'annPega', 'annRedimensiona', 'annEditaTexto'];
  for (const f of mutacoes) {
    const bloco = extrai('function ' + f + '(', '\nfunction ');
    ok(/commit\(\)/.test(bloco), `${f} entra no undo/autosave (commit)`);
  }
}

/* ---------- 9. não quebra o resto do editor ---------- */
ok(!/groupSelected\(\)\s*\{\s*\}/.test(mod), 'Frame selection usa o agrupamento de nós que já existia');
ok(/if \(e\.target\.closest\('\.ann, \[data-ann\]'\)\) return;/.test(mod), 'clicar numa anotação não limpa a seleção dela');
ok(/\.ann-bar\[hidden\]\{display:none\}/.test(html), 'o painel fechado não ocupa a tela');

process.exit(resumo() ? 0 : 1);
