import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extract = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const code = extract('const WIRE_CURVE_KEY', '// "Node Link" icon') +
  extract('const ROUTE_R =', 'function drawLinks()') +
  extract('function zipD(', '// intersection of segment');
const storage = new Map();
const select = { value: '' }, tension = { value: '', disabled: false };
let draws = 0, commits = 0;
const ctx = vm.createContext({ localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
  document: { querySelectorAll: q => q === '.curve-sel' ? [select] : [tension] },
  linksEl: {}, drawLinks: () => draws++, commit: () => commits++, console });
vm.runInContext(code + '\nthis.api = {angledVerts, polylinePath, samplePolyline, bezier, linkD, linkSamples, zipD, zipSamples, setWireCurve};', ctx);
const a = ctx.api; let count = 0;
function test(name, fn) { fn(); console.log(' ✓ ' + name); count++; }
const plain = x => JSON.parse(JSON.stringify(x));
test('dropdown possui cinco opções na ordem', () => {
  const sel = extract('<select class="bm-sel curve-sel"', '</select>');
  assert.deepEqual([...sel.matchAll(/<option value="([^"]+)"/g)].map(x=>x[1]), ['bezier','straight','ortho','noodle','angled_orthogonal']);
});
test('preferência de usuário, atualização visual e commit', () => {
  a.setWireCurve('angled_orthogonal');
  assert.equal(JSON.parse(storage.get('ee_wire_curve')).mode, 'angled_orthogonal');
  assert.equal(select.value, 'angled_orthogonal'); assert.equal(tension.disabled, true);
  assert.equal(draws, 1); assert.equal(commits, 1);
});
test('trajeto normal tem três segmentos, 45 graus e saídas horizontais', () => {
  const v = plain(a.angledVerts({x:0,y:0},{x:200,y:60}));
  assert.deepEqual(v,[{x:0,y:0},{x:70,y:0},{x:130,y:60},{x:200,y:60}]);
  assert.equal(a.bezier(v[0],v[3]), a.polylinePath(v));
});
test('reta horizontal mesmo quando reversa', () => {
  assert.deepEqual(plain(a.angledVerts({x:20,y:1},{x:-20,y:1})), [{x:20,y:1},{x:-20,y:1}]);
});
test('distância curta não retrocede e mantém dois leads', () => {
  const v = a.angledVerts({x:0,y:0},{x:10,y:100});
  assert(v.every((p,i) => !i || p.x >= v[i-1].x));
  assert(v[1].x > 0 && v[2].x < 10); assert.equal(v[2].x-v[1].x,6);
});
test('reverso contorna por fora e entra horizontalmente', () => {
  const v = a.angledVerts({x:100,y:10},{x:0,y:80});
  assert(v[1].x > 100 && v.at(-2).x < 0);
  assert.equal(v[0].y,v[1].y); assert.equal(v.at(-2).y,v.at(-1).y);
  assert(v[2].y < 10); assert(v.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});
test('fio normal e amostras seguem a mesma polilinha', () => {
  const S={x:0,y:0}, T={x:200,y:60};
  assert.equal(a.linkD({},S,T), a.polylinePath(a.angledVerts(S,T)));
  const samples = a.linkSamples({},S,T); const v=a.angledVerts(S,T);
  for (const p of samples) assert(v.slice(1).some((b,i) => {
    const x=b.x-v[i].x,y=b.y-v[i].y; return Math.abs((p.x-v[i].x)*y-(p.y-v[i].y)*x)<1e-7 && p.x>=Math.min(v[i].x,b.x)-1e-7 && p.x<=Math.max(v[i].x,b.x)+1e-7;
  }));
});
test('zip tie atravessa âncora e amostras batem com SVG', () => {
  const S={x:0,y:0}, A={x:100,y:30}, T={x:200,y:80};
  const v=a.angledVerts(S,A).concat(a.angledVerts(A,T).slice(1));
  assert.equal(a.zipD(S,A,T),a.polylinePath(v));
  assert(a.zipSamples(S,A,T).some(p => p.x===A.x && p.y===A.y));
});
test('pivôs mantêm rota anterior e hitbox compartilha d', () => {
  assert(a.linkD({pts:[{x:50,y:50}]},{x:0,y:0},{x:100,y:100}).includes(' Q'));
  assert(html.includes("el.hit.setAttribute('d', d)")); assert(html.includes("el.vis.setAttribute('d', d)"));
});
test('projetos gravam preferência e antigos preservam configuração atual', () => {
  assert(html.includes('wireCurve: { ...WIRE_CURVE }'));
  assert(html.includes('if (data.wireCurve && WIRE_MODES.includes(data.wireCurve.mode))'));
  assert(html.includes('localStorage.setItem(WIRE_CURVE_KEY, JSON.stringify(WIRE_CURVE))'));
});
console.log(`\n${count} passaram, 0 falharam`);
