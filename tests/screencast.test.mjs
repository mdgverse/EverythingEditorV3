/* Screencast keys: interruptor abaixo do Node picker + overlay de teclas,
   cliques e comandos do editor, com fade-out automático. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extrai(ini, fim) {
  const a = html.indexOf(ini), b = html.indexOf(fim, a);
  if (a < 0 || b < 0) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
}

console.log('screencast keys · overlay de entradas');

/* ---------- 1. o interruptor mora no menu da marca, abaixo do Node picker ---------- */
{
  const menu = extrai('<div class="brand-menu" id="brandMenu"', '<div id="projTabs"');
  const iP = menu.indexOf('id="addViewSel"');
  const iT = menu.indexOf('id="sckToggle"');
  ok(iP > 0 && iT > iP, 'o interruptor vem depois do Node picker', iP + '/' + iT);
  ok(iT - iP < 600, 'é a seção logo abaixo do Node picker', iT - iP);
  const h1 = menu.indexOf('Node picker</div>'), h2 = menu.indexOf('Screencast keys</div>');
  ok(h1 > 0 && h2 > h1, 'o título Screencast keys vem depois do título Node picker', h1 + '/' + h2);
  const entre = menu.slice(iP, iT);
  ok((entre.match(/bm-h/g) || []).length === 1, 'nenhuma outra seção se mete entre as duas', entre.length);
  ok(/<input type="checkbox" id="sckToggle" role="switch"/.test(menu), 'é um switch de verdade (checkbox + role=switch)');
  ok(/id="sckState">Off</.test(menu), 'começa desligado, com o estado escrito ao lado');
}

/* ---------- 2. o overlay vive no canto do editor de nós ---------- */
{
  const nv = extrai('<section class="node-view" id="nodeView">', '<div id="grpMenu"');
  ok(/id="sckOverlay"[^>]*hidden/.test(nv), 'o overlay nasce escondido dentro do node-view');
  ok(/id="sckLive"/.test(nv), 'tem a linha do que está pressionado agora');
  ok(/id="sckLog"/.test(nv), 'tem o histórico de entradas');
  ok(nv.indexOf('class="hint"') < nv.indexOf('id="sckOverlay"'), 'entra depois do .hint, para ficar por cima dele');
  const css = extrai('#sckOverlay{', '}', ) || '';
  ok(/#sckOverlay\{position:absolute;left:\d+px;bottom:\d+px/.test(html), 'fica ancorado no canto inferior esquerdo do node-view');
  ok(/#sckOverlay\{[^}]*bottom:(\d+)px/.exec(html) && Number(/#sckOverlay\{[^}]*bottom:(\d+)px/.exec(html)[1]) >= 24, 'sobe o suficiente para não cobrir a linha do .hint');
  ok(/#sckOverlay\{[^}]*pointer-events:none/.test(html), 'não intercepta clique no canvas');
  ok(/#sckOverlay\[hidden\]\{display:none\}/.test(html), 'o atributo hidden realmente esconde');
  ok(/\.sck-l\.sai\{animation:sckOut/.test(html) && /@keyframes sckOut\{to\{opacity:0/.test(html), 'a linha sai com fade-out');
  ok(/@media \(prefers-reduced-motion: reduce\)\{\.sck-l\{animation:none\}/.test(html), 'respeita quem pediu menos animação');
  ok(!css.includes('position:fixed'), 'nada de fixed cobrindo a timeline');
}

/* ---------- 3. o listener de eventos ---------- */
{
  const mod = extrai('const SCK_PREF', '// brand menu: opens under');
  ok(/addEventListener\('keydown',[\s\S]{0,400}\{ capture: true, passive: true \}/.test(mod), 'keydown escutado em captura e passivo');
  ok(/addEventListener\('keyup',[\s\S]{0,300}\{ capture: true, passive: true \}/.test(mod), 'keyup tira a tecla da lista de pressionadas');
  ok(/addEventListener\('pointerdown',[\s\S]{0,400\}\.concat\(\[b\]\)/.test(mod) === false, 'clique reportado pelo pointerdown');
  ok(/pointerdown', e => \{[\s\S]{0,300}sckLoga\(sckMods\(e\)\.concat\(\[b\]\)\.join\(' \+ '\)\)/.test(mod), 'o clique entra no histórico com os modificadores (Shift + Left click)');
  ok(/pointerup/.test(mod) && /pointercancel/.test(mod), 'soltar o botão (ou cancelar) limpa a linha de baixo');
  ok(/addEventListener\('blur'/.test(mod), 'perder o foco do app limpa as teclas presas');
  ok(/if \(!e\.repeat\) sckLoga/.test(mod), 'segurar a tecla não repete a entrada');
  ok(/' ': 'Spacebar'/.test(mod) && /ArrowUp: '↑'/.test(mod), 'teclas especiais ganham nome legível');
  ok(/const SCK_TTL = \d+;/.test(mod), 'o tempo do fade é uma constante');
  ok(/if \(texto === sckUltimo\.texto && agora - sckUltimo\.t < 500\) return;/.test(mod), 'rajada do mesmo comando não polui o histórico');
  ok(/while \(sckEls\.log\.children\.length > SCK_MAX\)/.test(mod), 'o histórico não cresce sem limite');
}

/* ---------- 4. comandos do editor dentro do overlay ---------- */
{
  const st = extrai('function setStatus(msg, err = false) {', 'statusEl.textContent');
  ok(/sckComando\(msg, err\)/.test(st), 'todo setStatus alimenta o overlay');
  ok(/function sckComando\(msg, erro\)/.test(html), 'o gancho é uma função, não código inline repetido');
  ok(/try \{ sckComando\(msg, err\); \} catch/.test(st), 'se o módulo ainda não subiu, o status continua funcionando');
  ok(/li\.className = 'sck-l' \+ \(erro \? ' err' : ''\)/.test(html), 'erro aparece em vermelho no histórico');
}

/* ---------- 5. liga/desliga e memória ---------- */
{
  ok(/localStorage\.setItem\(SCK_PREF/.test(html) && /localStorage\.getItem\(SCK_PREF\)/.test(html), 'o estado fica salvo (nasce desligado)');
  ok(/const SCK_PREF = 'ee_screencast_keys'/.test(html), 'chave própria, sem pisar nas outras preferências');
  ok(/window\.screencastKeys = sckLiga/.test(html), 'dá para ligar pelo console (screencastKeys(true))');
  ok(/if \(sckOn\) sckLoga\('Screencast keys on'\)/.test(html), 'ao ligar, o overlay já mostra que está ativo');
  ok(/if \(sckEls && sckEls\.wrap\) sckEls\.wrap\.hidden = !sckOn;/.test(html), 'o mesmo estado controla a visibilidade do overlay');
}

/* ---------- 6. nada de classe morta ---------- */
{
  const classes = [...new Set([...html.matchAll(/\.(sck-[a-z-]+|bm-tg[a-z-]*)/g)].map(m => m[1]))];
  ok(classes.length >= 6, 'as classes do recurso existem', classes.length);
  for (const c of classes) {
    const usado = new RegExp('class="[^"]*\\b' + c + '\\b').test(html) || new RegExp("className = '[^']*\\b" + c + '\\b').test(html) || new RegExp("'" + c + "'").test(html);
    ok(usado, `a classe .${c} é usada no HTML/JS`);
  }
}

process.exit(resumo() ? 0 : 1);
