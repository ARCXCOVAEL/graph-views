// SPDX-License-Identifier: MPL-2.0
// Instance-local adapters around the actual native graph renderer and worker.
// Native graph data stays authoritative. No adapter/cache/file hooks are used.
'use strict';
const M=require('./projection.cjs'),C=require('./config.cjs');
function capabilities(view){const r=view?.renderer,e=view?.dataEngine;if(view?.getViewType?.()!=='graph'||!r||!e||typeof r.setData!=='function'||typeof r.onNodeClick!=='function'||typeof r.worker?.postMessage!=='function'||!Array.isArray(r.nodes)||typeof e.getOptions!=='function'||typeof e.setOptions!=='function'||typeof e.updateSearch!=='function'||typeof e.render!=='function')throw Error('Native graph integration unavailable; graph left unchanged');return {r,e};}
// Restore only an owned descriptor, preserving another plugin's later hook.
function hook(obj,key,make,cleanup){const d=Object.getOwnPropertyDescriptor(obj,key),original=obj[key],fn=make(original);obj[key]=fn;cleanup.push(()=>{if(obj[key]===fn){if(d)Object.defineProperty(obj,key,d);else delete obj[key];}});return original;}
class NativeGraph{
 constructor(plugin,view){this.plugin=plugin;this.view=view;this.app=plugin.app;Object.assign(this,capabilities(view));this.cleanup=[];this.selected=new Set();this.trace=null;this.active=true;this.bypassed=false;this.signature=null;this.initialOptions=C.options(this.e.getOptions());this.setting=false;this.pinMessages=0;this.error=null;try{this.originalSetData=hook(this.r,'setData',original=>{const self=this;return function(data){if(!self.active||self.bypassed)return original.call(this,data);try{self.g=M.index(data);return self.render();}catch(e){self.bypassed=true;self.signature=null;self.fail(e);return original.call(this,data);}};},this.cleanup);
 hook(this.r,'onNodeClick',original=>{const self=this;return function(event,id,type){if(self.active&&event?.shiftKey){event.preventDefault?.();event.stopPropagation?.();self.choose(id);return;}return original.call(this,event,id,type);};},this.cleanup);
 hook(this.r.worker,'postMessage',original=>{const self=this;return function(message,...rest){if(self.active&&message?.forceNode){const f=message.forceNode,p=self.plugin.cfg.pins[f.id];if(p){if(Number.isFinite(f.x)&&Number.isFinite(f.y)){p.x=f.x;p.y=f.y;}else if(f.x===null&&f.y===null){message={...message,forceNode:{id:f.id,x:p.x,y:p.y}};const n=self.r.nodeLookup[f.id];if(n){n.fx=p.x;n.fy=p.y;}self.plugin.saveSoon();}}}return original.call(this,message,...rest);};},this.cleanup);
 // Native settings still work. Changes belong to the currently selected mode.
 this.originalOptionsChange=hook(this.e,'onOptionsChange',original=>{const self=this;return function(...args){if(self.active&&!self.setting)try{self.plugin.cfg.presets[self.plugin.cfg.mode]=C.options(self.e.getOptions());self.plugin.saveSoon();}catch(e){self.fail(e);}return original.apply(this,args);};},this.cleanup);
 }catch(e){this.active=false;for(const close of this.cleanup.reverse())try{close();}catch(cleanupError){this.plugin.report(cleanupError);}throw e;}
 }
 roots(){const s=this.plugin.cfg;return s.mode==='structure'?s.structureRoots:s.focusRoots;}
 // Projection skips identical native setData calls; no perpetual animation loop.
 render(){if(!this.active||this.bypassed||!this.g)return;const cfg=this.plugin.cfg,p=M.project(this.g,{mode:cfg.mode,roots:this.roots(),depth:cfg.depth,folded:new Set(cfg.folded),selected:this.selected,trace:this.trace});if(p.signature!==this.signature){this.originalSetData.call(this.r,p.data);this.signature=p.signature;this.applyPins();}this.stats=p;this.plugin.paint(this);}
 fail(e){this.error=e.message;this.plugin.report(e);this.plugin.paint(this);}
 // Mode switches batch native options through its existing setter; original
 // links/metadata are never rewritten. Missing roots remain a visible state.
 mode(mode){this.trace=null;this.selected.clear();this.plugin.cfg.mode=mode;if(mode==='focused'&&this.plugin.cfg.followActive){const f=this.app.workspace.getActiveFile();if(f)this.plugin.cfg.focusRoots=[f.path];}this.applyOptions(this.plugin.cfg.presets[mode]);this.plugin.saveSoon();}
 applyOptions(options){this.setting=true;try{this.e.setOptions(C.options(options));this.e.updateSearch();}finally{this.setting=false;}this.render();}
 choose(id){if(!this.g?.out.has(id))return;if(!this.selected.has(id)&&this.selected.size>=500)throw Error('Selection limit is 500 nodes');this.selected.has(id)?this.selected.delete(id):this.selected.add(id);this.trace=null;this.render();}
 focusSelection(structure=false){if(!this.selected.size)throw Error('Shift-click nodes or choose a note first');const key=structure?'structureRoots':'focusRoots';this.plugin.cfg[key]=[...this.selected];this.plugin.cfg.followActive=false;this.plugin.changeMode(structure?'structure':'focused');}
 // Stop traversal at a folded node. Shared nodes stay if another route reaches
 // them; every remaining cross-link stays the original native link.
 fold(clear=false){if(this.plugin.cfg.mode!=='structure')throw Error('Folding is available in Structure view');const set=new Set(this.plugin.cfg.folded);if(clear)set.clear();else{if(!this.selected.size)throw Error('Select a branch node first');for(const id of this.selected)set.has(id)?set.delete(id):set.add(id);}this.plugin.cfg.folded=[...set];this.trace=null;this.plugin.saveSoon();this.plugin.renderAll();}
 traceSelected(){if(this.selected.size!==2)throw Error('Select two nodes to trace their existing connections');const [a,b]=this.selected,p=M.shortest(this.g,a,b);if(!p)throw Error('No connection exists in the admitted native graph');this.trace=p;this.render();}
 // Use the native worker's own forceNode protocol, also used by native dragging.
 applyPins(){for(const [id,p]of Object.entries(this.plugin.cfg.pins)){const n=this.r.nodeLookup[id];if(n){n.fx=p.x;n.fy=p.y;this.r.worker.postMessage({forceNode:{id,x:p.x,y:p.y},alpha:.3,run:true});this.pinMessages++;}}}
 pin(release=false){if(!this.selected.size)throw Error('Select nodes first');for(const id of this.selected){const n=this.r.nodeLookup[id];if(!n)continue;if(!release&&!Object.hasOwn(this.plugin.cfg.pins,id)&&Object.keys(this.plugin.cfg.pins).length>=500)throw Error("Pin limit is 500 nodes");if(release){delete this.plugin.cfg.pins[id];n.fx=null;n.fy=null;this.r.worker.postMessage({forceNode:{id,x:null,y:null},alpha:.3,run:true});}else this.plugin.cfg.pins[id]={x:n.x,y:n.y};}this.applyPins();this.plugin.saveSoon();this.plugin.paint(this);}
 // On unload release only owned pins, restore owned hooks, then hand the full
 // native graph back to its own engine with the latest Overview preferences.
 dispose(){if(!this.active)return;this.active=false;for(const id of Object.keys(this.plugin.cfg.pins)){const n=this.r.nodeLookup[id];if(n){n.fx=null;n.fy=null;this.r.worker.postMessage({forceNode:{id,x:null,y:null},alpha:.3,run:true});}}for(const close of this.cleanup.reverse())close();if(this.view?._loaded)try{this.e.setOptions(this.plugin.cfg.presets.overview||this.initialOptions);this.e.updateSearch();this.e.render();}catch(e){this.plugin.report(e);}this.bar?.remove();}
}
module.exports={capabilities,hook,NativeGraph};
