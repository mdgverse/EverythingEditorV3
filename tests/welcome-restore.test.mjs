/* Telinha de entrada ("tenha uma ótima edição") e o botão Restore ao lado de Assets. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

console.log('entrada do app');

/* ---------- telinha de entrada ---------- */
const splash = extrai('<div class="ee-splash" id="eeSplash"', '</script>\n<div class="app">');
ok(/id="eeSplash"/.test(splash), 'existe a telinha de entrada');
ok(/ id="eeSplash" hidden|hidden>/.test(splash), 'começa escondida (o script mostra)', splash.slice(0, 90));
ok(/class="ee-splash-logo">Everything Editor</.test(splash), 'título Everything Editor');
ok(/class="ee-splash-byline">by mdgverse\.dsgn</.test(splash), 'assinatura by mdgverse.dsgn');
ok(/id="eeSplashGreet">Tenha uma ótima edição!</.test(splash), 'saudação em português', /eeSplashGreet[^<]*/.exec(splash)?.[0]);
ok(/id="eeSplashGo" type="button">Começar edição</.test(splash), 'botão Começar edição');
ok(/M12,12C9,7\.6,5\.2,7\.6,5\.2,12/.test(splash), 'marca do infinito na telinha');
ok(/<div class="ee-splash"[\s\S]*?<\/script>\s*<div class="app">/.test(html), 'a telinha vem antes do app (aparece primeiro)');

/* script da telinha */
ok(/pt \? 'Tenha uma ótima edição!' : 'Have a great edit!'/.test(splash), 'saudação por idioma');
ok(/pt \? 'Começar edição' : 'Start editing'/.test(splash), 'botão por idioma');
ok(/\/\^pt\/i\.test\(navigator\.language/.test(splash), 'idioma do navegador decide quando não há preferência');
ok(/localStorage\.getItem\('everything-editor:lang'\)/.test(splash), 'preferência salva tem prioridade');
ok(/el\.hidden = false/.test(splash) && /classList\.add\('is-on'\)/.test(splash), 'aparece com animação');
ok(/go\.addEventListener\('click', fecha\)/.test(splash), 'sai no clique do botão');
ok(/e\.target === el\) fecha\(\)/.test(splash), 'sai clicando fora');
ok(/e\.key === 'Escape' \|\| e\.key === 'Enter'/.test(splash), 'sai com Esc ou Enter');
ok(/let indo = false/.test(splash), 'não fecha duas vezes (clique + tecla)');

/* CSS da telinha */
ok(/\.ee-splash\{position:fixed;inset:0/.test(html), 'cobre a tela toda');
ok(/\.ee-splash\[hidden\]\{display:none\}/.test(html), 'escondida de verdade quando fechada');
ok(/\.ee-splash\.is-on \.ee-splash-card\{transform:scale\(1\)/.test(html), 'cartão entra com escala');
ok(/z-index:9800/.test(html), 'fica abaixo dos diálogos de confirmação (9900)', 9800);

/* ---------- botão Restore ao lado de Assets ---------- */
{
  const barra = extrai('<header class="topbar">', '<div class="brand-menu"');
  const iA = barra.indexOf('id="btnAssets"'), iR = barra.indexOf('id="btnRestore"');
  ok(iA > 0 && iR > iA, 'Restore vem logo depois de Assets', iA + '/' + iR);
  ok(iR - iA < 200, 'é o vizinho imediato de Assets', iR - iA);
  ok(/id="btnRestore" title="Restaurar: cache deste navegador ou arquivo de backup/.test(barra), 'título explica as duas fontes');
}

ok(/br\.addEventListener\('click', \(\) => abrirRestaurar\(\)\)/.test(html), 'o botão abre o Restaurar');
ok(/if \(br && !br\.dataset\.ast\)/.test(html), 'ligado uma vez só (junto com o Assets)');
ok(/'btnAssets','btnRestore'/.test(html), 'rótulo curto no celular acompanha');

/* ---------- as duas fontes ---------- */
{
  const f = extrai('async function abrirRestaurar()', 'function astMontaBotoes()');
  ok(/'Cache deste navegador'/.test(f), 'opção: cache do navegador');
  ok(/'Arquivo de backup \(\.json\)'/.test(f), 'opção: arquivo .json');
  ok(/escolha === 0\) return restaurarSessaoCache\(\)/.test(f), 'cache vai para a sessão guardada');
  ok(/getElementById\('ssRestoreFile'\)/.test(f) && /inp\.click\(\)/.test(f), 'arquivo usa o mesmo seletor do Restore backup');
}

{
  const r = extrai('async function restaurarSessaoCache()', 'abrirRestaurar');
  ok(/PERSIST\.get\(PERSIST\.KEY\)/.test(r), 'lê a sessão guardada');
  ok(/PERSIST\.get\(PERSIST\.KEY \+ ':antiga'\)/.test(r), 'lê também o backup antigo');
  ok(/Nenhuma sessão guardada neste navegador/.test(r), 'avisa quando não há nada');
  ok(/astConfirma\('Restaurar do cache'/.test(r), 'confirma antes de trocar o que está aberto');
  ok(/await loadGraphData\(JSON\.parse\(opcoes\[escolha\]\.json\)\)/.test(r), 'reabre o grafo escolhido');
  ok(/sessionRestoring = false/.test(r) && /saveSessionSoon\(\)/.test(r), 'volta a salvar a sessão depois');
  ok(/frameAll\(\)/.test(r), 'enquadra o que foi restaurado');
  ok(/Não foi possível ler a sessão guardada/.test(r), 'erro de leitura vira aviso');
}

const tudo = resumo();
process.exit(tudo ? 0 : 1);
