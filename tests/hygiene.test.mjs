/* Higiene: nada de código morto nem material de análise publicado junto com o site. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, resumo } from './kit.mjs';

const raiz = new URL('..', import.meta.url);
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const existe = p => fs.existsSync(new URL(p, raiz));

console.log('higiene do projeto');

/* ---------- já apagados: não podem voltar ---------- */
const proibidos = ['astLerDataUrl', 'MEDIA_LIVE_DRIFT', 'NODE_LINK_ICON', 'fx4Hash', 'ssMaxSide'];
for (const nome of proibidos) {
  ok(!new RegExp('\\b' + nome + '\\b').test(html), `"${nome}" continua fora do código`);
}

/* ---------- classes de CSS sem uso ---------- */
const mortas = ['hmchip', 'hmchip-t', 'hmchips', 'hmdock', 'hmsec', 'recbtn', 'rechint', 'reclbl',
  'recpanel', 'recrow', 'recsec', 'recstat', 'rectitle', 'recx', 'recov', 'm-lang', 'tblk-ctr'];
for (const c of mortas) {
  ok(!new RegExp('\\.' + c + '(?![\\w-])').test(html), `classe ".${c}" saiu do CSS`);
}
ok(!/'\.recov'/.test(html), 'o seletor .recov saiu da checagem de foco do timeline');

/* ---------- classes declaradas no CSS e nunca usadas ---------- */
{
  const blocos = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  let resto = html;
  for (const b of blocos) resto = resto.replace(b, '');
  const declaradas = new Set();
  for (const b of blocos) {
    const limpo = b.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of limpo.matchAll(/\.([a-zA-Z][\w-]*)/g)) declaradas.add(m[1]);
  }
  /* em JS a classe aparece como seletor ('.nome'), então só a borda da esquerda
     não pode ser letra/hífen */
  const semUso = [...declaradas].filter(c => !new RegExp('(?<![\\w-])' + c + '(?![\\w-])').test(resto));
  ok(semUso.length === 0, 'nenhuma classe de CSS sobrando', semUso.join(', '));
}

/* ---------- funções e constantes de topo declaradas e nunca usadas ---------- */
{
  const conta = nome => (html.match(new RegExp('\\b' + nome.replace(/[$]/g, '\\$') + '\\b', 'g')) || []).length;
  const orfas = [];
  for (const m of html.matchAll(/(?<!\()\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const nome = m[1];
    if (conta(nome) <= 1) orfas.push('função ' + nome);
  }
  for (const m of html.matchAll(/^(?:const|let)\s+([A-Za-z_][\w$]*)\s*=/gm)) {
    const nome = m[1];
    if (conta(nome) <= 1) orfas.push('const ' + nome);
  }
  ok(orfas.length === 0, 'nenhuma função/constante órfã', orfas.join(', '));
}

/* ---------- todo programa de shader usado existe no dicionário ----------
   Pega a classe de erro que quebrou o "Spin Focus Light Leak" na 3.0.1:
   pointOp/draw pedindo um nome que não está em SHADERS (undefined.p no draw). */
{
  console.log('\nProgramas de shader');
  const ini = html.indexOf('const SHADERS = {');
  const bloco = ini < 0 ? '' : html.slice(ini, html.indexOf('\n};\n', ini));
  const chaves = new Set(html.match(/SHADERS\.([A-Za-z_]\w*)\s*=/g)?.map(x => x.replace(/SHADERS\.|\s*=/g, '')) || []);
  for (const m of bloco.matchAll(/^ {2}([A-Za-z_]\w*): /gm)) chaves.add(m[1]);
  ok(chaves.size > 50, 'dicionário de shaders lido', chaves.size);
  const usos = new Set([...html.matchAll(/pointOp\([^,()]+, *'(\w+)'/g)].map(m => m[1]));
  for (const m of html.matchAll(/\bdraw\('(\w+)'/g)) usos.add(m[1]);
  const faltando = [...usos].filter(n => !chaves.has(n)).sort();
  ok(usos.size > 50, 'usos de pointOp/draw encontrados', usos.size);
  ok(faltando.length === 0, 'todo draw/pointOp aponta para um shader que existe', faltando.join(', '));
  ok(!/world = null|qTime/.test(bloco), 'dicionário íntegro');
}

/* ---------- arquivos ---------- */
ok(!existe('reference'), 'pasta reference/ apagada (1,3 MB que ia para o site)');
ok(!existe('.github/workflows/fetch-reference.yml'), 'workflow que baixava a referência apagado');
ok(existe('index.html') && existe('tests') && existe('android'), 'o que é usado continua no lugar');
ok(existe('.nojekyll'), '.nojekyll preservado (o Pages precisa dele)');
ok(fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8').trim() === '', 'README continua vazio');

/* ---------- todo teste do projeto roda no CI, e nada de workflow sobrando ---------- */
{
  const ci = fs.readFileSync(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8');
  const arquivos = fs.readdirSync(new URL('../tests', import.meta.url)).filter(f => f.endsWith('.test.mjs'));
  for (const f of arquivos) ok(ci.includes('tests/' + f), `${f} rodando no CI`);
  ok(arquivos.length >= 8, 'todos os testes presentes', arquivos.length);
  const workflows = fs.readdirSync(new URL('../.github/workflows', import.meta.url)).filter(f => f.endsWith('.yml')).sort();
  /* 3.6.2 acrescentou o coletor da comunidade (cron do carrossel da Home) */
  ok(workflows.join(',') === 'build-apk.yml,community.yml,deploy-pages.yml,tests.yml', 'só os workflows que importam', workflows.join(', '));
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
