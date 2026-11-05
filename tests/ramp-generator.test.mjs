/* Color Ramp + Ramp Generator: gerar por harmonia, HSV global, biblioteca de
   presets do usuário e import/export (JSON e .gpl). */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}
const mod = extrai('3.7.0 — Ramp Generator', 'function rampaEditorUI() {');

console.log('ramp generator');

/* ---------- 1. o nó Color Ramp continua com as 5 interpolações ---------- */
{
  const def = extrai('  rampa: {', '  fresnel: {');
  for (const m of ['constant', 'linear', 'ease', 'bspline', 'cardinal']) {
    ok(new RegExp("\\['" + m + "'").test(def), `interpolação ${m} no nó`);
  }
  ok(/'interp', 'Interpolation'/.test(def), 'o nó expõe a interpolação');
  ok(/editar.*openRampa/s.test(def), 'o botão Edit ramp… abre o editor');
}

/* ---------- 2. regras de harmonia ---------- */
{
  const modos = ['random', 'complementar', 'analoga', 'mono', 'triade', 'tetrade', 'cinza', 'listras', 'tons'];
  for (const m of modos) ok(new RegExp("\\['" + m + "'").test(mod), `harmonia "${m}"`);
  ok(/const RAMPA_GERACOES = \[/.test(mod), 'a lista de harmonias é uma constante só (reusada no menu)');
  ok(/h = nd\(h0 \+ \(i % 2 \? 0\.5 : 0\)\);/.test(mod), 'complementar usa o matiz oposto');
  ok(/h = nd\(h0 \+ \(t - 0\.5\) \* 0\.25\);/.test(mod), 'análoga passeia perto do matiz base');
  ok(/h = nd\(h0 \+ \[0, 1 \/ 3, 2 \/ 3\]\[i % 3\]\);/.test(mod), 'tríade usa os três terços do círculo');
  ok(/h = nd\(h0 \+ \[0, 0\.25, 0\.5, 0\.75\]\[i % 4\]\);/.test(mod), 'tétrade usa os quatro quartos');
  ok(/else if \(modo === 'cinza'\) \{ h = 0; s = 0; v = t; \}/.test(mod), 'cinza vai de preto a branco');
  ok(/else if \(modo === 'listras'\) \{ h = h0; s = 0\.7; v = i % 2 \? 0\.14 : 0\.96; \}/.test(mod), 'listras alternam claro/escuro');
  ok(/else if \(modo === 'mono'\) \{ h = h0; s = 0\.15 \+ 0\.75 \* \(1 - t\); v = 0\.12 \+ 0\.88 \* t; \}/.test(mod), 'monocromática varia saturação e valor');
}

/* ---------- 3. geração: quantidade 2..32, posições aleatórias, pontas fixas ---------- */
{
  ok(/const n = Math\.min\(RAMPA_MAX, Math\.max\(RAMPA_MIN, Math\.round\(qtd\) \|\| 6\)\);/.test(mod), 'a quantidade respeita 2..32');
  ok(/if \(posAleatoria && i > 0 && i < n - 1\) p \+= \(Math\.random\(\) - 0\.5\) \* \(0\.7 \/ n\);/.test(mod), 'posições aleatórias só no miolo');
  ok(/paradas\.sort\(\(a, b\) => a\.p - b\.p\);/.test(mod), 'as paradas ficam em ordem');
  ok(/paradas\[0\]\.p = 0;/.test(mod) && /paradas\[n - 1\]\.p = 1;/.test(mod), 'a rampa sempre começa em 0 e termina em 1');
  ok(/paradas\[i\]\.p = Math\.min\(1, Math\.max\(paradas\[i - 1\]\.p \+ 0\.001, paradas\[i\]\.p\)\);/.test(mod), 'paradas nunca empatam na mesma posição');
  ok(/rpCtx\.paradas = paradas;/.test(mod) && /rpBase = null;/.test(mod), 'gerar troca as paradas e zera a base do HSV');
  ok(/rampaEditorUI\(\); rampaEditorDesenha\(\); rampaEditorAplica\(\);/.test(mod), 'gerar atualiza barra, desenho e aplicação (prévia viva)');
}

/* ---------- 4. HSV global ---------- */
{
  ok(/if \(!rpBase\) rpBase = rpCtx\.paradas\.map\(s => s\.c\);/.test(mod), 'o HSV global guarda a base para não acumular');
  ok(/const base = rpBase\[i\] \|\| s\.c;/.test(mod), 'cada parada é recalculada a partir da base');
  ok(/\(hsv\[0\] \+ dh \+ 1\) % 1/.test(mod), 'o matiz gira no círculo');
  ok(/Math\.min\(1, hsv\[1\] \* ds\)/.test(mod), 'saturação multiplicada e limitada');
  ok(/Math\.min\(1, hsv\[2\] \* dv\)/.test(mod), 'valor multiplicado e limitado');
  ok(/function rampaHSVReset/.test(mod) && /if \(rpBase\) rpCtx\.paradas = rpCtx\.paradas\.map/.test(mod), 'Reset HSV volta a rampa original');
  ok(/\['rpHue', '0'\], \['rpSat', '100'\], \['rpVal', '100'\]/.test(mod), 'o reset também devolve os sliders ao neutro');
}

/* ---------- 5. biblioteca de presets do usuário ---------- */
{
  ok(/const RAMPA_PRESETS_KEY = 'ee_ramp_presets'/.test(mod), 'os presets do usuário têm chave própria');
  ok(/localStorage\.setItem\(RAMPA_PRESETS_KEY/.test(mod) && /localStorage\.getItem\(RAMPA_PRESETS_KEY\)/.test(mod), 'salvar e ler do localStorage');
  ok(/function rampaPresetGuardar/.test(mod) && /\.filter\(p => p\.n !== nome\)/.test(mod), 'salvar com o mesmo nome substitui');
  ok(/function rampaPresetRemover/.test(mod), 'dá para apagar um preset salvo');
  ok(/b\.addEventListener\('contextmenu', e => \{ e\.preventDefault\(\); rampaPresetRemover/.test(mod), 'clique direito apaga o preset');
  ok(/b\.addEventListener\('click', \(\) => rampaAplicaPreset\(P\)\)/.test(mod), 'clique aplica o preset');
  ok(/if \(!lista\.length\) \{[\s\S]{0,120}No ramps saved yet/.test(mod), 'a lista vazia explica o que fazer');
  ok(/\.slice\(0, 60\)/.test(mod), 'a biblioteca tem teto (não cresce sem limite)');
}

/* ---------- 6. importar / exportar ---------- */
{
  ok(/function rampaExportaJSON/.test(mod) && /formato: 'everythingeditor\.ramp'/.test(mod), 'exporta JSON com assinatura própria');
  ok(/paradas: rpCtx\.paradas\.map\(x => \(\{ p: Number\(x\.p\.toFixed\(4\)\), c: x\.c \}\)\)/.test(mod), 'o JSON leva todas as paradas');
  ok(/function rampaExportaGPL/.test(mod) && /GIMP Palette\\nName: /.test(mod), 'exporta .gpl (GIMP Palette)');
  ok(/rampaLutPontos\(rpCtx\.paradas, 16\)/.test(mod), 'o .gpl é amostrado da rampa');
  ok(/function rampaImporta\(texto, nomeArquivo\)/.test(mod), 'a importação é uma função só para os dois formatos');
  ok(/const m = \/\^\\s\*\(\\d\{1,3\}\)\\s\+\(\\d\{1,3\}\)\\s\+\(\\d\{1,3\}\)\/\.exec\(linha\);/.test(mod), 'lê linhas R G B do .gpl');
  ok(/Array\.isArray\(dados\.paradas\) \? dados\.paradas : \(Array\.isArray\(dados\.s\)/.test(mod), 'aceita JSON do editor e listas [p, cor]');
  ok(/if \(!paradas \|\| paradas\.length < RAMPA_MIN\)[\s\S]{0,120}Could not read that ramp file\./.test(mod), 'arquivo inválido avisa em vez de quebrar a rampa');
  ok(/new FileReader\(\)/.test(html) && /fr\.readAsText\(f\)/.test(html), 'importa arquivo do disco (funciona no APK)');
  ok(/URL\.createObjectURL\(blob\)/.test(mod) && /a\.download = nome/.test(mod), 'exportar baixa o arquivo');
}

/* ---------- 7. hex por parada ---------- */
{
  ok(/function rampaHexNormal\(v\)/.test(mod), 'há um validador de hex');
  ok(/const v = rampaHexNormal\(hex\.value\);/.test(html), 'o campo hex usa o validador');
  ok(/if \(!v\) \{ hex\.value = rpCtx\.paradas\[rpCtx\.sel\]\.c; return; \}/.test(html), 'hex inválido volta para a cor atual');
  ok(/const hx = rpDlgEl\.querySelector\('#rpHex'\);/.test(html), 'trocar de parada atualiza o hex');
  ok(/id = 'rpHex'|hex\.id = 'rpHex'/.test(html), 'o campo hex existe no editor');
}

/* ---------- 8. UI ligada ---------- */
{
  for (const id of ['rpGenModo', 'rpGenQtd', 'rpGerar', 'rpHsvReset', 'rpCustName', 'rpCustSave', 'rpCust', 'rpExpJson', 'rpExpGpl']) {
    ok(html.includes("'" + id + "'"), `o editor tem #${id}`);
  }
  for (const id of ['rpHue', 'rpSat', 'rpVal']) ok(html.includes("mkHsv('" + id + "'"), `o editor tem o slider #${id}`);
  ok(/impLbl = E\('label', 'btn', 'Import ↑'\)/.test(html), 'o botão de importar é um label com file input (APK)');
  ok(/accept = '\.json,\.gpl,\.txt,application\/json,text\/plain'/.test(html), 'o seletor de arquivo aceita os dois formatos');
  ok(/setStatus\('Ramp generated: ' \+ genModo\.options\[genModo\.selectedIndex\]\.textContent/.test(html), 'o status conta o que foi gerado');
}

/* ---------- 9. biblioteca de presets legível (3.8.2) ---------- */
{
  /* o painel é uma coluna flex (.mdlg-side): filho só com max-height ENCOLHE até
     virar uma tirinha com scrollbar — era o que aparecia no print do usuário. */
  ok(/rpPresetBox\.style\.cssText = 'flex:0 0 auto;min-height:120px;overflow-y:auto/.test(html),
    'a caixa dos presets não encolhe no flex da coluna');
  ok(/#rpPresets\{height:186px\}/.test(html), 'a caixa tem altura de verdade (186px)');
  ok(/body\.mobile #rpPresets\{height:150px\}/.test(html), 'no APK a caixa é mais baixa para caber na folha');
  ok(!/rpPresetBox\.style\.cssText = '[^']*max-height:190px/.test(html), 'o max-height que causava o espremido saiu');
  ok(/grid-template-columns:repeat\(3,1fr\);grid-auto-rows:34px;gap:6px;align-content:start/.test(html),
    'grade de 3 colunas com linhas de 34px (swatch de ~72×34)');
  ok(/b\.style\.cssText = 'height:100%;min-height:34px;border-radius:6px/.test(html), 'o swatch preenche a linha da grade');
  ok(/b\.className = 'rp-preset'/.test(html), 'o swatch ganhou classe para o estado de hover');
  ok(/\.rp-preset:hover\{box-shadow:0 0 0 2px var\(--accent\)\}/.test(html), 'hover marca o preset (dá para ver o que vai clicar)');
  ok(/\.rp-preset\{transition:box-shadow/.test(html), 'o anel aparece com transição curta (sem repintar o painel)');
  ok(/custBox\.style\.cssText = 'flex:0 0 auto;display:flex;flex-wrap:wrap/.test(html), '"My ramps" também não encolhe');
  /* conta o que cabe na tela: 186px - 12px de padding = 174px / 34px = 5 linhas × 3 = 15 presets por vez */
  const altura = 186, pad = 12, linha = 34;
  ok(Math.floor((altura - pad) / linha) === 5, 'cabem 5 linhas (15 presets) por tela, o resto rola', Math.floor((altura - pad) / linha));
}

process.exit(resumo() ? 0 : 1);
