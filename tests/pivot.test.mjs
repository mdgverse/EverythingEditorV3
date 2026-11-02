/* Quinas (pivôs) do cabo: Alt+clique remove, duplo toque remove, clique normal arrasta. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function bloco() {
  const a = html.indexOf('/* ==== PIVOT HIT (BEGIN) ==== */');
  const b = html.indexOf('/* ==== PIVOT HIT (END) ==== */');
  if (a < 0 || b < 0 || b < a) throw new Error('marcadores PIVOT HIT não encontrados');
  return html.slice(a, b);
}

function criaEl() {
  return { _h: {}, addEventListener(t, f) { (this._h[t] || (this._h[t] = [])).push(f); } };
}

function monta() {
  const linksEl = criaEl();
  const acoes = [];
  const lib = { TAP_MS: 320 };
  const fabrica = new Function(
    'linksEl', 'lib', 'deletePivot', 'startPivotDrag', 'addPivotFromGesture', 'wireGesture', 'drawLinks', 'window', 'performance',
    bloco() + '\nreturn { onWirePointerDown };'
  );
  const api = fabrica(
    linksEl, lib,
    (l, i, m) => acoes.push(['delete', l.nome, i, m]),
    (e, l, i) => acoes.push(['drag', l.nome, i]),
    (e, l) => acoes.push(['criar', l.nome]),
    (e, l) => acoes.push(['gesto', l.nome]),
    () => {},
    { addEventListener() {} },
    { now: () => Date.now() }
  );
  /* TAP_MS é lido como variável livre no bloco real; injeta no escopo global do módulo */
  return { api, acoes, linksEl };
}

/* o bloco real usa TAP_MS e performance; expõe TAP_MS no global deste teste */
globalThis.TAP_MS = 320;

function alvo(cls, link = { nome: 'L1' }, idx = 2) {
  return { classList: { contains: c => c === cls }, __link: link, __idx: idx };
}

function ev(over = {}) {
  return Object.assign({
    button: 0, pointerType: 'mouse', altKey: false, shiftKey: false, pointerId: 1,
    clientX: 10, clientY: 10, stopPropagation() {}, preventDefault() {},
  }, over);
}

console.log('quinas do cabo (pivô)');

{
  const { api, acoes } = monta();
  api.onWirePointerDown(ev({ target: alvo('pivothit'), altKey: true }));
  ok(acoes.length === 1 && acoes[0][0] === 'delete', 'Alt + clique na quina remove', acoes);
  ok(acoes[0][1] === 'L1' && acoes[0][2] === 2, 'remove a quina certa (cabo e índice)', acoes[0]);
  ok(/Alt\+click/i.test(acoes[0][3] || ''), 'mensagem explica o atalho', acoes[0][3]);
}

{
  const { api, acoes } = monta();
  api.onWirePointerDown(ev({ target: alvo('pivot') }));
  ok(acoes.length === 1 && acoes[0][0] === 'drag', 'clique normal continua arrastando a quina', acoes);
}

{
  const { api, acoes } = monta();
  api.onWirePointerDown(ev({ target: alvo('pivot'), altKey: true, shiftKey: true }));
  ok(acoes.length === 1 && acoes[0][0] === 'drag', 'Alt+Shift na quina não apaga (não atropela outros atalhos)', acoes);
}

{
  const { api, acoes } = monta();
  const mesmaQuina = { nome: 'L1' };                 // o duplo toque só conta na mesma quina
  api.onWirePointerDown(ev({ target: alvo('pivothit', mesmaQuina, 2), pointerType: 'touch' }));
  ok(acoes.length === 1 && acoes[0][0] === 'drag', 'primeiro toque só seleciona/arrasta', acoes);
  api.onWirePointerDown(ev({ target: alvo('pivothit', mesmaQuina, 2), pointerType: 'touch' }));
  ok(acoes.length === 2 && acoes[1][0] === 'delete', 'duplo toque na quina remove (celular)', acoes);
  ok(/double tap/i.test(acoes[1][3] || ''), 'mensagem do duplo toque', acoes[1][3]);
}

{
  const { api, acoes } = monta();
  const l = { nome: 'L2', _link: null };
  const wire = { classList: { contains: c => c === 'linkhit' }, _link: l };
  api.onWirePointerDown(ev({ target: wire, altKey: true }));
  ok(acoes.length === 0, 'Alt no cabo (linkhit) não apaga quina — segue sendo o laço/zip', acoes);
}

{
  const { linksEl } = monta();
  ok(Array.isArray(linksEl._h.pointerdown) && linksEl._h.pointerdown.length === 1, 'handler de ponteiro ligado aos cabos');
  ok(Array.isArray(linksEl._h.dblclick) && linksEl._h.dblclick.length === 1, 'duplo clique também ligado');
}

/* estrutura: aviso visual do Alt e dica no rodapé */
ok(/body\.altkey circle\.pivot\{stroke:#ff6b6b/.test(html), 'quinas ficam vermelhas com Alt pressionado');
ok(html.includes('Alt + click on a corner: remove'), 'dica do rodapé cita o atalho novo');
ok(/deletePivot\(t\.__link, t\.__idx, 'Corner removed \(Alt\+click\)\.'\)/.test(html), 'Alt+clique chama deletePivot (com desfazer)');

const tudo = resumo();
process.exit(tudo ? 0 : 1);
