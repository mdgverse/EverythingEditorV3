/* ajudantes dos testes (sem framework) */
let falhas = 0, passes = 0;
export function ok(cond, msg, extra) {
  if (cond) { passes++; console.log('  ✓', msg); }
  else { falhas++; console.log('  ✗', msg, extra === undefined ? '' : JSON.stringify(extra)); }
}
export function resumo() {
  console.log(`\n${passes} passaram, ${falhas} falharam`);
  return falhas === 0;
}
export function arquivo(nome, dados = '', tipo = '') {
  return new File([dados], nome, { type: tipo });
}
