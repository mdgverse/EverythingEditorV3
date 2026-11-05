/* Array Machine (nó "Machine"): glifos por tom, SVG enviado pelo usuário e
   SVG escolhido na biblioteca. O botão Assets gravava glyphAssetN e o render
   só lia glyphFileN — escolher um SVG caía sempre na reserva (3.8.4). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const trecho = (ini, fim) => {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

/* ---------- 1. o nó existe com os quatro tons ---------- */
{
  ok(/arrayMachine: \{\s*title: 'Machine'/.test(html), 'o nó Machine (array) existe');
  for (const t of [0, 1, 2, 3]) {
    ok(html.includes("ENUM('glyph" + t + "'"), 'o tom ' + (t + 1) + ' tem seletor de glifo');
    ok(html.includes("FILE('glyphFile" + t + "'"), 'o tom ' + (t + 1) + ' aceita arquivo/SVG');
    ok(html.includes("key: 'glyphAsset" + t + "'"), 'o tom ' + (t + 1) + ' guarda o asset da biblioteca');
  }
  ok(/\['custom', 'Uploaded \(image\/SVG\)'\]/.test(html), 'a lista de glifos tem a opção do SVG do usuário');
  ok(/const GLYPH_ID_AM = \{[^}]*custom: 16/.test(html), 'o shader reserva o id 16 para o glifo do usuário');
}

/* ---------- 2. o render lê o asset (era o bug) ---------- */
{
  const tex = trecho('function amGlyphTex(n, tone) {', 'function perspH(');
  ok(/const asset = n\.params\['glyphAsset' \+ tone\]/.test(tex), 'amGlyphTex olha o asset do tom');
  ok(/const arq = n\.params\['glyphFile' \+ tone\]/.test(tex), 'o arquivo enviado continua valendo');
  ok(/const chave = arq \? 'f:' \+ arq : \(asset \? 'a:' \+ asset : ''\)/.test(tex), 'a chave do cache separa arquivo e asset');
  ok(/amAssetSrc\(asset\)\.then/.test(tex), 'o asset é resolvido de forma assíncrona (não trava o frame)');
  ok(/rt\.amCache\[chave\] = amFallbackTex\(\);/.test(tex), 'enquanto carrega mostra a reserva, sem sumir com o glifo');
  ok(/img\.onload = \(\) => \{/.test(tex) && /markDirty\(n\.id\); requestRender\(\);/.test(tex), 'quando o SVG chega, o quadro é redesenhado');
}

/* ---------- 3. resolução do asset ---------- */
{
  const src = trecho('function amAssetSrc(id) {', 'function amGlyphTex(');
  ok(/AM_ASSET_URL\.has\(id\)/.test(src), 'a URL do asset é cacheada (sem recarregar a cada frame)');
  ok(/await SS_DB\.getAsset\(id\)/.test(src), 'o asset vem da biblioteca (IndexedDB)');
  ok(/URL\.createObjectURL\(a\.blob\)/.test(src), 'usa o blob original, não a miniatura');
  ok(/if \(a\.name\) AM_ASSET_NOME\.set\(id, a\.name\)/.test(src), 'o nome do asset fica guardado para o rótulo');
  ok(/AM_ASSET_URL\.set\(id, url\)/.test(src), 'a URL resolvida entra no cache');
  ok(/if \(!a\) return '';/.test(src), 'asset apagado não quebra o render');
}

/* ---------- 4. o picker grava o que o render lê ---------- */
{
  const pick = trecho("astPickerAbrir({ titulo: p.label, kinds: ['svg', 'image']", 'setStatus(');
  ok(/kinds: \['svg', 'image'\]/.test(pick), 'a biblioteca oferece SVG e imagem');
  ok(/n\.params\['glyphAsset' \+ tone\] = asset\.id/.test(pick), 'o id do asset é gravado');
  ok(/n\.params\[p\.key\] = ''/.test(pick), 'o upload antigo é limpo para o asset valer');
  ok(!/asset\.dataUrl/.test(pick), 'não grava mais um dataUrl que o asset da biblioteca não tem');
  ok(/n\.runtime\.amCache = \{\}/.test(pick), 'trocar de SVG invalida o cache do nó (aparece na hora)');
  ok(/n\.params\[gk\] = 'custom'/.test(pick), 'o tom passa a usar o glifo do usuário');
  ok(/marcaNome\(\)/.test(pick), 'o nome do asset aparece na linha');
}

/* ---------- 5. a linha de arquivo é legível e clicável ---------- */
{
  ok(/const btn = E\('button', 'pbtn', 'Escolher…'\)/.test(html), 'o botão de arquivo tem rótulo curto');
  ok(/inp\.hidden = true;/.test(html), 'o input nativo fica escondido (não estoura a borda)');
  ok(/inp\.click\(\)/.test(html), 'o botão abre o seletor do sistema (funciona no APK)');
  ok(/const tomArq = \/\^glyphFile\(\[0-3\]\)\$\/.exec\(p\.key\)/.test(html), 'a linha reconhece o tom do glifo');
  ok(/AM_ASSET_NOME\.get\(idAsset\) \|\| 'asset da biblioteca'/.test(html), 'mostra o nome do asset escolhido');
  ok(/amAssetSrc\(n\.params\['glyphAsset' \+ tomArq\[1\]\]\)\.then/.test(html), 'o nome do asset volta depois de recarregar a sessão');
  ok(/'\.svg,\.png,\.jpg,\.jpeg,\.webp,image\/\*'/.test(html), 'os quatro tons aceitam SVG');
}

process.exit(resumo() ? 0 : 1);
