import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const between = (a, b) => {
  const i = html.indexOf(a), j = html.indexOf(b, i + a.length);
  assert(i >= 0 && j > i, `seção não encontrada: ${a}`);
  return html.slice(i, j);
};
const defs = between('const NODE_TYPES = {', '\nconst SHADERS =');
const run = between('const RUN = {', '\nfunction ');
const removed = ['bpPrincipled', 'bpDiffuse', 'bpGlossy', 'bpGlass', 'bpEmission', 'bpTransparent', 'bpMixShader', 'bpAddShader'];
for (const id of removed) {
  assert(!new RegExp(`\\b${id}\\s*:`).test(defs), `${id} ainda registrado`);
  assert(!new RegExp(`\\b${id}\\s*:`).test(run), `${id} ainda no runner`);
}
assert(!html.includes("label: 'Shader (Blender)'"));
assert(!html.includes('SHADERS.bsdf =') && !html.includes('SHADERS.shaderMix ='));
for (const id of ['image', 'fill', 'brightness', 'layers', 'layerMix', 'mix', 'output']) {
  assert(new RegExp(`\\b${id}\\s*:`).test(defs), `nó anterior ausente: ${id}`);
}
assert(html.includes('angled_orthogonal'), 'estilo de fio posterior deve continuar');
assert(html.includes('const SHADERS = {') && html.includes('for (const name in SHADERS)'), 'shaders de imagem e boot preservados');
assert(html.includes("const SOCKET_IMAGE = '#c7c729'"), 'cor dos sockets anteriores preservada');
console.log('Remoção dos oito nós e preservação dos recursos existentes: OK');
