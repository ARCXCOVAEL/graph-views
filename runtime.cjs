// SPDX-License-Identifier: MPL-2.0
// Instance-local adapters around the actual native graph renderer and worker.
// Native graph data stays authoritative. No adapter/cache/file hooks are used.
'use strict';
const M = require('./projection.cjs'),
  C = require('./config.cjs');
function capabilities(view) {
  const r = view?.renderer,
    e = view?.dataEngine;
  if (
    view?.getViewType?.() !== 'graph' ||
    !r ||
    !e ||
    typeof r.setData !== 'function' ||
    typeof r.onNodeClick !== 'function' ||
    typeof r.worker?.postMessage !== 'function' ||
    !Array.isArray(r.nodes) ||
    typeof e.getOptions !== 'function' ||
    typeof e.setOptions !== 'function' ||
    typeof e.updateSearch !== 'function' ||
    typeof e.render !== 'function'
  )
    throw Error('Native graph integration unavailable; graph left unchanged');
  return { r, e };
}
// Restore only an owned descriptor, preserving another plugin's later hook.
function hook(obj, key, make, cleanup) {
  const d = Object.getOwnPropertyDescriptor(obj, key),
    original = obj[key],
    fn = make(original);
  obj[key] = fn;
  cleanup.push(() => {
    if (obj[key] === fn) {
      if (d) Object.defineProperty(obj, key, d);
      else delete obj[key];
    }
  });
  return original;
}
// Wrap only the registered native global-graph creator, before its onload runs.
// A failed guard must not return an unprotected newly created view.
function guardCreation(registry, prepare, report, cleanup) {
  const types = registry?.viewByType;
  if (!types || typeof types !== 'object') throw Error('Native graph creator unavailable');
  if (typeof types.graph !== 'function') return null;
  hook(types, 'graph', (original) => function (...args) {
    const view = original.apply(this, args);
    const owned = view?.leaf === args[0] && args[0]?.view !== view;
    try {
      prepare(view);
      return view;
    } catch (error) {
      if (owned) {
        try { view.renderer?.destroy(); } catch (cleanupError) {
          try { report(cleanupError); } catch {}
        }
      }
      try { report(error); } catch {}
      throw error;
    }
  }, cleanup);
  return types.graph;
}
class NativeGraph {
  constructor(plugin, view, beforeLoad = false) {
    this.plugin = plugin;
    this.view = view;
    this.app = plugin.app;
    Object.assign(this, capabilities(view));
    this.cleanup = [];
    this.selected = new Set();
    this.trace = null;
    this.active = true;
    this.hasDisplay = false;
    this.signature = null;
    this.initialOptions = C.options(this.e.getOptions());
    this.beforeLoad = beforeLoad;
    this.searchPending = beforeLoad;
    this.setting = beforeLoad;
    this.pinMessages = 0;
    this.error = null;
    try {
      if (beforeLoad) {
        if (typeof this.e.setQuery !== 'function' || typeof view.onClose !== 'function')
          throw Error('Native first-render search integration unavailable');
        this.cleanup.push(() => this.releaseStartupQueue());
        const self = this;
        const closed = () => {
          self.dispose();
          if (self.plugin.controllers?.get(view) === self) self.plugin.controllers.delete(view);
        };
        hook(view, 'onClose', (original) => function (...args) {
          let result;
          try { result = original.apply(this, args); } catch (error) { closed(); throw error; }
          if (result && typeof result.finally === 'function') return result.finally(closed);
          closed();
          return result;
        }, this.cleanup);
        // Native setOptions can render before its first query is compiled. Wait
        // for that existing query pipeline, without constructing unfiltered data.
        this.originalEngineRender = hook(this.e, 'render', (original) => {
          const self = this;
          return function (...args) {
            if (!self.active) return 0;
            if (self.searchPending) {
              const q = self.startupQueue;
              if (!self.queryPrepared || (q && (self.queryCancelled || this.queue !== q ||
                q.runnable.isCancelled() || q.runnable.isRunning() || q.items.length !== 0))) return 0;
              self.searchPending = false;
              self.releaseStartupQueue();
            }
            return original.apply(this, args);
          };
        }, this.cleanup);
        hook(this.e, 'setQuery', (original) => {
          const self = this;
          return function (...args) {
            if (!self.active) return;
            if (!self.searchPending) return original.apply(this, args);
            self.queryPrepared = false;
            self.queryCancelled = false;
            self.releaseStartupQueue();
            try {
              const result = original.apply(this, args), q = this.queue;
              if (q) {
                if (typeof q.cancel !== 'function' || typeof q.runnable?.isRunning !== 'function' ||
                  typeof q.runnable?.isCancelled !== 'function' || !Number.isInteger(q.items?.length))
                  throw Error('Native startup query completion unavailable');
                self.startupQueue = q;
                const cancelCleanup = [];
                hook(q, 'cancel', (cancel) => function (...rest) {
                  if (self.searchPending && self.startupQueue === q) self.queryCancelled = true;
                  return cancel.apply(this, rest);
                }, cancelCleanup);
                self.startupCancel = cancelCleanup[0];
              }
              self.queryPrepared = true;
              // An asynchronous queue remains closed through progress callbacks;
              // only its normal stopped, empty, uncancelled state can admit data.
              self.e.render();
              return result;
            } catch (error) {
              self.queryPrepared = false;
              self.releaseStartupQueue();
              self.reject(error);
              throw error;
            }
          };
        }, this.cleanup);
      }
      this.originalSetData = hook(
        this.r,
        'setData',
        (original) => {
          const self = this;
          return function (data) {
            // A callback retained by the host must not submit data after unload.
            if (!self.active) return;
            try {
              return self.render(data);
            } catch (e) {
              self.reject(e);
            }
          };
        },
        this.cleanup,
      );
      hook(
        this.r,
        'onNodeClick',
        (original) => {
          const self = this;
          return function (event, id, type) {
            if (self.active && event?.shiftKey) {
              event.preventDefault?.();
              event.stopPropagation?.();
              self.choose(id);
              return;
            }
            return original.call(this, event, id, type);
          };
        },
        this.cleanup,
      );
      hook(
        this.r.worker,
        'postMessage',
        (original) => {
          const self = this;
          return function (message, ...rest) {
            if (self.active && message?.forceNode) {
              const f = message.forceNode,
                p = self.plugin.cfg.pins[f.id];
              if (p) {
                if (Number.isFinite(f.x) && Number.isFinite(f.y)) {
                  p.x = f.x;
                  p.y = f.y;
                } else if (f.x === null && f.y === null) {
                  message = { ...message, forceNode: { id: f.id, x: p.x, y: p.y } };
                  const n = self.r.nodeLookup[f.id];
                  if (n) {
                    n.fx = p.x;
                    n.fy = p.y;
                  }
                  self.plugin.saveSoon();
                }
              }
            }
            return original.call(this, message, ...rest);
          };
        },
        this.cleanup,
      );
      // Native settings still work. Changes belong to the currently selected mode.
      this.originalOptionsChange = hook(
        this.e,
        'onOptionsChange',
        (original) => {
          const self = this;
          return function (...args) {
            if (self.active && !self.setting)
              try {
                self.plugin.cfg.presets[self.plugin.cfg.mode] = C.options(self.e.getOptions());
                self.plugin.saveSoon();
              } catch (e) {
                self.fail(e);
              }
            return original.apply(this, args);
          };
        },
        this.cleanup,
      );
    } catch (e) {
      this.active = false;
      for (const close of this.cleanup.reverse())
        try {
          close();
        } catch (cleanupError) {
          this.plugin.report(cleanupError);
        }
      throw e;
    }
  }
  // Only the current pending native queue needs cancellation tracking.
  releaseStartupQueue() {
    const close = this.startupCancel;
    this.startupCancel = null;
    this.startupQueue = null;
    close?.();
  }
  roots() {
    const s = this.plugin.cfg;
    return s.mode === 'structure' ? s.structureRoots : s.focusRoots;
  }
  // Every native update is indexed before projection. A rejected update never
  // reaches the renderer, even after an earlier failure or in Overview.
  render(data) {
    if (!this.active || (!arguments.length && !this.g)) return;
    try {
      // Native objects can be mutated in place between updates and control actions.
      this.g = M.index(arguments.length ? data : this.g.data);
      const cfg = this.plugin.cfg,
        p = M.project(this.g, {
          mode: cfg.mode,
          roots: this.roots(),
          depth: cfg.depth,
          folded: new Set(cfg.folded),
          selected: this.selected,
          trace: this.trace,
        });
      if (p.signature !== this.signature) {
        // A throwing renderer may have partially replaced its previous display.
        this.hasDisplay = false;
        this.signature = null;
        this.originalSetData.call(this.r, p.data);
        this.hasDisplay = true;
        this.signature = p.signature;
        this.applyPins();
      }
      this.stats = p;
      this.error = null;
      this.plugin.paint(this);
    } catch (e) {
      this.reject(e);
    }
  }
  // Keep the renderer's last safe display, without retaining a second data copy.
  // Drop the old index so controls cannot reproject stale/mutated rejected input.
  // Until a display is confirmed, only an empty graph may reach the renderer.
  reject(e) {
    this.g = null;
    this.stats = null;
    let display = 'Last safe display kept.';
    if (!this.hasDisplay) {
      this.signature = null;
      try {
        this.originalSetData.call(this.r, { nodes: {}, numLinks: 0 });
        this.hasDisplay = true;
        display = 'Empty display shown.';
      } catch {
        display = 'Native renderer could not confirm an empty display.';
      }
    }
    this.error =
      'Graph update blocked: ' + (e?.message || String(e)) + '. ' + display +
      ' Reduce the native graph using Edit view / Search query or exclusions, then Apply view.' +
      ' Limits are 100,000 nodes and 500,000 links before depth or folding.';
    // Presentation failure must never re-enable raw-data forwarding.
    try {
      this.plugin.paint(this);
    } catch (error) {
      try {
        this.plugin.report(error);
      } catch {
        // The guard remains closed even when the host cannot display an error.
      }
    }
  }
  fail(e) {
    this.error = e.message;
    this.plugin.report(e);
    this.plugin.paint(this);
  }
  // Mode switches batch native options through its existing setter; original
  // links/metadata are never rewritten. Missing roots remain a visible state.
  mode(mode) {
    this.trace = null;
    this.selected.clear();
    this.plugin.cfg.mode = mode;
    if (mode === 'focused' && this.plugin.cfg.followActive) {
      const f = this.app.workspace.getActiveFile();
      if (f) this.plugin.cfg.focusRoots = [f.path];
    }
    this.applyOptions(this.plugin.cfg.presets[mode]);
    this.plugin.saveSoon();
  }
  applyOptions(options) {
    this.setting = true;
    try {
      this.e.setOptions(C.options(options));
      this.e.updateSearch();
    } finally {
      this.setting = false;
    }
    this.render();
  }
  choose(id) {
    if (!this.g?.out.has(id)) return;
    if (!this.selected.has(id) && this.selected.size >= 500)
      throw Error('Selection limit is 500 nodes');
    this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
    this.trace = null;
    this.render();
  }
  focusSelection(structure = false) {
    if (!this.selected.size) throw Error('Shift-click nodes or choose a note first');
    const key = structure ? 'structureRoots' : 'focusRoots';
    this.plugin.cfg[key] = [...this.selected];
    this.plugin.cfg.followActive = false;
    this.plugin.changeMode(structure ? 'structure' : 'focused');
  }
  // Stop traversal at a folded node. Shared nodes stay if another route reaches
  // them; every remaining cross-link stays the original native link.
  fold(clear = false) {
    if (this.plugin.cfg.mode !== 'structure') throw Error('Folding is available in Structure view');
    const set = new Set(this.plugin.cfg.folded);
    if (clear) set.clear();
    else {
      if (!this.selected.size) throw Error('Select a branch node first');
      for (const id of this.selected) set.has(id) ? set.delete(id) : set.add(id);
    }
    this.plugin.cfg.folded = [...set];
    this.trace = null;
    this.plugin.saveSoon();
    this.plugin.renderAll();
  }
  traceSelected() {
    // A blocked update has no admitted index; keep its actionable status intact.
    if (!this.g) return;
    if (this.selected.size !== 2)
      throw Error('Select two nodes to trace their existing connections');
    const [a, b] = this.selected,
      p = M.shortest(this.g, a, b);
    if (!p) throw Error('No connection exists in the admitted native graph');
    this.trace = p;
    this.render();
  }
  // Use the native worker's own forceNode protocol, also used by native dragging.
  applyPins() {
    for (const [id, p] of Object.entries(this.plugin.cfg.pins)) {
      const n = this.r.nodeLookup[id];
      if (n) {
        n.fx = p.x;
        n.fy = p.y;
        this.r.worker.postMessage({ forceNode: { id, x: p.x, y: p.y }, alpha: 0.3, run: true });
        this.pinMessages++;
      }
    }
  }
  pin(release = false) {
    if (!this.selected.size) throw Error('Select nodes first');
    for (const id of this.selected) {
      const n = this.r.nodeLookup[id];
      if (!n) continue;
      if (
        !release &&
        !Object.hasOwn(this.plugin.cfg.pins, id) &&
        Object.keys(this.plugin.cfg.pins).length >= 500
      )
        throw Error('Pin limit is 500 nodes');
      if (release) {
        delete this.plugin.cfg.pins[id];
        n.fx = null;
        n.fy = null;
        this.r.worker.postMessage({ forceNode: { id, x: null, y: null }, alpha: 0.3, run: true });
      } else this.plugin.cfg.pins[id] = { x: n.x, y: n.y };
    }
    this.applyPins();
    this.plugin.saveSoon();
    this.plugin.paint(this);
  }
  // Unload keeps the safe display and restores owned callbacks. Do not request
  // a full engine refresh: its delayed callbacks could run after guard removal.
  // Each cleanup is independent so a worker/UI failure cannot strand other hooks.
  dispose() {
    if (!this.active) return;
    this.active = false;
    const report = (error) => {
      try {
        this.plugin.report(error);
      } catch {
        // Continue releasing all other owned resources if reporting also fails.
      }
    };
    for (const id of Object.keys(this.plugin.cfg.pins)) {
      try {
        const n = this.r.nodeLookup[id];
        if (n) {
          n.fx = null;
          n.fy = null;
          this.r.worker.postMessage({ forceNode: { id, x: null, y: null }, alpha: 0.3, run: true });
        }
      } catch (error) {
        report(error);
      }
    }
    for (const close of this.cleanup.reverse()) {
      try {
        close();
      } catch (error) {
        report(error);
      }
    }
    try {
      this.bar?.remove();
    } catch (error) {
      report(error);
    }
    this.g = null;
    this.stats = null;
    this.signature = null;
    this.selected.clear();
    this.trace = null;
  }
}
module.exports = { capabilities, hook, guardCreation, NativeGraph };
