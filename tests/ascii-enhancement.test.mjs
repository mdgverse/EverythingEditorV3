import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const begin = html.indexOf('function fx7AsciiEnhanced('), end = html.indexOf('// ========== ASCII ENHANCEMENT END ==========', begin);
assert(begin > 0 && end > begin);
const render = html.slice(begin, end);
const contexts = [];
function canvas(w,h) { const calls=[]; const c={width:w,height:h,calls}; const ctx={fillText:(...a)=>calls.push(['text',ctx.fillStyle,...a]),fillRect:(...a)=>calls.push(['rect',...a]),drawImage:(...a)=>calls.push(['image',...a]),putImageData:()=>{},save:()=>{},restore:()=>{}};c.getContext=()=>ctx;contexts.push(c);return c; }
const context=vm.createContext({Math,Number,Uint8ClampedArray,ImageData:class {constructor(data,w,h){this.data=data;this.width=w;this.height=h}},FX6_ASCII_SETS:{classic:' .#'},fx7NewCanvas:canvas,fx5Luma255:(r,g,b)=>.2126*r+.7152*g+.0722*b,fx6Hash:(x,y)=>((x*11+y*17)>>>0)%100/100,TL:{frame:1}});
vm.runInContext(render+'; this.render=fx7AsciiEnhanced;',context);
const src=new Uint8ClampedArray(16*8*4);for(let y=0;y<8;y++)for(let x=0;x<16;x++){let i=(y*16+x)*4;src[i]=src[i+1]=src[i+2]=x<8?10:240;src[i+3]=255;}
const base={asciiMode:'luma',cell:8,asciiCustom:' .#',asciiColor:'gradient',asciiBands:'stepped'};
const first=context.render(src,16,8,base);const cells=first.calls.filter(x=>x[0]==='text');assert.equal(cells.length,2);assert.notEqual(cells[0][1],cells[1][1]);assert.notEqual(cells[0][2],cells[1][2]);
const edge=context.render(src,16,8,{...base,asciiMode:'edge'});assert.equal(edge.calls.filter(x=>x[0]==='text').length,2);
const mixed=context.render(src,16,8,{...base,asciiMix:0});assert(mixed.calls.some(x=>x[0]==='image'));
assert.match(html,/if \(p\.asciiMode && p\.asciiMode !== 'legacy'\) return fx7AsciiEnhanced/);
assert.match(html,/frameChanged && n\.type === 'ascii'/);
assert.match(html,/SHADERS\.asciiFast\s*=/);
assert.match(html,/const gpu = fx7AsciiGpu\(a, n\.params\)/);
assert.match(html,/asciiAtlasCache\) gl\.deleteTexture\(asciiAtlasCache\.tex\)/);
assert.match(html,/p\.asciiBands === 'overlap'.*return null/);
const ps=html.slice(html.indexOf('function asciiApplyPreset('),html.indexOf('function asciiPanel('));
const pc=vm.createContext({});vm.runInContext(ps+'; this.apply=asciiApplyPreset;',pc);const n={params:{},ui:{}};
pc.apply(n,'tonal');assert.equal(n.params.asciiBands,'overlap');assert.equal(n.params.asciiColor,'gradient');
pc.apply(n,'circuit');assert.equal(n.params.asciiMode,'edge');assert.equal(n.params.asciiFill,15);
pc.apply(n,'retro');assert.equal(n.params.asciiScan,55);assert.equal(n.params.asciiColor,'mono');
assert.match(html,/group\('Characters and grid'/);assert.match(html,/group\('Enhanced colors'/);assert.match(html,/group\('Retro effects and mix'/);

for(const file of ['frames/corner-marks','frames/technical-frame','frames/square-tile','grids/cell-grid','grids/dot-grid','decorations/tonal-bars','decorations/pixel-cross','decorations/pixel-diagonal','frames/dotted-corners','frames/parallel-header','icons/angle-brackets','icons/diagonal-hatch','patterns/checker','patterns/halftone-dots','patterns/cross-grid','patterns/ascii-lines','glyphs/at-pixel','glyphs/period-pixel','glyphs/horizontal','glyphs/vertical','glyphs/asterisk','glyphs/hash','glyphs/slash','decorations/tonal-vertical','decorations/pixel-tonal-cell']){const svg=fs.readFileSync(new URL(`../assets/ascii-shapes/${file}.svg`,import.meta.url),'utf8');assert.match(svg,/<svg\s/);assert.match(svg,/viewBox=/);assert.match(html,new RegExp(file));}
console.log('ASCII optional renderer, tonal mapping, edge mode, mix, animation invalidation and bundled SVGs OK');
