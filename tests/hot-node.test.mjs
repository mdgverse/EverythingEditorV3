/* Hot Node (3.9.0): menu rápido que nasce no cursor, com busca fuzzy,
   favoritos, recentes e auto-ligação — inspirado no add-on Hot Node do
   Blender, mas com atalho próprio (Shift+B) para não disputar com o Shift+A. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const trecho = (ini, fim) => {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};
const mod = trecho('/* ===== HOT NODE (3.9.0) =====', '/* ==== HOT NODE (END) ==== */');

/* ---------- 1. atalho próprio e configurável ---------- */
{
  ok(/const HOT_TECLAS = \['shift\+b', 'ctrl\+space', 'alt\+a', 'tab'\];/.test(mod), 'as quatro opções de atalho existem');
  ok(/const HOT_PADRAO = 'shift\+b';/.test(mod), 'o padrão é Shift+B');
  ok(!/HOT_PADRAO = 'shift\+a'/.test(mod), 'Shift+A nunca é o padrão (já é o menu de categorias)');
  ok(/if \(k === 'shift\+b'\)/.test(mod) || /e\.shiftKey && !e\.ctrlKey && !e\.altKey && !e\.metaKey && e\.key\.toLowerCase\(\) === 'b'/.test(mod), 'Shift+B é reconhecido sem modificadores extras');
  ok(/if \(k === 'ctrl\+space'\)/.test(mod) && /e\.code === 'Space'/.test(mod), 'Ctrl+Space é reconhecido (não depende do layout)');
  ok(/if \(k === 'alt\+a'\)/.test(mod), 'Alt+A é reconhecido');
  ok(/if \(k === 'tab'\)/.test(mod), 'Tab pode ser escolhido nas preferências');
  ok(/hotPref\('key', HOT_PADRAO\)/.test(mod) && /node-image-editor:hotnode:/.test(mod), 'a escolha fica salva no localStorage');
  ok(/HOT_TECLAS\[\(HOT_TECLAS\.indexOf\(hotTecla\(\)\) \+ 1\) % HOT_TECLAS\.length\]/.test(mod), 'o botão do atalho percorre as opções');
  ok(/hotGuarda\('key', prox\)/.test(mod), 'trocar o atalho persiste');
  ok(/if \(e\.repeat\) return false;/.test(mod), 'segurar a tecla não abre em loop');
}

