/* Zoom mínimo de 5% (3.2.3): canvas, preview e editor de máscara no mesmo piso. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

console.log('zoom mínimo');

/* ---------- canvas: todos os caminhos de zoom caem no mesmo piso ---------- */
ok(/mkBtn\('−', \(\) => \{ view\.s = Math\.max\(0\.05, view\.s \/ 1\.25\); aplicaVista\(\); \}\)/.test(html),
  'botão − do canvas vai até 5%', 'botao');
ok(/view\.s = Math\.max\(0\.05, Math\.min\(10, view\.s \* f\)\)/.test(html), 'roda do mouse: piso 5%', 'roda');
ok(/view\.s = Math\.max\(0\.05, Math\.min\(10, view\.s \* \(e\.altKey \? 1 \/ 1\.6 : 1\.6\)\)\)/.test(html),
  'Alt + roda: piso 5%', 'alt');
ok(/view\.s = Math\.max\(0\.05, Math\.min\(10, pinch\.s \* d \/ pinch\.d\)\)/.test(html), 'pinça do app: piso 5%', 'pinca');
ok(/if \(e\.key === '-'\) \{ view\.s = Math\.max\(0\.05, view\.s \/ 1\.25\); aplicaVista\(\); return; \}/.test(html),
  'tecla - do teclado: piso 5%', 'tecla');
ok(!/Math\.max\(0\.1, view\.s/.test(html) && !/Math\.max\(0\.1, Math\.min\(10, view\.s/.test(html),
  'nenhum caminho do canvas ficou no piso antigo de 10%', 'antigo');

/* ---------- preview: mesma faixa ---------- */
ok(/clamp\(old \* \(e\.deltaY < 0 \? 1\.12 : 1 \/ 1\.12\), 0\.05, 20\)/.test(html), 'roda no preview começa em 5%', 'preview');
ok(/pv\.zoom = clamp\(pvPinch\.z0 \* dist\(a, b\) \/ pvPinch\.d0, 0\.05, 20\)/.test(html), 'pinça do preview começa em 5%', 'preview-pinca');

/* ---------- editor de máscara já usava 5%: continua igual ---------- */
ok(/const ns = clamp\(v\.s \* f, 0\.05, 40\)/.test(html), 'máscara: piso 5% (sem mudança)', 'mascara');

/* ---------- o rótulo mostra a porcentagem arredondada ---------- */
ok(/zoomLbl\.textContent = Math\.round\(view\.s \* 100\) \+ '%'/.test(html), 'o rótulo mostra 5% quando chega no piso', 'label');
ok(/mkBtn\('Redefinir vista', \(\) => \{ view\.s = 1;/.test(html), 'redefinir volta para 100%', 'reset');

process.exit(resumo() ? 0 : 1);
