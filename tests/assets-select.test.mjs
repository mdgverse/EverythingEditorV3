/* Assets: seleção múltipla (Ctrl/Shift/toque), mover para pasta e recorte em lote. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

console.log('assets · seleção, pasta e recorte');

/* ---------- geometria do recorte (roda de verdade) ---------- */
const geo = new Function(
  extrai('const AR_MIN = 0.04;', 'async function astBitmapDe(') +
  '\nreturn { AR_MIN, arLimitaRetangulo, arMoveRetangulo, arRedimensiona };'
)();
const { AR_MIN, arLimitaRetangulo, arMoveRetangulo, arRedimensiona } = geo;

const perto = (a, b) => Math.abs(a - b) < 1e-6;

ok(AR_MIN > 0 && AR_MIN < 0.2, 'existe um tamanho mínimo de recorte', AR_MIN);
{
  const r = arLimitaRetangulo({ x: -0.5, y: 2, w: 3, h: 0.0001 });
  ok(r.x === 0 && r.y >= 0 && r.y <= 1 && r.w === 1 && r.h === AR_MIN, 'retângulo preso dentro da imagem', r);
  const dentro = arLimitaRetangulo({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  ok(dentro.x === 0.25 && dentro.w === 0.5, 'retângulo válido não é mexido', dentro);
}
{
  const base = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
  const esq = arMoveRetangulo(base, -0.9, 0);
  ok(esq.x === 0 && esq.w === 0.5, 'mover para a esquerda para na borda e mantém o tamanho', esq);
  const dir = arMoveRetangulo(base, 0.9, 0.9);
  ok(perto(dir.x, 0.5) && perto(dir.y, 0.5), 'mover para a direita/baixo para na borda', dir);
  ok(base.x === 0.2, 'a base não é alterada', base);
}
{
  const base = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
  const se = arRedimensiona(base, 'se', 0.1, 0.1);
  ok(perto(se.w, 0.6) && perto(se.h, 0.6), 'alça sudeste cresce', se);
  const nw = arRedimensiona(base, 'nw', -0.1, -0.1);
  ok(perto(nw.x, 0.1) && perto(nw.w, 0.6), 'alça noroeste anda mantendo o canto oposto', nw);
  const grande = arRedimensiona(base, 'se', 5, 5);
  ok(grande.x + grande.w <= 1.0001 && grande.y + grande.h <= 1.0001, 'não passa da imagem', grande);
  const minimo = arRedimensiona(base, 'e', -5, 0);
  ok(perto(minimo.w, AR_MIN), 'não encolhe abaixo do mínimo', minimo);
  const ne = arRedimensiona(base, 'ne', 0.1, -0.1);
  ok(perto(ne.y, 0.1) && perto(ne.h, 0.6) && perto(ne.w, 0.6), 'alça nordeste mexe topo e direita', ne);
}

/* ---------- o botão que se chamava Crop agora é Cut ---------- */
ok(!/E\('button', 'ast-btn', 'Crop'\); bCut\.type = 'button'; bCut\.dataset\.act = 'cut'/.test(html), 'nenhum botão "Crop" que na verdade corta');
ok(/const bCut = E\('button', 'ast-btn', 'Cut'\); bCut\.type = 'button'; bCut\.dataset\.act = 'cut'/.test(html), 'card do asset: botão Cut', 'card');
ok(/const bCut = E\('button', 'ast-btn', 'Cut'\); bCut\.type = 'button'; bCut\.id = 'astBtnCut'/.test(html), 'barra: botão Cut', 'barra');

/* ---------- barra: Crop e Move to… ---------- */
{
  const barra = extrai("const bCrop = E('button', 'ast-btn', 'Crop')", "wrap.append(selbar)");
  ok(/id = 'astBtnCrop'/.test(barra) && /astRecorteDialogo\(\)/.test(barra), 'Crop abre o recorte', barra.length);
  ok(/id = 'astBtnMove'/.test(barra) && /astMoverPara\(\)/.test(barra), 'Move to… abre a escolha de pasta');
  ok(/selbar\.append\(info, clipInfo, bAdd, bCrop, bCut, bPaste, bMove, bRen, bDelS, bLimpa\)/.test(barra), 'os dois entraram na barra');
  ok(/set\('astBtnCrop', !astSel\.size\)/.test(html) && /set\('astBtnMove', !astSel\.size\)/.test(html), 'ficam desligados sem seleção');
}

/* ---------- seleção múltipla ---------- */
{
  const grade = extrai("grade.addEventListener('pointerdown'", "grade.addEventListener('dblclick'");
  ok(/astUltimoToque = e\.pointerType && e\.pointerType !== 'mouse'/.test(grade), 'guarda se o último toque foi dedo', 'touch');
  ok(/e\.ctrlKey \|\| e\.metaKey \|\| \(toque && astSel\.size\)/.test(grade), 'Ctrl/Cmd no PC e toque no celular somam à seleção');
  ok(/e\.shiftKey && astUltimoSel/.test(grade), 'Shift faz faixa');
  ok(/for \(let i = Math\.min\(i0, i1\); i <= Math\.max\(i0, i1\); i\+\+\) astSel\.add\(ordem\[i\]\)/.test(grade), 'a faixa pega todos os cards do intervalo');
  ok(/astUltimoSel = a\.id/.test(grade), 'lembra o último clicado para a próxima faixa');
  ok(/if \(!\(e\.ctrlKey \|\| e\.metaKey\)\) astSel\.clear\(\)/.test(grade), 'Shift sem Ctrl substitui a seleção');
  ok(/let astSel = new Set\(\), astClipIds = null, astUltimoSel = null, astUltimoToque = false;/.test(html), 'estado da seleção guardado');
}

/* ---------- mover para pasta ---------- */
{
  const mover = extrai('async function astMoverPara()', '/* ---------- recorte em lote');
  ok(/const ids = \[\.\.\.astSel\]/.test(mover), 'pega todos os selecionados');
  ok(/SS_DB\.setAssetFolder\(ids, destinos\[escolha\]\.id\)/.test(mover), 'move todos de uma vez', 'batch');
  ok(/No folder/.test(mover) && /astFolders\.map/.test(mover), 'lista as pastas e “No folder”');
  ok(/astClipIds = null/.test(mover), 'cancelar o cut pendente depois de mover');
  ok(/await astRefresh\(\)/.test(mover), 'a grade se atualiza');
}

/* ---------- recorte em lote ---------- */
{
  const dlg = extrai('function astRecorteDialogo()', 'function astRenomearAsset');
  ok(/a\.kind === 'image'/.test(dlg), 'só imagem entra no recorte', 'filtro');
  ok(/const pulados = todos\.length - ids\.length/.test(dlg), 'conta quantos ficaram de fora');
  ok(/astRecorteAplicar\(ids, rc, pulados\)/.test(dlg), 'aplica a MESMA área em todos', 'batch');
  ok(/arMoveRetangulo\(arrasto\.base, dx, dy\)/.test(dlg) && /arRedimensiona\(arrasto\.base, arrasto\.modo, dx, dy\)/.test(dlg), 'caixa arrasta e redimensiona');
  ok(/\[\.\.\.astSel\]/.test(dlg), 'usa a seleção inteira');
  ok(/Crop image|Crop ' \+ ids\.length \+ ' images/.test(dlg), 'o botão diz quantas imagens vão ser cortadas');

  const apl = extrai('async function astRecorteAplicar(', '/* janela do recorte');
  ok(/for \(const id of ids\)/.test(apl), 'passa por todos os selecionados');
  ok(/rc\.x \* W/.test(apl) && /rc\.w \* W/.test(apl), 'área proporcional ao tamanho de cada imagem', 'proporcional');
  ok(/drawImage\(bmp, sx, sy, sw, sh, 0, 0, sw, sh\)/.test(apl), 'corta com canvas');
  ok(/SS_DB\.putAsset\(\{ \.\.\.a, blob: novo/.test(apl), 'grava o asset cortado', 'put');
  ok(/thumb: t\.thumb, w: t\.w, h: t\.h/.test(apl), 'miniatura e medidas novas');
  ok(/astEsqueceURL\(id\)/.test(apl), 'descarta a URL antiga em cache');
  ok(/falhou \? ' · ' \+ falhou \+ ' failed'/.test(apl) && /skipped \(SVG\/vector\)/.test(apl), 'a barra diz o que foi cortado, falhou e foi pulado');
  ok(/await astRefresh\(\)/.test(apl), 'a grade mostra o resultado');
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
