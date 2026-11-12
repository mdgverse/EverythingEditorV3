/* Backup/Restore: tudo o que mora no IndexedDB (projetos, pastas, Assets)
   vira um .json que sobrevive à troca de endereço (HTML local → site). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

const lib = new Function(
  extrai("const BK_TIPO = 'everything-editor-backup'", 'async function bkBackupTudo') +
  '\nreturn { BK_TIPO, BK_V, bkBlobParaTexto, bkTextoParaBlob, bkEmbalar, bkDesembalar };'
)();
const { BK_TIPO, BK_V, bkBlobParaTexto, bkTextoParaBlob, bkEmbalar, bkDesembalar } = lib;

const bytes = async b => [...new Uint8Array(b instanceof Blob ? await b.arrayBuffer() : b)].join(',');

console.log('backup · projetos de um navegador para outro');

ok(BK_TIPO === 'everything-editor-backup', 'assinatura do arquivo', BK_TIPO);
ok(BK_V === 1, 'versão do formato', BK_V);

/* ---------- Blob <-> dataURL ---------- */
{
  const original = new Blob([new Uint8Array([0, 1, 2, 127, 128, 250, 255])], { type: 'image/png' });
  const texto = await bkBlobParaTexto(original);
  ok(texto.startsWith('data:image/png;base64,'), 'Blob vira dataURL com o tipo', texto.slice(0, 30));
  const volta = bkTextoParaBlob(texto);
  ok((await bytes(volta)) === (await bytes(original)), 'bytes voltam iguais', await bytes(volta));
  ok(volta.type === 'image/png', 'tipo volta igual', volta.type);
}

ok(bkTextoParaBlob('nem data url') === null && bkTextoParaBlob('') === null, 'dataURL inválida não quebra');

/* ---------- ida e volta de um pacote completo ---------- */
{
  const png = new Blob([new Uint8Array([9, 8, 7, 6])], { type: 'image/png' });
  const pacote = {
    meta: [{ id: 'p1', name: 'Cartaz', updated: 1700000000000, thumb: 'data:image/png;base64,AAAA' }],
    data: ['{"nodes":[],"links":[]}'],
    dataKeys: ['p1'],
    folders: [{ id: 'f1', name: 'Cliente', created: 1 }],
    assetFolders: [{ id: 'af1', name: 'Texturas', created: 2 }],
    assets: [{ id: 'a1', name: 'grao.png', kind: 'imagem', blob: png, thumb: 'data:image/png;base64,BBBB' }],
    mascara: new Uint8Array([1, 2, 3]),
    aninhado: { lista: [{ v: 1 }, { v: null }] },
  };
  const embalado = await bkEmbalar(pacote);
  const idaEVolta = bkDesembalar(JSON.parse(JSON.stringify(embalado)));   // passa pelo arquivo de verdade

  ok(idaEVolta.meta[0].name === 'Cartaz' && idaEVolta.meta[0].thumb.endsWith('AAAA'), 'projeto volta com nome e miniatura');
  ok(idaEVolta.data[0] === '{"nodes":[],"links":[]}' && idaEVolta.dataKeys[0] === 'p1', 'grafo volta com a sua chave');
  ok(idaEVolta.folders[0].name === 'Cliente' && idaEVolta.assetFolders[0].name === 'Texturas', 'pastas voltam');
  ok(idaEVolta.assets[0].blob instanceof Blob, 'asset volta como Blob');
  ok((await bytes(idaEVolta.assets[0].blob)) === '9,8,7,6', 'bytes do asset voltam iguais', await bytes(idaEVolta.assets[0].blob));
  ok(idaEVolta.mascara instanceof Uint8Array && (await bytes(idaEVolta.mascara)) === '1,2,3', 'TypedArray volta como Uint8Array');
  ok(idaEVolta.aninhado.lista[0].v === 1 && idaEVolta.aninhado.lista[1].v === null, 'objetos aninhados voltam');
  ok(typeof JSON.stringify(embalado).blob !== 'object', 'o pacote é JSON puro (nada de Blob cru)');
}

/* ---------- ligação com o app ---------- */
ok(/NAME = 'everything-editor-projects'/.test(html), 'o backup usa o banco dos projetos');
ok(/async dump\(\)/.test(extrai('const SS_DB = (() => {', 'async function ssOpenProject')), 'SS_DB.dump() existe');
ok(/async restore\(pack\)/.test(extrai('const SS_DB = (() => {', 'async function ssOpenProject')), 'SS_DB.restore(pack) existe');
ok(/getAllKeys\(\)/.test(html), 'as chaves da loja data viajam junto (chave fora do registro)');
ok(/for \(let i = 0; i < dados\.length; i\+\+\)/.test(html), 'restore regrava o grafo com a chave certa');
ok(/if \(!pack \|\| pack\.tipo !== BK_TIPO\)/.test(html), 'restore recusa arquivo que não é backup');
ok(/downloadBlob\(blob, 'ouroboros-editor-backup-'/.test(html), 'backup sai como arquivo pelo mesmo caminho do Save graph (funciona no APK)');
ok(/id="ssBackup"/.test(html) && /id="ssRestore"/.test(html), 'botões Backup/Restore na tela inicial');
ok(/id="ssRestoreFile" type="file"|id="ssRestoreFile"[^>]*accept="\.json/.test(html), 'escolha do arquivo de backup');
ok(/bkBackupTudo\(\)\.catch/.test(html) && /bkRestaurarTudo\(arq\)\.catch/.test(html), 'falhas viram aviso em vez de travar');
ok(/try \{ await ssRenderRecent\(\); \}/.test(html), 'a lista de projetos se refaz depois de restaurar');

/* ---------- os mesmos botões dentro de Assets ---------- */
{
  const tela = extrai("const el = E('div', 'ast'); el.id = 'astScr';", "const drop = E('div', 'ast-drop'");
  ok(/id = 'astBtnBackup'/.test(tela) && /'Backup all'/.test(tela), 'Assets tem Backup', tela.length);
  ok(/id = 'astBtnRestore'/.test(tela) && /'Restore'/.test(tela), 'Assets tem Restore');
  ok(/bBk\.addEventListener\('click', \(\) => \{ bkBackupTudo\(\)/.test(tela), 'o Backup de Assets usa a mesma função da Home');
  ok(/bRs\.addEventListener\('click', \(\) => rsInp\.click\(\)\)/.test(tela), 'Restore de Assets abre o seletor de arquivo');
  ok(/rsInp\.accept = '\.json,application\/json'/.test(tela), 'só aceita .json');
  ok(/if \(arq\) bkRestaurarTudo\(arq\)/.test(tela), 'o arquivo escolhido vai para o mesmo restore');
  ok(/acts\.append\(bBk, bRs, rsInp\)/.test(tela), 'os dois botões ficam na barra da biblioteca');
  ok(!/SS_DB\.dump\(\)[\s\S]*SS_DB\.dump\(\)/.test(tela), 'nada de backup duplicado dentro de Assets');
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
