/* Barra superior: Restore ao lado de Assets e boot sem telinha na frente. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

console.log('barra superior · boot');

/* ---------- botão Restore ao lado de Assets ---------- */
{
  const barra = extrai('<header class="topbar">', '<div class="brand-menu"');
  const iA = barra.indexOf('id="btnAssets"'), iR = barra.indexOf('id="btnRestore"');
  ok(iA > 0 && iR > iA, 'Restore vem logo depois de Assets', iA + '/' + iR);
  ok(iR - iA < 200, 'é o vizinho imediato de Assets', iR - iA);
  ok(/id="btnRestore" title="Restaurar: cache deste navegador ou arquivo de backup/.test(barra), 'título explica as duas fontes');
}

/* ---------- 3.2.3: a telinha de entrada saiu (boot direto) ---------- */
ok(!/ee-splash/.test(html), 'nenhuma classe .ee-splash sobrou no HTML/CSS');
ok(!/eeSplash/.test(html), 'nenhum id eeSplash sobrou');
ok(!/Tenha uma ótima edição|Começar edição|Start editing/.test(html), 'a saudação e o botão da telinha saíram');
ok(/<body>\s*<div class="app">/.test(html), 'o app é a primeira coisa do body (nada de overlay esperando clique)');
ok(!/<body>[\s\S]{0,4000}?<\/script>\s*<div class="app">/.test(html), 'nenhum script de abertura roda antes do app');
ok(/localStorage\.getItem\(["']everything-editor:theme["']\)/.test(html), 'o script de tema (head) continua — só a telinha saiu');

/* ---------- a versão continua num lugar só, dentro do app ---------- */
ok(/const APP_VERSION = '\d+\.\d+\.\d+';/.test(html), 'APP_VERSION vive no script do app');
ok(!/eeSplashVer/.test(html), 'o lugar da versão na telinha não existe mais');

process.exit(resumo() ? 0 : 1);