/* ---------- 2. abre no cursor ---------- */
{
  ok(/function hotAbrir\(x, y\)/.test(mod), 'o menu abre numa coordenada');
  ok(/hotPos = \{ x, y \}/.test(mod), 'a posição vem do cursor');
  ok(/const r = viewEl\.getBoundingClientRect\(\);[\s\S]{0,220}clamp\(hotPos\.x - r\.left, 8,/.test(mod), 'posiciona relativo ao grafo e mantém dentro da tela');
  ok(/viewEl\.addEventListener\('pointermove', e => \{[\s\S]{0,120}hotCursor = \{ x: e\.clientX, y: e\.clientY \};/.test(mod), 'guarda o cursor para abrir no lugar certo');
  ok(/\{ passive: true \}\);/.test(mod), 'o rastreio do cursor não intercepta o gesto');
  ok(/if \(!document\.body\.classList\.contains\('mobile'\)\) \{ try \{ hotIn\.focus/.test(mod), 'no desktop o campo de busca já vem focado');
}

/* ---------- 3. busca fuzzy ---------- */
{
  ok(/normalize\('NFD'\)\.replace\(\/\[\\u0300-\\u036f\]\/g, ''\)\.toLowerCase\(\)/.test(mod), 'a busca ignora acentos e caixa');
  ok(/if \(titulo\.indexOf\(q\) === 0\) return 1000 - titulo\.length;/.test(mod), 'quem começa com o termo vem primeiro');
  ok(/if \(i === q\.length\) return 600 - saltos \* 4 - primeiro \* 6 - titulo\.length;/.test(mod), 'sequência de letras (fuzzy) também casa');
  ok(/const alvo = hotNorm\(titulo \+ ' ' \+ \(def\.kw \|\| ''\)/.test(mod), 'busca também no kw/tipo/categoria');
  ok(/if \(addIndisponivel\(tipo\)\) continue;/.test(mod), 'nós impossíveis no contexto ficam fora');
  ok(/lista\.sort\(\(a, b\) => b\.ponto - a\.ponto \|\| a\.def\.title\.localeCompare\(b\.def\.title\)\)/.test(mod), 'resultado é ordenado por relevância');
  ok(/const partes = hotNorm\(consulta\)\.split\(\/\\s\+\/\)\.filter\(Boolean\);/.test(mod), 'busca por várias palavras exige todas');
  ok(/for \(const tipo in NODE_TYPES\)/.test(mod), 'a busca cobre todos os nós do editor');
}

/* ---------- 4. favoritos e recentes ---------- */
{
  ok(/hotPref\('fav', \[\]\)/.test(mod) && /hotGuarda\('fav', l\.slice\(0, 12\)\)/.test(mod), 'favoritos persistem (até 12)');
  ok(/hotPref\('rec', \[\]\)/.test(mod) && /hotGuarda\('rec', l\.slice\(0, 6\)\)/.test(mod), 'recentes persistem (6)');
  ok(/hotMarcaFavorito\(it\.tipo\); hotRender\(\);/.test(mod), 'a estrela fixa/desafixa sem inserir');
  ok(/hotFavoritos\(\)\.indexOf\(it\.tipo\) >= 0 \? '★' : '☆'/.test(mod), 'a estrela mostra o estado');
  ok(/linha\.append\(E\('span', 'hot-lab', '★'\)\)/.test(mod), 'favoritos viram chips de um clique');
  ok(/linha\.append\(E\('span', 'hot-lab', 'Recent'\)\)/.test(mod), 'recentes viram chips de um clique');
  ok(/hotMarcaRecente\(tipo\)/.test(mod), 'inserir alimenta a lista de recentes');
}

/* ---------- 5. auto-ligação ---------- */
{
  ok(/const n = addNodeAt\(tipo, w\.x - 100, w\.y - 14\);/.test(mod), 'cria o nó no ponto do cursor');
  ok(/consome o pendingLink/.test(mod), 'o fio arrastado é consumido pelo addNodeAt (liga sozinho)');
  ok(/document\.elementFromPoint\(x, y\)/.test(mod) && /el\.closest\('\.linkhit'\)/.test(mod), 'descobre o fio sob o cursor');
  ok(/const l = hit && hit\._link;/.test(mod), 'usa o link real do fio');
  ok(/insertTo: l\.to, insertIdx: l\.input/.test(mod), 'o nó entra no meio do fio');
  ok(/links\.splice\(links\.indexOf\(l\), 1\);/.test(mod), 'o fio antigo sai antes de inserir');
  ok(/restore: \{ from: l\.from, to: l\.to, input: l\.input, out: l\.out \|\| 0 \}/.test(mod), 'cancelar devolve o fio original');
  ok(/connect\(pl\.restore\.from, pl\.restore\.to, pl\.restore\.input, pl\.restore\.out \|\| 0\);/.test(mod), 'a devolução religa exatamente como estava');
  ok(/const soUm = \(!pl && selected\.size === 1\) \? \[\.\.\.selected\]\[0\] : null;/.test(mod), 'usa o nó selecionado quando existe um só');
  ok(/connect\(soUm, n\.id, livre, 0\);/.test(mod), 'liga a saída do selecionado na primeira entrada livre');
  ok(/b === def\.preferIn\) - \(a === def\.preferIn\)/.test(mod), 'respeita a entrada preferida do tipo (como no arraste)');
}

/* ---------- 6. teclado dentro do menu ---------- */
{
  ok(/e\.key === 'ArrowDown'[\s\S]{0,80}hotDestaca\(hotSel \+ 1\)/.test(mod), 'seta para baixo anda na lista');
  ok(/e\.key === 'ArrowUp'[\s\S]{0,80}hotDestaca\(hotSel - 1\)/.test(mod), 'seta para cima volta');
  ok(/e\.key === 'Enter'\) \{ e\.preventDefault\(\); const it = hotItens\[hotSel\]; if \(it\) hotInserir\(it\.tipo\);/.test(mod), 'Enter insere o nó destacado');
  ok(/e\.key === 'Escape'\) \{ e\.preventDefault\(\); hotFechar\(true\)/.test(mod), 'Esc fecha devolvendo o fio');
  ok(/alvo\.closest\('input,textarea,select,\[contenteditable="true"\]'\)\) return;/.test(mod), 'digitando num campo, o atalho não dispara');
  ok(/if \(document\.body\.classList\.contains\('mobile'\)\) return;\s+\/\/ APK/.test(mod), 'no APK o atalho não é usado (não há teclado)');
  ok(/hotEl\.addEventListener\('pointerdown', e => e\.stopPropagation\(\)\);/.test(mod), 'clicar no menu não mexe no grafo');
}

/* ---------- 7. APK: toque longo abre o mesmo menu ---------- */
{
  ok(/hotAbrir\(tap\.x, tap\.y\);/.test(html), 'toque longo no canvas abre o Hot Node');
  ok(/function longPress\(id\)[\s\S]{0,600}hotAbrir\(tap\.x, tap\.y\)/.test(html), 'o gesto continua saindo do longPress');
  ok(/body\.mobile \.hot-menu\{position:fixed!important;left:8px!important;right:8px!important/.test(html), 'no APK o menu vira folha inferior');
  ok(/body\.mobile \.hot-item\{padding:11px 9px;font-size:14px;min-height:44px\}/.test(html), 'alvo de toque de 44px');
  ok(/body\.mobile \.hot-in\{height:42px/.test(html), 'campo de busca grande no toque');
  ok(/body\.mobile \.hot-star\{width:34px;height:34px/.test(html), 'estrela com alvo maior no toque');
}

/* ---------- 8. o Shift+A continua intocado ---------- */
{
  ok(/if \(e\.shiftKey && k === 'a'\) \{ e\.preventDefault\(\); openAddMenu\(/.test(html), 'Shift+A continua abrindo o menu de categorias');
  ok(/function openAddMenu\(clientX, clientY, pending = null\)/.test(html), 'o menu antigo segue com a mesma assinatura');
  ok(/function addNodeAt\(type, x, y\)/.test(html), 'addNodeAt é compartilhado entre os dois menus');
  ok(/Shift\+B: hot node/.test(html), 'a dica da barra mostra o atalho novo');
}

process.exit(resumo() ? 0 : 1);
