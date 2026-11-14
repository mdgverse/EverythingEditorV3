/* Home · pasta aberta em spread-and-roll (1.5.0), inspirada no template
   "Spread Rows" (pilha que se espalha em fileiras à deriva): regras puras
   das fileiras/deslocamento/toque + fiação com a Home existente (mesmos
   cartões, mesmo ssOpenProject, dados intocados). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extrai = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim, a);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};
const funcao = nome => {
  const a = html.indexOf('function ' + nome + '(');
  if (a < 0) throw new Error('função não encontrada: ' + nome);
  let i = html.indexOf('{', a), prof = 0, j = i;
  for (; j < html.length; j++) {
    if (html[j] === '{') prof++;
    else if (html[j] === '}') { prof--; if (!prof) { j++; break; } }
  }
  return html.slice(a, j);
};

console.log('Home spread-and-roll · regras puras');

const puro = extrai('/* SPREAD_PURO_INI */', '/* SPREAD_PURO_FIM */');
const P = new Function(puro + '\nreturn { spreadLinhas, spreadDistribui, spreadWrap, spreadEhToque };')();

ok(P.spreadLinhas(1) === 1 && P.spreadLinhas(6) === 1 && P.spreadLinhas(7) === 2 && P.spreadLinhas(14) === 2 && P.spreadLinhas(15) === 3,
  'fileiras: 1 até 6 projetos, 2 até 14, 3 acima disso');
const itens = Array.from({ length: 20 }, (_, i) => i);
const grupos = P.spreadDistribui(itens, P.spreadLinhas(itens.length));
ok(grupos.flat().length === 20 && new Set(grupos.flat()).size === 20 && grupos.flat().join(',') === itens.join(','),
  'a distribuição põe cada projeto uma única vez, na ordem');
ok(P.spreadDistribui([], 2).length === 0 && P.spreadDistribui([1, 2], 3).flat().join(',') === '1,2',
  'pasta pequena/vazia não cria fileira fantasma');
ok(P.spreadWrap(-1050, 500) === -50 && P.spreadWrap(30, 500) === -470 && P.spreadWrap(-500, 500) === 0 && P.spreadWrap(10, 0) === 0,
  'o deslocamento embrulha em (-metade, 0] — loop contínuo sem salto');
ok(P.spreadEhToque(3, 4, 120) && P.spreadEhToque(0, 0, 599), 'toque curto e parado = toque (abre)');
ok(!P.spreadEhToque(11, 0, 100) && !P.spreadEhToque(40, 30, 200) && !P.spreadEhToque(2, 2, 900),
  'arrasto (ou toque longo) não é toque — não abre projeto sem querer');

console.log('Home spread-and-roll · fiação');

const montar = funcao('ssMontarSpread');
ok(/spreadDistribui\(cards, spreadLinhas\(cards\.length\)\)/.test(montar), 'montar usa as fileiras puras');
const preparar = funcao('ssSpreadPreparar');
ok(/cloneNode\(true\)/.test(preparar) && /classList\.add\('clone'\)/.test(preparar) && /aria-hidden/.test(preparar) && /tabIndex = -1/.test(preparar),
  'clones só para o loop contínuo, fora da leitura de tela e da tabulação');
ok(/dir: i % 2 \? 1 : -1/.test(montar), 'fileiras vizinhas derivam em sentidos opostos');
ok(/cubic-bezier\(\.22,1\.25,\.36,1\)/.test(montar) && /ssSpreadUltimaPasta !== ssOpenFolderId/.test(montar),
  'abertura: os cartões saem da pilha central para as fileiras (uma vez por pasta)');
ok(/e\.key === 'Escape'/.test(montar) && /ssFecharPasta\(\)/.test(montar), 'Esc fecha a vista da pasta');

const tick = funcao('ssSpreadTick');
ok(/st\.hover \|\| st\.foco \|\| !!st\.drag/.test(tick), 'a deriva para com hover, foco de teclado ou arrasto');
ok(/!st\.vp\.isConnected \|\| !ssOpenFolderId/.test(tick) && /ssScr\.hidden/.test(tick), 'a animação para quando a vista fecha ou a Home some');
ok(/requestAnimationFrame\(ssSpreadTick\)/.test(tick), 'deriva por rAF (suave e pausável)');

ok(/pointerenter/.test(montar) && /pointerType === 'mouse'\) st\.hover = true/.test(montar),
  'desktop: hover pausa a deriva na hora; sair retoma do mesmo ponto');
ok(/setPointerCapture/.test(montar) && /spreadWrap\(d\.offs\[i\] \+ dx, r\.half\)/.test(montar),
  'touch/mouse: arrastar assume o controle das fileiras');
ok(/st\.suprimir = true/.test(montar) && /addEventListener\('click'.*\bst\.suprimir\b/s.test(montar),
  'depois do arrasto, o clique é suprimido — projeto não abre sem querer');

const render = extrai('async function ssRenderRecent() {', 'function ssStartRename(');
ok(/ssPararSpread\(\);\n  box\.classList\.remove\('com-spread'\)/.test(render), 're-render para a deriva anterior (sem vazamento)');
ok(/ssOpenFolderId && cardsSpread\.length && !window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) ssMontarSpread\(box, cardsSpread\)/.test(render),
  'spread só com pasta aberta, com projetos e sem reduced-motion (senão, a grade de sempre)');
ok(/cardsSpread\.push\(card\)/.test(render) && /ssOpenProject\(m\.id\)/.test(render),
  'são os mesmos cartões de sempre — clicar abre o projeto pelo fluxo normal (ssOpenProject)');
ok(/'No projects in this folder\.'/.test(render), 'pasta vazia mantém a mensagem de estado vazio');

const pastas = extrai('function ssRenderFolders(', 'async function ssCreateFolderFromSelected(');
ok(/back\.addEventListener\('click', \(\) => ssFecharPasta\(\)\)/.test(pastas), 'o botão ← Folders fecha pela função comum');
ok(/card\.tabIndex = 0/.test(pastas) && /e\.key === 'Enter' \|\| e\.key === ' '/.test(pastas),
  'cartão da pasta é focável e abre com Enter/Espaço');
ok(/data-fid/.test(funcao('ssFecharPasta')) && /card\.dataset\.fid = f\.id/.test(pastas),
  'ao fechar, o foco volta para o cartão da pasta');

ok(/\.ss-spread\{[^}]*touch-action:pan-y/.test(html), 'na vertical a página rola; na horizontal o arrasto é da apresentação');
ok(/\.ss-rc:focus-visible,\.ss-folder:focus-visible\{outline:2px solid var\(--brand\)/.test(html), 'foco visível nos cartões e nas pastas');

process.exit(resumo() ? 0 : 1);
