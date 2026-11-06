/* Layer Position (3.9.0): renomear no lugar com o nome preso ao ID da camada.
   O nome tem de seguir a camada quando ela é reordenada, e sobreviver a
   undo/redo, autosave, sessão e export — nada de índice. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const trecho = (ini, fim) => {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

const linha = trecho('function layerRowEl(n, i, render, dnd) {', 'function layerBodyEl(n, i, render) {');
const lista = trecho('function layerRotulo(n, i) {', 'function nodeInputs(n) {');

/* ---------- 1. nome preso ao id, não à posição ---------- */
{
  ok(/id: genLayerId\(\)/.test(html), 'cada camada nasce com id único');
  ok(/name: '',/.test(trecho('function defaultLayer(patch) {', 'function layerList(n)')), 'a camada começa sem nome custom');
  ok(/if \(!L\.id\) L\.id = genLayerId\(\);/.test(html), 'camada antiga ganha id na migração');
  ok(/row\.dataset\.layerId = P\.id/.test(linha), 'a linha carrega o id da camada');
  ok(/const list = layerList\(n\);/.test(linha) && /const P = list\[i\];/.test(linha), 'a linha busca a camada pela lista');
}

/* ---------- 2. reordenar move o objeto (o nome vai junto) ---------- */
{
  const move = trecho('function moveLayer(n, fromIdx, toIdx, render) {', 'function toggleClippingMask(n, idx, render)');
  ok(/n\.params\.layers = order\.map\(oldIdx => list\[oldIdx\]\);/.test(move), 'reordenar reordena os OBJETOS das camadas (o nome acompanha)');
  ok(/syncClippingHierarchy\(n\.params\.layers\);/.test(move), 'o vínculo de clipping é refeito depois da reordenação');
  ok(/if \(l\.to === n\.id && newOfOld\.has\(l\.input\)\) l\.input = newOfOld\.get\(l\.input\);/.test(move), 'os fios seguem a camada reordenada');
}

/* ---------- 3. rótulo: nome custom em vez de índice ---------- */
{
  ok(/function layerRotulo\(n, i\)/.test(lista), 'existe um helper único de rótulo');
  ok(/const nome = l && l\.name \? String\(l\.name\)\.trim\(\) : '';/.test(lista), 'o rótulo vem do nome gravado na camada');
  ok(/return nome \? \(\(i \+ 1\) \+ ' · ' \+ nome\) : \('Layer ' \+ \(i \+ 1\)\);/.test(lista), 'com nome: "1 · Fundo"; sem nome: "Layer 1"');
  ok(/rl\.textContent = layerRotulo\(n, i\);/.test(html), 'o socket de entrada mostra o nome custom');
  ok(/out\[i\] = layerRotulo\(n, i\);/.test(html), 'as entradas do nó também mostram o nome custom');
}

/* ---------- 4. renomear: duplo clique e botão ✎ ---------- */
{
  ok(/const renomeia = \(\) => editaNomeEm\(name, P\.name \|\| ''/.test(linha), 'um caminho só para renomear');
  ok(/name\.addEventListener\('dblclick'/.test(linha), 'duplo clique abre o campo');
  ok(/const editBtn = E\('button', 'lyr-edit', '✎'\)/.test(linha), 'há um botão ✎ na linha');
  ok(/editBtn\.addEventListener\('click', e => \{ e\.stopPropagation\(\); renomeia\(\); \}\)/.test(linha), 'o ✎ abre o mesmo campo (funciona no toque)');
  ok(/editBtn\.title = 'Rename this layer'/.test(linha), 'o botão tem tooltip');
  ok(/P\.name = String\(v\)\.slice\(0, 40\)\.trim\(\);/.test(linha), 'o nome é normalizado e limitado a 40 caracteres');
  ok(/render\(\); commit\(\);/.test(linha), 'renomear atualiza a lista e entra no histórico (undo)');
  ok(/const baseTitle = P\.name \|\| \(sn \?/.test(linha), 'nome vazio volta para o título padrão');
  ok(/name\.tabIndex = 0;/.test(linha), 'o nome da camada recebe foco pelo teclado');
  ok(/name\.setAttribute\('role', 'button'\)/.test(linha), 'e se anuncia como botão para leitores de tela');
  ok(/F2 renames, arrows reorder/.test(linha), 'o aria-label explica F2 e as setas');
  ok(/if \(e\.key === 'F2' \|\| e\.key === 'Enter'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); renomeia\(\); return; \}/.test(linha),
    'F2/Enter abre o campo de renomear');
  ok(/e\.key === 'ArrowUp' && i < total - 1[\s\S]{0,140}moveLayer\(n, i, i \+ 1, render\); focaNomeCamada\(n, i \+ 1\);/.test(linha),
    'seta para cima reordena e devolve o foco à mesma camada');
  ok(/e\.key === 'ArrowDown' && i > 0[\s\S]{0,140}moveLayer\(n, i, i - 1, render\); focaNomeCamada\(n, i - 1\);/.test(linha),
    'seta para baixo faz o mesmo descendo');
  ok(/function focaNomeCamada\(n, i\)/.test(html), 'existe o helper que devolve o foco após reordenar');
  ok(/\.lyr-name:focus-visible\{outline:1px solid var\(--accent\)/.test(html), 'o foco no nome fica visível');
  ok(/\.lyr-edit\{/.test(html), 'o botão ✎ tem estilo próprio');
  ok(/body\.mobile \.lyr-edit\{width:28px;height:26px/.test(html), 'no APK o ✎ tem alvo de toque maior');
}

/* ---------- 5. persistência: params, undo e autosave ---------- */
{
  ok(/function serialize\(\)[\s\S]{0,400}params: n\.params/.test(html), 'serializar guarda os params (com o nome da camada)');
  ok(/undoStack\.push\(lastState\)/.test(html), 'commit empilha o estado para undo');
  ok(/localStorage\.setItem\('node-image-editor:autosave', s\)/.test(html), 'commit também grava o autosave');
  ok(/function commit\(\)[\s\S]{0,120}const s = serialize\(\)/.test(html), 'commit fotografa o grafo inteiro');
  const camada = trecho('function defaultLayer(patch) {', 'function layerList(n)');
  ok(/Object\.assign\(\{/.test(camada) && /id: genLayerId\(\)/.test(camada), 'a camada é um objeto serializável (id + name + params)');
}

process.exit(resumo() ? 0 : 1);
