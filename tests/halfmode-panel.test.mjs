import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function halfModeAplicaVis('),end=html.indexOf('// ===== v6: Dither Labs',start);
assert(start>=0 && end>start);
class Element {
  constructor(tag,cls='',text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.dataset={};this.style={};this.attrs={};this.listeners={};this.parentElement=null;this.open=false;}
  append(...els){for(const e of els){if(e.parentElement){const a=e.parentElement.children;a.splice(a.indexOf(e),1);}this.children.push(e);e.parentElement=this;}}
  insertBefore(el,ref){if(el.parentElement){const a=el.parentElement.children;a.splice(a.indexOf(el),1);}this.children.splice(this.children.indexOf(ref),0,el);el.parentElement=this;}
  replaceChildren(...els){for(const e of this.children)e.parentElement=null;this.children=[];this.append(...els);}
  setAttribute(k,v){this.attrs[k]=String(v);}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  fire(k){for(const fn of this.listeners[k]||[])fn({key:'Enter',preventDefault(){},stopPropagation(){}});}
  closest(){return {style:{}};}
  all(){return this.children.flatMap(e=>[e,...e.all()]);}
  querySelectorAll(sel){return this.all().filter(e=>sel==='input' ? e.tag==='input' : sel==='path' ? e.tag==='path' : false);}
  querySelector(sel){const match=/^\.hm-ink-settings\[data-ink="(\d)"\]$/.exec(sel);return this.all().find(e=>match ? e.className==='hm-ink-settings'&&e.dataset.ink==match[1] : e.tag===sel) || null;}
}
const E=(tag,cls,text)=>new Element(tag,cls,text),body=E('div');
const groups={
  Presets:['theme','wadaCombo'],Screen:['quality','useOriginal','pattern','scale','distress','contrast','brightness','softness'],
  'Paper and Ink':['background','tintMode','opaqueBottom','inkMultiply','inkFade','dust','plateDrift','angleSpread','rotate','autoSort','alphaMode'],
  'Levels and Curves':['inBlack','inWhite','gamma','curveSh','curveMid','curveHi']
};
const keys=[...Object.values(groups).flat(),...[1,2,3,4].flatMap(i=>['useInk','ink','pat','angle','opacity','fade','offX','offY'].map(x=>x+i)),'futureSetting'];
const refs={};for(const key of keys){const row=E('div');row.dataset.pkey=key;if(key.startsWith('useInk'))row.append(E('select'));else if(/^ink[1-4]$/.test(key))row.append(E('input'),E('input'));body.append(row);refs[key]=row;}
const params={useInk1:'yes',useInk2:'no',useInk3:'yes',useInk4:'no',ink1:'#ff0000',ink2:'#eeeeee',ink3:'#0000ff',ink4:'#aaaaaa'};
const n={params,ui:{},el:{isConnected:false}};for(const key of keys)n.ui[key]=()=>{};
const ctx=vm.createContext({document:{createElement:tag=>E(tag),createElementNS:(_,tag)=>E(tag)},E,SVGNS:'svg',Math,panelVerticalLargura:()=>{},drawLinks:()=>{}});
vm.runInContext(html.slice(start,end)+'\nthis.build=halfModePanelVertical;',ctx);ctx.build(n,body);
const all=body.all();for(const key of keys)assert.equal(all.filter(e=>e.dataset.pkey===key).length,1,key);
for(const [name,groupKeys] of Object.entries(groups)){const group=all.find(e=>e.className==='hm-group'&&e.children[0]?.textContent===name);assert(group&&!group.open,name);for(const key of groupKeys)assert.equal(refs[key].parentElement,group,key);}
assert.equal(refs.futureSetting.parentElement.children[0].textContent,'More');
const palette=all.find(e=>e.className==='hm-palette'),svg=palette.children.find(e=>e.tag==='svg');
assert.deepEqual(svg.children.map(e=>e.attrs['aria-label']),['Select Ink 1 color','Select Ink 3 color']);
assert.equal(refs.ink1.style.display,'');assert.equal(refs.ink3.style.display,'none');
svg.children[1].fire('click');assert.equal(refs.ink1.style.display,'none');assert.equal(refs.ink3.style.display,'');
params.ink3='#123456';refs.ink3.children[0].fire('input');assert.equal(svg.children[1].attrs.fill,'#123456');
params.useInk3='no';refs.useInk3.children[0].fire('change');assert.equal(svg.children.length,1);assert.equal(refs.ink3.style.display,'none');assert.equal(body.querySelector('.hm-ink-settings[data-ink="3"]').style.display,'none');
params.useInk1='no';n.ui.useInk1();assert.equal(svg.children.length,0);assert.equal(refs.ink1.style.display,'none');
params.useInk2='yes';params.ink2='#abcdef';n.ui.useInk2();n.ui.ink2();assert.equal(svg.children.length,1);assert.equal(svg.children[0].attrs.fill,'#abcdef');assert.equal(refs.ink2.style.display,'');
console.log('HalfMode: collapsed groups, original controls and active-only ink palette OK');
