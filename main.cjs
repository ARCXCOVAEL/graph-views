// SPDX-License-Identifier: MPL-2.0
// Standalone plugin for native Graph view. No custom ItemView or note writes.
'use strict';
const { Plugin, Notice, apiVersion } = require('obsidian'),
  path = require('node:path'),
  C = require('./config.cjs'),
  { SettingsStore } = require('./storage.cjs'),
  { NativeGraph, capabilities, guardCreation } = require('./runtime.cjs'),
  UI = require('./ui.cjs');
module.exports = class GraphViews extends Plugin {
  // Own settings and event-scoped controllers only; do not touch indexing hooks.
  // Load validated preferences and attach controllers only to supported native graph
  // instances. Commands and events schedule view updates without creating a second graph or
  // rewriting notes.
  onload() {
    this.modals = new Set();
    this.controllers = new Map();
    this.blocked = new WeakSet();
    this.active = true;
    this.directory = path.resolve(
      this.app.vault.adapter.getBasePath(),
      this.app.vault.configDir,
      'plugins',
      this.manifest.id,
    );
    this.store = new SettingsStore(this.directory);
    try {
      this.cfg = this.store.read() || C.defaults();
    } catch (e) {
      this.report(e);
    }
    this.addSettingTab(new UI.Settings(this.app, this));
    this.addCommand({
      id: 'open-guide',
      name: 'Open guide',
      callback: () => new UI.Guide(this).open(),
    });
    if (!['1.14.4', '1.14.5', '1.15.0', '1.15.1'].includes(apiVersion)) {
      this.report(
        Error('Graph Views needs native compatibility verification for Obsidian ' + apiVersion),
      );
      return;
    }
    if (!this.cfg) return;
    const style = document.createElement('style');
    style.textContent = UI.CSS;
    document.head.appendChild(style);
    this.register(() => style.remove());
    try {
      const registry = this.app.viewRegistry;
      const install = () => {
        if (!this.active || registry.viewByType.graph === this.graphCreatorGuard) return;
        const cleanup = [];
        this.graphCreatorGuard = guardCreation(registry, (view) => {
          if (!this.active || !this.cfg) throw Error('Graph Views startup guard unavailable');
          const c = new NativeGraph(this, view, true);
          this.controllers.set(view, c);
        }, (error) => this.report(error), cleanup);
        for (const close of cleanup) this.register(close);
      };
      if (!registry || typeof registry.on !== 'function')
        throw Error('Native graph creation integration unavailable; keep Graph closed');
      install();
      this.registerEvent(registry.on('view-registered', (type) => {
        if (type === 'graph') {
          try { install(); } catch (error) { this.report(error); }
        }
      }));
    } catch (error) {
      this.report(error);
      return;
    }
    for (const [mode, name] of [
      ['overview', 'Overview'],
      ['focused', 'Focused Writing'],
      ['structure', 'Structure'],
    ])
      this.addCommand({
        id: 'show-' + mode,
        name: 'Show ' + name,
        callback: () =>
          this.act(async () => {
            const leaf = this.app.workspace.getLeavesOfType('graph')[0];
            if (leaf) {
              await this.app.workspace.revealLeaf(leaf);
              await leaf.loadIfDeferred();
            } else this.app.commands.executeCommandById('graph:open');
            this.scan();
            this.changeMode(mode);
          }),
      });
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.scheduleScan()));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleScan()));
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && this.cfg.mode === 'focused' && this.cfg.followActive) {
          this.cfg.focusRoots = [file.path];
          this.renderAll();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, old) =>
        this.act(() => {
          this.commit(C.renamed(this.cfg, old, file.path));
          for (const c of this.controllers.values()) {
            c.selected = new Set(
              [...c.selected].map((p) =>
                p === old || p.startsWith(old + '/') ? file.path + p.slice(old.length) : p,
              ),
            );
            c.trace = null;
          }
        }),
      ),
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.active) this.scan();
    });
  }
  // Deferred native tabs have no renderer yet. Wait for their normal reveal;
  // capture Overview only when a real graph instance exists.
  scan() {
    if (!this.active || !this.cfg) return;
    const views = new Set(
      this.app.workspace
        .getLeavesOfType('graph')
        .filter((l) => !l.isDeferred)
        .map((l) => l.view),
    );
    for (const [v, c] of this.controllers)
      if (!views.has(v) && !c.beforeLoad) {
        c.dispose();
        this.controllers.delete(v);
      }
    for (const v of views) {
      let c = this.controllers.get(v);
      if ((c && !c.beforeLoad) || this.blocked.has(v)) continue;
      try {
        capabilities(v);
        if (!this.cfg.presets.overview) this.commit(C.seed(this.cfg, v.dataEngine.getOptions()));
        if (!c) c = new NativeGraph(this, v);
        this.controllers.set(v, c);
        c.beforeLoad = false;
        c.setting = false;
        UI.attach(this, c);
        c.applyOptions(this.cfg.presets[this.cfg.mode]);
      } catch (error) {
        this.blocked.add(v);
        // UI/options failures must not remove a working input guard.
        if (c) {
          c.beforeLoad = false;
          c.setting = false;
          c.reject(error);
        }
        this.report(error);
      }
    }
  }

  // Debounce layout events so a burst scans graph instances once after the short delay.
  scheduleScan() {
    clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => this.scan(), 100);
  }
  // Retain the last integration error, show it and refresh controller status displays.
  report(e) {
    this.error = e.message;
    new Notice('Graph Views: ' + e.message, 12000);
    for (const c of this.controllers?.values() || []) UI.paint(c);
  }
  // Present synchronous or promise failures from interface actions through the same error
  // path.
  act(fn) {
    try {
      if (!this.cfg) throw Error('Graph Views preferences are unavailable');
      const result = fn();
      if (result?.then) return result.catch((e) => this.report(e));
      return result;
    } catch (e) {
      this.report(e);
    }
  }
  // Atomic preferences save; original note contents are never persisted here.
  commit(next) {
    const n = C.normalize(next);
    this.store.save(n);
    this.cfg = n;
    this.error = null;
  }
  // Coalesce preference changes into one pending save; preserve the visible error if
  // persistence fails.
  saveSoon() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        this.commit(this.cfg);
      } catch (e) {
        this.report(e);
      }
    }, 500);
  }
  // Validate the requested preset, update each attached native graph controller and schedule
  // preference persistence.
  changeMode(mode) {
    if (!C.defaults().presets.hasOwnProperty(mode)) throw Error('Unknown view');
    this.cfg.mode = mode;
    for (const c of this.controllers.values()) c.mode(mode);
    this.saveSoon();
  }
  // Apply the current preset to each attached graph and debounce the corresponding
  // preference save.
  applyAll() {
    for (const c of this.controllers.values()) c.applyOptions(this.cfg.presets[this.cfg.mode]);
    this.saveSoon();
  }
  // Reproject each controller independently; report a failed controller without skipping
  // later instances.
  renderAll() {
    for (const c of this.controllers.values())
      try {
        c.render();
      } catch (e) {
        c.fail(e);
      }
  }
  // Refresh the existing controller toolbar using the shared interface implementation.
  paint(c) {
    UI.paint(c);
  }
  // Release owned callbacks and pins without requesting a full native refresh.
  // Keep the last safe display while removing plugin-owned UI and timers.
  onunload() {
    this.active = false;
    for (const m of this.modals) m.close();
    this.modals.clear();
    clearTimeout(this.scanTimer);
    clearTimeout(this.saveTimer);
    for (const c of this.controllers.values()) c.dispose();
    this.controllers.clear();
    if (this.cfg)
      try {
        this.commit(this.cfg);
      } catch (e) {
        console.error('Graph Views preferences retained in memory only', e.message);
      }
  }
};
