import fs from 'node:fs';
import vm from 'node:vm';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const TEXT_BASE_FONTS');
const mid = html.indexOf('function textLineSpecs', start);
const listStart = html.indexOf('async function textListLocalFonts()');
const listEnd = html.indexOf('function makeFont', listStart);
ok(start > 0 && mid > start && listStart > 0 && listEnd > listStart, 'text font loader code is present');
ok(/LOCAL_FONT_DATA\.set\(face\.family/.test(html), 'installed FontData objects are retained, not only their names');
ok(/face\.blob\(\)/.test(html) && /document\.fonts\.add/.test(html), 'selected installed faces are registered in document.fonts');
ok(/textEnsureFont\(n\);\s*\n\s*for \(const m of nodes\.values\(\)\)/.test(html), 'listing fonts registers the currently selected family');

const created = [], added = [], dirty = [];
let queryCalls = 0, renders = 0;
class MockFontFace {
  constructor(family, source, descriptors = {}) { this.family = family; this.source = source; this.descriptors = descriptors; created.push(this); }
  async load() { return this; }
}
const face = (style, postscriptName) => ({
  family: 'Acme Display', style, postscriptName, fullName: `Acme Display ${style}`,
  blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }),
});
const node = { id: 7, type: 'text', params: { font: 'Acme Display', fontFile: '' } };
const ctx = vm.createContext({
  FontFace: MockFontFace,
  document: { fonts: { add: f => added.push(f) } },
  window: { queryLocalFonts: async () => { queryCalls++; return [face('Regular', 'Acme-Regular'), face('Bold Italic', 'Acme-BoldItalic')]; } },
  nodes: new Map([[7, node]]),
  markDirty: id => dirty.push(id),
  requestRender: () => renders++,
  setStatus: () => {},
});
vm.runInContext(html.slice(start, mid) + '\n' + html.slice(listStart, listEnd) + ';this.list=textListLocalFonts;this.ensure=textEnsureFont;this.css=textFamilyCss;', ctx);

ok(ctx.css('Acme Display') === '"Acme Display", sans-serif', 'installed family names are quoted in Canvas font CSS');
ok(await ctx.list() === 1 && queryCalls === 1, 'local font enumeration returns the installed family');
ctx.ensure(node);
await new Promise(r => setTimeout(r, 10));
ok(created.length === 2, 'all faces of the selected installed family are loaded', created.length);
ok(created.some(f => f.family === 'Acme Display' && f.descriptors.weight === '700' && f.descriptors.style === 'italic'), 'bold italic face keeps its descriptors');
ok(added.length === 2 && dirty.includes(7) && renders > 0, 'text node redraws after the installed font is ready');
ctx.ensure(node);
await new Promise(r => setTimeout(r, 10));
ok(created.length === 2, 'an installed family is not registered twice');

const uploaded = { id: 8, type: 'text', params: { font: 'EE-Test', fontFile: 'data:font/ttf;base64,AAAA' } };
ctx.ensure(uploaded);
await new Promise(r => setTimeout(r, 10));
ok(created.some(f => f.family === 'EE-Test' && String(f.source).startsWith('url(data:font/ttf')), 'uploaded font files still register as before');

process.exit(resumo() ? 0 : 1);
