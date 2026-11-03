// SPDX-License-Identifier: MPL-2.0
// Focused regression checks on synthetic graphs, owned hooks and private settings.
// Run with Node; no installed vault, original notes or network is accessed.
'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const M = require('./projection.cjs'),
  C = require('./config.cjs'),
  { SettingsStore } = require('./storage.cjs'),
  { NativeGraph, hook, capabilities, guardCreation } = require('./runtime.cjs');
let count = 0;
function check(name, fn) {
  fn();
  count++;
  console.log('PASS ' + name);
}
const raw = {
    nodes: {
      Home: { type: '', links: { A: true, B: true } },
      A: { type: '', links: { Shared: true } },
      B: { type: '', links: { Shared: true } },
      Shared: { type: '', links: { Home: true, Outside: true } },
      Outside: { type: '', links: {} },
      Orphan: { type: '', links: {} },
    },
    numLinks: 6,
  },
  g = M.index(raw),
  ids = (p) => Object.keys(p.data.nodes).sort();
check('Overview retains every native identity and real link', () => {
  const p = M.project(g);
  assert.deepEqual(ids(p), [...g.ids].sort());
  assert.equal(p.edges, 6);
  assert.deepEqual(p.data.nodes, raw.nodes);
});
check('Opaque native fields and native weights survive all projections', () => {
  const weighted = { ...raw, weights: { Home: 17, A: 5 }, nativeOpaque: { retained: true } },
    gi = M.index(weighted);
  for (const mode of M.MODES) {
    const p = M.project(gi, { mode, roots: ['Home'], depth: 2 });
    assert.equal(p.data.weights, weighted.weights);
    assert.equal(p.data.nativeOpaque, weighted.nativeOpaque);
  }
});
check('Native weight-only changes invalidate the projection signature', () => {
  const a = M.project(M.index({ ...raw, weights: { Home: 1 } })),
    b = M.project(M.index({ ...raw, weights: { Home: 2 } }));
  assert.notEqual(a.signature, b.signature);
});
check('Focused Writing follows incoming and outgoing links', () =>
  assert.deepEqual(ids(M.project(g, { mode: 'focused', roots: ['Outside'], depth: 1 })), [
    'Outside',
    'Shared',
  ]),
);
check('Structure follows outgoing contents branches', () =>
  assert.deepEqual(ids(M.project(g, { mode: 'structure', roots: ['Home'], depth: 1 })), [
    'A',
    'B',
    'Home',
  ]),
);
check('Shared notes and cycles keep single native identity', () =>
  assert.equal(M.project(g, { mode: 'structure', roots: ['Home'], depth: 12 }).nodes, 5),
);
check('Folding preserves alternate shared-note routes', () =>
  assert(
    ids(
      M.project(g, { mode: 'structure', roots: ['Home'], depth: 12, folded: new Set(['A']) }),
    ).includes('Shared'),
  ),
);
check('Folding both branches hides descendants', () =>
  assert.deepEqual(
    ids(
      M.project(g, { mode: 'structure', roots: ['Home'], depth: 12, folded: new Set(['A', 'B']) }),
    ),
    ['A', 'B', 'Home'],
  ),
);
check('Cross-links are preserved without invented edges', () => {
  const p = M.project(g, { mode: 'structure', roots: ['Home'], depth: 2 });
  assert(p.data.nodes.Shared.links.Home);
  for (const [a, n] of Object.entries(p.data.nodes))
    for (const b of Object.keys(n.links)) assert(raw.nodes[a].links[b]);
});
check('Trace uses existing links only', () => {
  const p = M.shortest(g, 'A', 'Outside');
  assert.equal(p[0], 'A');
  assert.equal(p.at(-1), 'Outside');
  for (let i = 1; i < p.length; i++) assert(g.both.get(p[i - 1]).has(p[i]));
  assert.equal(M.shortest(g, 'A', 'Orphan'), null);
});
check('Missing root is explicit, no placeholder node', () => {
  const p = M.project(g, { mode: 'structure', roots: ['Missing'], depth: 3 });
  assert.equal(p.nodes, 0);
  assert.deepEqual(p.missingRoots, ['Missing']);
});
check('Projection never mutates native graph', () => {
  const old = JSON.stringify(raw);
  M.project(g, { mode: 'structure', roots: ['Home'], selected: new Set(['A']), depth: 4 });
  assert.equal(JSON.stringify(raw), old);
});
check('Prototype keys and oversized graphs refused', () => {
  assert.throws(() => M.index({ nodes: JSON.parse('{"__proto__":{"links":{}}}') }));
  assert.throws(() => C.normalize({ ...C.defaults(), depth: 100 }));
});
check('Generic defaults contain no personal root', () =>
  assert(!JSON.stringify(C.defaults()).includes('Knowledge')),
);
check('Native preferences seed independent mode presets', () => {
  const c = C.seed(C.defaults(), { search: 'tag:#idea', showOrphans: false });
  c.presets.focused.search = 'new';
  assert.equal(c.presets.overview.search, 'tag:#idea');
  assert.equal(c.presets.structure.showArrow, true);
});
check('Rename moves exact preferences/pins, not lookalike paths', () => {
  const s = C.defaults();
  s.structureRoots = ['Dir/Home.md', 'Directory/Other.md'];
  s.pins['Dir/Home.md'] = { x: 1, y: 2 };
  const n = C.renamed(s, 'Dir', 'New');
  assert.deepEqual(n.structureRoots, ['New/Home.md', 'Directory/Other.md']);
  assert(n.pins['New/Home.md']);
});
check('Unrecognized fields are never persisted', () => {
  const s = C.normalize({ ...C.defaults(), notes: 'private' });
  assert(!('notes' in s));
  assert(!('unknown' in C.options({ unknown: 3 })));
});
check('Queries/colors/pins bounded and validated', () => {
  assert.throws(() => C.options({ search: 'x'.repeat(8001) }));
  assert.throws(() => C.options({ colorGroups: [{ query: 'x', color: { rgb: -1, a: 1 } }] }));
  assert.throws(() => C.normalize({ ...C.defaults(), pins: { A: { x: Infinity, y: 1 } } }));
});
function fake() {
  const messages = [],
    calls = [],
    clicks = [],
    cfg = C.seed(C.defaults(), { search: '', showOrphans: true }),
    r = {
      nodes: [],
      links: [],
      nodeLookup: {},
      setData(data) {
        calls.push(data);
        this.nodes = Object.keys(data.nodes).map(
          (id, i) => this.nodeLookup[id] || { id, x: i + 1, y: i + 2 },
        );
        this.nodeLookup = Object.fromEntries(this.nodes.map((n) => [n.id, n]));
      },
      onNodeClick(...a) {
        clicks.push(a);
      },
      worker: {
        postMessage(m) {
          messages.push(m);
        },
      },
    },
    e = {
      opts: cfg.presets.overview,
      getOptions() {
        return this.opts;
      },
      setOptions(o) {
        this.opts = o;
      },
      updateSearch() {},
      render() {
        r.setData(raw);
      },
      onOptionsChange() {},
    },
    view = { renderer: r, dataEngine: e, getViewType: () => 'graph', onClose() {}, _loaded: true },
    p = {
      cfg,
      app: { workspace: { getActiveFile: () => null } },
      paint() {},
      report(e) {
        this.error = e.message;
      },
      saveSoon() {},
      renderAll() {
        c.render();
      },
      changeMode(m) {
        c.mode(m);
      },
    };
  const originals = {
      setData: r.setData,
      click: r.onNodeClick,
      worker: r.worker.postMessage,
      options: e.onOptionsChange,
    },
    c = new NativeGraph(p, view);
  return { p, c, r, e, messages, calls, clicks, originals };
}
check('Unknown capability fails before hooking', () =>
  assert.throws(() => capabilities({ getViewType: () => 'graph', renderer: {} })),
);
check('Partial callback setup rolls back every installed hook', () => {
  const t = fake();
  t.c.dispose();
  const set = t.r.setData,
    click = t.r.onNodeClick,
    options = t.e.onOptionsChange;
  Object.defineProperty(t.r.worker, 'postMessage', {
    value: t.r.worker.postMessage,
    writable: false,
    configurable: true,
  });
  assert.throws(() => new NativeGraph(t.p, t.c.view));
  assert.equal(t.r.setData, set);
  assert.equal(t.r.onNodeClick, click);
  assert.equal(t.e.onOptionsChange, options);
});
check('Identical native updates skip expensive renderer work', () => {
  const t = fake();
  t.e.render();
  t.e.render();
  assert.equal(t.calls.length, 1);
  t.c.dispose();
});
check('Normal native click passes through unchanged', () => {
  const t = fake(),
    ev = {};
  t.r.onNodeClick(ev, 'A', '');
  assert.deepEqual(t.clicks, [[ev, 'A', '']]);
  t.c.dispose();
});
check('Shift-click selects without opening or altering content', () => {
  const t = fake();
  t.e.render();
  t.r.onNodeClick({ shiftKey: true, preventDefault() {}, stopPropagation() {} }, 'A', '');
  assert(t.c.selected.has('A'));
  assert.equal(t.clicks.length, 0);
  t.c.dispose();
});
check('Pin and native drag/release retain chosen positions', () => {
  const t = fake();
  t.e.render();
  t.c.choose('A');
  t.c.pin();
  t.r.worker.postMessage({ forceNode: { id: 'A', x: 10, y: 20 } });
  t.r.worker.postMessage({ forceNode: { id: 'A', x: null, y: null } });
  assert.deepEqual(t.messages.at(-1).forceNode, { id: 'A', x: 10, y: 20 });
  t.c.pin(true);
  assert.deepEqual(t.messages.at(-1).forceNode, { id: 'A', x: null, y: null });
  t.c.dispose();
});
check('Unload restores exact owned callbacks and keeps safe display', () => {
  const t = fake();
  t.p.cfg.followActive = false;
  t.p.cfg.focusRoots = ['Outside'];
  t.c.mode('focused');
  t.e.render();
  assert.equal(t.r.nodes.length, 5);
  t.c.dispose();
  assert.equal(t.r.setData, t.originals.setData);
  assert.equal(t.r.onNodeClick, t.originals.click);
  assert.equal(t.r.worker.postMessage, t.originals.worker);
  assert.equal(t.e.onOptionsChange, t.originals.options);
  assert.equal(t.r.nodes.length, 5);
});
check('Unload never overwrites another plugin later hook', () => {
  const o = { f() {} },
    clean = [];
  hook(o, 'f', (orig) => () => orig(), clean);
  const later = (o.f = () => 3);
  clean[0]();
  assert.equal(o.f, later);
});
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-views-test-'));
try {
  check('Settings create/read and exact previous recovery copy', () => {
    const s = new SettingsStore(dir);
    assert.equal(s.read(), null);
    s.save(C.defaults());
    const old = fs.readFileSync(path.join(dir, 'data.json'));
    const n = C.defaults();
    n.depth = 3;
    s.save(n);
    assert.deepEqual(fs.readFileSync(path.join(dir, 'data.json.previous')), old);
    assert.equal(new SettingsStore(dir).read().depth, 3);
  });
  check('External settings changes refused and preserved', () => {
    const s = new SettingsStore(dir);
    s.read();
    const f = path.join(dir, 'data.json');
    fs.appendFileSync(f, ' ');
    assert.throws(() => s.save(C.defaults()), /changed outside/);
    assert(fs.readFileSync(f, 'utf8').endsWith(' '));
  });
  check('Stale cooperative lock never stolen', () => {
    const s = new SettingsStore(dir);
    s.read();
    const f = path.join(dir, 'data.json.lock');
    fs.writeFileSync(f, 'owned');
    assert.throws(() => s.save(C.defaults()));
    assert.equal(fs.readFileSync(f, 'utf8'), 'owned');
    fs.unlinkSync(f);
  });
  check('Malformed settings are not silently replaced', () => {
    const f = path.join(dir, 'data.json');
    fs.writeFileSync(f, 'invalid');
    assert.throws(() => new SettingsStore(dir).read());
    assert.equal(fs.readFileSync(f, 'utf8'), 'invalid');
  });
  check('Swapped settings directory refused', () => {
    const d = path.join(dir, 'owned');
    fs.mkdirSync(d);
    const s = new SettingsStore(d);
    s.read();
    fs.renameSync(d, d + '-old');
    fs.mkdirSync(d);
    assert.throws(() => s.save(C.defaults()), /directory changed/);
    assert(!fs.existsSync(path.join(d, 'data.json')));
  });

  const { verifySourceExport, publicFiles } = require('./release-check.cjs'),
    exportDir = path.join(dir, 'public-export');
  fs.mkdirSync(exportDir);
  for (const n of publicFiles) {
    const dest = path.join(exportDir, n);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(__dirname, n), dest);
  }
  check('Public export accepts only the exact source allowlist and matching bytes', () =>
    assert.equal(verifySourceExport(exportDir).files, 22),
  );
  check('Public export rejects an added private settings file', () => {
    const f = path.join(exportDir, 'data.json');
    fs.writeFileSync(f, '{}');
    try {
      assert.throws(() => verifySourceExport(exportDir), /exact reviewed allowlist/);
    } finally {
      fs.unlinkSync(f);
    }
  });
  check('Public export rejects changed source bytes', () => {
    const f = path.join(exportDir, 'README.md'),
      before = fs.readFileSync(f);
    fs.appendFileSync(f, 'extra');
    try {
      assert.throws(() => verifySourceExport(exportDir), /content differs/);
    } finally {
      fs.writeFileSync(f, before);
    }
  });
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Test the entry-point admission contract, independently of synthetic graph capabilities.
const vm = require('node:vm');
for (const [version, accepted] of [
  ['1.14.4', true],
  ['1.14.5', true],
  ['1.15.0', false],
])
  check('Entry point ' + (accepted ? 'admits verified ' : 'refuses unverified ') + version, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-views-version-')),
      directory = path.join(root, '.obsidian/plugins/graph-views');
    fs.mkdirSync(directory, { recursive: true });
    try {
      class Base {
        constructor() {
          this.commands = [];
          this.events = [];
          this.cleanups = [];
        }
        addSettingTab() {}
        addCommand(c) {
          this.commands.push(c);
        }
        registerEvent(e) {
          this.events.push(e);
        }
        register(f) {
          this.cleanups.push(f);
        }
      }
      const local = { exports: {} },
        workspace = {
          on(name) {
            return { name };
          },
          onLayoutReady(fn) {
            this.ready = fn;
          },
        },
        vault = { adapter: { getBasePath: () => root }, configDir: '.obsidian', on: () => ({}) },
        head = { appendChild() {} };
      const context = {
        module: local,
        exports: local.exports,
        require(id) {
          if (id === 'obsidian') return { Plugin: Base, Notice: class {}, apiVersion: version };
          if (id === './ui.cjs') return { Settings: class {}, Guide: class {}, CSS: '' };
          return require(id);
        },
        document: { createElement: () => ({ remove() {} }), head },
        setTimeout,
        clearTimeout,
        console,
      };
      vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8'), context);
      const p = new local.exports();
      p.app = { vault, workspace, viewRegistry: { viewByType: { graph() {} }, on: (name) => ({ name }) } };
      p.manifest = { id: 'graph-views' };
      p.onload();
      assert.equal(
        p.commands.some((c) => c.id === 'show-overview'),
        accepted,
      );
      assert.equal(p.events.length > 0, accepted);
      if (accepted)
        assert(
          p.events.some((e) => e.name === 'file-open'),
          'file-open listener must be registered for cleanup',
        );
      assert.equal(typeof workspace.ready === 'function', accepted);
      if (!accepted) assert.match(p.error, /needs native compatibility verification/);
      for (const f of p.cleanups) f();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

check('Native node, link-value and top-level updates invalidate renderer reuse', () => {
  const t = fake(),
    data = JSON.parse(JSON.stringify(raw));
  data.nodes.A.nativeLabel = 'first';
  data.nativeOptions = { revision: 1 };
  t.r.setData(data);
  assert.equal(t.calls.length, 1);
  data.nodes.A.nativeLabel = 'second';
  t.r.setData(data);
  assert.equal(t.calls.length, 2);
  assert.equal(t.calls.at(-1).nodes.A.nativeLabel, 'second');
  data.nativeOptions.revision = 2;
  t.r.setData(data);
  assert.equal(t.calls.length, 3);
  assert.equal(t.calls.at(-1).nativeOptions.revision, 2);
  const target = Object.keys(data.nodes.A.links)[0];
  data.nodes.A.links[target] = 9;
  t.r.setData(data);
  assert.equal(t.calls.length, 4);
  assert.equal(t.calls.at(-1).nodes.A.links[target], 9);
  t.r.setData(data);
  assert.equal(t.calls.length, 4);
  t.c.dispose();
});

const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-views-artifact-'));
try {
  const cp = require('node:child_process'),
    crypto = require('node:crypto'),
    out = path.join(packageRoot, 'package');
  const built = cp.spawnSync(process.execPath, [path.join(__dirname, 'build.cjs'), out], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(built.status, 0);
  check('Release gate independently binds the package to this source', () => {
    const result = cp.spawnSync(
      process.execPath,
      [path.join(__dirname, 'release-check.cjs'), out],
      { encoding: 'utf8', windowsHide: true },
    );
    assert.equal(result.status, 0, result.stderr);
  });
  check('Release gate rejects altered main.js even with matching self-checksums', () => {
    fs.appendFileSync(path.join(out, 'main.js'), '\n// unreviewed replacement\n');
    const sums = fs
      .readdirSync(out)
      .filter((n) => n !== 'SHA256SUMS.txt')
      .sort()
      .map(
        (n) =>
          crypto
            .createHash('sha256')
            .update(fs.readFileSync(path.join(out, n)))
            .digest('hex') +
          '  ' +
          n,
      );
    fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
    const result = cp.spawnSync(
      process.execPath,
      [path.join(__dirname, 'release-check.cjs'), out],
      { encoding: 'utf8', windowsHide: true },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /differs from reviewed source build/);
  });
} finally {
  fs.rmSync(packageRoot, { recursive: true, force: true });
}


check('Rejected first update shows empty and recovers without a bypass', () => {
  const t = fake(), bad = { nodes: JSON.parse('{"__proto__":{"links":{}}}') };
  t.r.setData(bad);
  assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
  assert.match(t.c.error, /Graph update blocked.*Empty display shown/);
  assert.match(t.c.error, /Edit view.*100,000 nodes.*500,000 links/);
  assert.equal(t.c.g, null);
  t.r.setData(bad);
  assert.equal(t.calls.length, 1);
  t.r.setData(raw);
  assert.equal(t.r.nodes.length, 6);
  assert.equal(t.c.error, null);
  assert.equal(t.p.error, undefined);
  t.c.dispose();
});
check('Real node overflow is blocked before small Structure projection in every mode', () => {
  const nodes = Object.fromEntries(Array.from({ length: 100001 }, (_, i) => ['N' + i, { links: {} }]));
  const oversized = { nodes, numLinks: 0 };
  assert.throws(() => M.index(oversized), /verified processing bound/);
  delete nodes.N100000;
  assert.equal(M.index(oversized).ids.length, 100000);
  nodes.N100000 = { links: {} };
  for (const mode of M.MODES) {
    const t = fake();
    t.p.cfg.mode = mode;
    t.p.cfg.structureRoots = ['N0'];
    t.p.cfg.focusRoots = ['N0'];
    t.p.cfg.depth = 1;
    t.r.setData(oversized);
    assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
    assert.match(t.c.error, /verified processing bound/);
    t.r.setData(oversized);
    t.c.render();
    assert.equal(t.calls.length, 1);
    t.r.setData(raw);
    assert.equal(t.c.error, null);
    assert(t.c.g);
    t.c.dispose();
  }
});
check('Repeated oversized links preserve last safe display and valid recovery', () => {
  const nodes = Object.fromEntries(Array.from({ length: 1001 }, (_, i) => ['L' + i, { links: {} }]));
  const targets = Object.fromEntries(Array.from({ length: 500 }, (_, i) => ['L' + i, true]));
  for (let i = 0; i < 1000; i++) nodes['L' + i].links = targets;
  const data = { nodes, numLinks: 500000 };
  assert.equal(M.index(data).edges, 500000);
  nodes.L1000.links = { L0: true };
  assert.throws(() => M.index(data), /link bound/);
  const t = fake();
  t.r.setData(raw);
  const safe = t.calls.at(-1), signature = t.c.signature;
  t.r.setData(data);
  t.r.setData(data);
  t.c.render();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls.at(-1), safe);
  assert.equal(t.c.signature, signature);
  assert.equal(t.c.g, null);
  assert.match(t.c.error, /link bound.*Last safe display kept/);
  t.r.setData(raw);
  assert.equal(t.c.error, null);
  assert.equal(t.calls.length, 1);
  const changed = { nodes: { Recovered: { links: {} } }, numLinks: 0 };
  t.r.setData(changed);
  assert.equal(t.calls.length, 2);
  assert.deepEqual(Object.keys(t.calls.at(-1).nodes), ['Recovered']);
  t.c.dispose();
});
check('Projection failure never forwards raw data and can recover', () => {
  const t = fake();
  t.p.cfg.mode = 'invalid';
  t.r.setData(raw);
  assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
  assert.match(t.c.error, /Unknown view/);
  t.p.cfg.mode = 'overview';
  t.r.setData(raw);
  assert.equal(t.c.error, null);
  assert.equal(t.calls.length, 2);
  t.c.dispose();
});
check('Renderer and presentation errors cannot reopen raw forwarding', () => {
  const t = fake(), set = t.c.originalSetData, submitted = [];
  t.c.originalSetData = function (data) {
    submitted.push(data);
    throw Error('native renderer failure');
  };
  t.p.paint = () => { throw Error('paint failed'); };
  t.p.report = () => { throw Error('report failed'); };
  assert.doesNotThrow(() => t.r.setData(raw));
  assert.equal(submitted.length, 2);
  assert.notEqual(submitted[0], raw);
  assert.deepEqual(submitted[1], { nodes: {}, numLinks: 0 });
  assert.equal(t.c.g, null);
  t.c.originalSetData = set;
  t.p.paint = () => {};
  t.r.setData(raw);
  assert.equal(t.c.error, null);
  assert.equal(t.r.nodes.length, 6);
  t.c.dispose();
});
check('Unload requests no delayed engine refresh and stale callbacks do nothing', () => {
  const t = fake(), stale = t.r.setData, before = t.calls.length;
  t.e.setOptions = t.e.updateSearch = t.e.render = () => { throw Error('unload refresh forbidden'); };
  t.r.setData({ nodes: JSON.parse('{"__proto__":{"links":{}}}') });
  assert.equal(t.calls.length, before + 1);
  t.c.dispose();
  stale(raw);
  assert.equal(t.calls.length, before + 1);
  assert.equal(t.r.setData, t.originals.setData);
  assert.equal(t.c.g, null);
  assert.equal(t.c.active, false);
  t.c.dispose();
});
check('Worker, cleanup and reporting failures do not strand other unload hooks', () => {
  const t = fake();
  t.r.setData(raw);
  t.c.choose('A');
  t.c.pin();
  t.r.worker.postMessage = () => { throw Error('worker failed'); };
  t.p.report = () => { throw Error('report failed'); };
  t.c.cleanup.push(() => { throw Error('cleanup failed'); });
  t.c.bar = { remove() { throw Error('bar failed'); } };
  assert.doesNotThrow(() => t.c.dispose());
  assert.equal(t.r.setData, t.originals.setData);
  assert.equal(t.r.onNodeClick, t.originals.click);
  assert.equal(t.e.onOptionsChange, t.originals.options);
  assert.equal(t.r.nodeLookup.A.fx, null);
  assert.equal(t.c.selected.size, 0);
});


check('Dangling and mixed raw links share the existing 500000-entry limit', () => {
  const links = Object.fromEntries(Array.from({ length: 500000 }, (_, i) => ['Missing' + i, true]));
  const data = { nodes: { Home: { links } }, numLinks: 500000 };
  assert.equal(M.index(data).edges, 0);
  links.Missing500000 = true;
  assert.throws(() => M.index(data), /link bound/);
  const t = fake();
  t.r.setData(data);
  assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
  assert.match(t.c.error, /link bound/);
  t.r.setData(raw);
  const safe = t.calls.at(-1);
  delete links.Missing500000;
  links.Home = true;
  assert.throws(() => M.index(data), /link bound/);
  t.r.setData(data);
  t.r.setData(data);
  assert.equal(t.calls.at(-1), safe);
  assert.equal(t.calls.length, 2);
  assert.equal(t.c.g, null);
  t.r.setData(raw);
  assert.equal(t.c.error, null);
  assert.equal(t.calls.length, 2);
  t.c.dispose();
});

check('Oversized key enumeration stops before inspecting later node/link keys', () => {
  for (const [kind, limit] of [['node', 100000], ['link', 500000]]) {
    const target = Object.fromEntries(Array.from({ length: limit + 5 }, (_, i) =>
      ['K' + i, kind === 'node' ? { links: {} } : true]));
    let latest = -1;
    const observed = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        const n = Number(key.slice(1));
        if (Number.isFinite(n)) {
          latest = Math.max(latest, n);
          if (n > limit) throw Error('Inspected keys beyond rejection point');
        }
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });
    const data = kind === 'node' ? { nodes: observed } : { nodes: { Home: { links: observed } } };
    const t = fake();
    t.r.setData(data);
    assert.match(t.c.error, kind === 'node' ? /verified processing bound/ : /link bound/);
    assert.equal(latest, limit);
    assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
    t.c.dispose();
  }
});
check('Inherited node/link keys stay excluded after bounded enumeration', () => {
  const links = Object.assign(Object.create({ Outside: true }), { A: true });
  const nodes = Object.assign(Object.create({ Hidden: { links: {} } }), {
    Home: { links }, A: { links: {} },
  });
  const g = M.index({ nodes });
  assert.deepEqual(g.ids, ['Home', 'A']);
  assert.equal(g.edges, 1);
});
check('Control actions revalidate native objects mutated after a safe update', () => {
  const t = fake(), data = JSON.parse(JSON.stringify(raw));
  t.r.setData(data);
  const safe = t.calls.at(-1);
  data.nodes.Home.links = Object.fromEntries(Array.from({ length: 500001 }, (_, i) => ['Lost' + i, true]));
  t.c.render();
  assert.match(t.c.error, /link bound/);
  assert.equal(t.c.g, null);
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls.at(-1), safe);
  t.r.setData(raw);
  assert.equal(t.c.error, null);
  t.c.dispose();
});

check('Links changing between validation and projection cannot bypass the bound', () => {
  const target = Object.fromEntries(Array.from({ length: 500005 }, (_, i) => ['M' + i, true]));
  let latest = -1, reads = 0;
  const links = new Proxy(target, {
    getOwnPropertyDescriptor(object, key) {
      latest = Math.max(latest, Number(key.slice(1)));
      if (latest > 500000) throw Error('Projection inspected keys after rejection point');
      return Reflect.getOwnPropertyDescriptor(object, key);
    },
  });
  const data = { nodes: { Home: { get links() { return ++reads === 1 ? {} : links; } } } };
  const t = fake();
  t.r.setData(data);
  assert.match(t.c.error, /link bound/);
  assert.equal(reads, 2);
  assert.equal(latest, 500000);
  assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
  assert.equal(t.c.g, null);
  t.r.setData(raw);
  assert.equal(t.c.error, null);
  t.c.dispose();
});
check('Trace action while blocked keeps status and permits clean recovery', () => {
  const t = fake();
  t.r.setData(raw);
  t.c.choose('A');
  t.c.choose('B');
  t.r.setData({ nodes: JSON.parse('{"__proto__":{"links":{}}}') });
  const status = t.c.error;
  assert.doesNotThrow(() => t.c.traceSelected());
  assert.equal(t.c.error, status);
  assert.equal(t.p.error, undefined);
  t.r.setData(raw);
  assert.equal(t.c.error, null);
  t.c.traceSelected();
  assert(t.c.trace);
  t.c.dispose();
});


function earlyFixture() {
  const t = fake();
  t.c.dispose();
  let builds = 0, saves = 0, ready = false;
  t.e.render = function () { builds++; t.r.setData(raw); };
  t.e.setQuery = function () { ready = true; this.render(); };
  t.p.saveSoon = () => { saves++; };
  t.c = new NativeGraph(t.p, t.c.view, true);
  return { ...t, counts: () => ({ builds, saves, ready }) };
}
check('First native renderer update is guarded before view onload', () => {
  const t = fake(); t.c.dispose();
  t.e.setQuery = function () { this.render(); };
  const leaf = { view: null }; t.c.view.leaf = leaf;
  const cleanup = [], registry = { viewByType: { graph: () => t.c.view } };
  let early;
  guardCreation(registry, (view) => { early = new NativeGraph(t.p, view, true); }, () => {}, cleanup);
  const view = registry.viewByType.graph(leaf);
  assert(early && view === t.c.view);
  const nodes = Object.fromEntries(Array.from({ length: 100001 }, (_, i) => ['First' + i, { links: {} }]));
  view.renderer.setData({ nodes });
  assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
  assert.match(early.error, /verified processing bound/);
  const targets = Object.fromEntries(Array.from({ length: 500 }, (_, i) => ['L' + i, true]));
  const linked = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ['L' + i, { links: targets }]));
  linked.Excess = { links: { L0: true } };
  view.renderer.setData({ nodes: linked }); view.renderer.setData({ nodes: linked });
  assert.equal(t.calls.length, 1); assert.match(early.error, /link bound/);
  view.dataEngine.setQuery([]);
  assert.equal(early.error, null); assert.equal(t.r.nodes.length, 6);
  early.dispose(); cleanup.reverse().forEach(close => close());
});
check('Startup waits for native query and cannot capture partial native preferences', () => {
  const t = earlyFixture(), before = JSON.stringify(t.p.cfg);
  t.e.render(); t.e.render(); t.e.onOptionsChange();
  assert.deepEqual(t.counts(), { builds: 0, saves: 0, ready: false });
  assert.equal(JSON.stringify(t.p.cfg), before);
  t.e.setQuery([]);
  assert.deepEqual(t.counts(), { builds: 1, saves: 0, ready: true });
  assert.equal(t.r.nodes.length, 6);
  t.c.beforeLoad = false; t.c.setting = false;
  t.e.onOptionsChange(); assert.equal(t.counts().saves, 1);
  t.c.dispose();
});
check('Failed first query stays closed and later valid native query recovers', () => {
  const t = fake(); t.c.dispose(); let failed = true, builds = 0;
  t.e.render = () => { builds++; t.r.setData(raw); };
  t.e.setQuery = function () { if (failed) throw Error('query failure'); this.render(); };
  const c = new NativeGraph(t.p, t.c.view, true);
  assert.throws(() => t.e.setQuery([]), /query failure/);
  t.e.render(); assert.equal(builds, 0); assert(c.searchPending);
  assert.deepEqual(t.calls, [{ nodes: {}, numLinks: 0 }]);
  failed = false; t.e.setQuery([]);
  assert.equal(builds, 1); assert.equal(c.error, null); c.dispose();
});
check('Creator guard refuses failure and destroys only its new unreturned native renderer', () => {
  const leaf = { view: null }; let destroyed = 0;
  const view = { leaf, renderer: { destroy() { destroyed++; } } };
  const native = () => view, registry = { viewByType: { graph: native } }, cleanup = [];
  guardCreation(registry, () => { throw Error('attach refused'); }, () => {}, cleanup);
  assert.throws(() => registry.viewByType.graph(leaf), /attach refused/); assert.equal(destroyed, 1);
  leaf.view = view;
  assert.throws(() => registry.viewByType.graph(leaf), /attach refused/); assert.equal(destroyed, 1);
  cleanup.reverse().forEach(close => close()); assert.equal(registry.viewByType.graph, native);
  guardCreation(registry, () => {}, () => {}, cleanup);
  const later = registry.viewByType.graph = () => view;
  cleanup.at(-1)(); assert.equal(registry.viewByType.graph, later);
});
check('Bootstrap setup rolls back render hook if native query hook is unavailable', () => {
  const t = fake(); t.c.dispose();
  t.e.setQuery = function () {};
  Object.defineProperty(t.e, 'setQuery', { writable: false });
  const render = t.e.render, set = t.r.setData;
  assert.throws(() => new NativeGraph(t.p, t.c.view, true));
  assert.equal(t.e.render, render); assert.equal(t.r.setData, set);
});
check('Disposed startup callbacks cannot start query work or submit data', () => {
  const t = earlyFixture(), render = t.e.render, query = t.e.setQuery, set = t.r.setData;
  t.c.dispose(); render(); query([]); set(raw);
  assert.deepEqual(t.counts(), { builds: 0, saves: 0, ready: false }); assert.equal(t.calls.length, 0);
});
check('A scan UI failure retains the already-installed input guard', () => {
  const mod = { exports: {} }, vm = require('node:vm');
  const code = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  const load = new vm.Script('(function(require,module){' + code + '\n})').runInThisContext();
  load((name) => name === 'obsidian' ? { Plugin: class {}, Notice: class {}, apiVersion: '1.14.5' }
    : name === './ui.cjs' ? { attach() { throw Error('UI unavailable'); } } : require(name), mod);
  const t = earlyFixture(), p = Object.create(mod.exports.prototype);
  Object.assign(p, { active: true, cfg: t.p.cfg, controllers: new Map([[t.c.view, t.c]]),
    blocked: new WeakSet(), app: { workspace: { getLeavesOfType: () => [{ view: t.c.view }] } },
    report() {}, paint() {} });
  t.c.plugin = p; const guarded = t.r.setData;
  p.scan(); assert.equal(t.r.setData, guarded); assert(t.c.active);
  t.r.setData({ nodes: JSON.parse('{"__proto__":{"links":{}}}') });
  assert.equal(t.c.g, null); assert.deepEqual(t.calls.at(-1), { nodes: {}, numLinks: 0 });
  t.r.setData(raw); assert.equal(t.c.error, null); t.c.dispose();
});

check('Delayed startup query admits only stopped empty uncancelled completion', () => {
  const t = fake(); t.c.dispose(); let running = true, cancelled = false, builds = 0;
  const q = { items: { length: 1 }, runnable: { isRunning: () => running, isCancelled: () => cancelled },
    cancel() { running = false; t.e.render(); cancelled = true; } };
  t.e.setQuery = function () { this.queue = q; }; t.e.render = () => { builds++; t.r.setData(raw); };
  const c = new NativeGraph(t.p, t.c.view, true); t.e.setQuery([]);
  t.e.render(); assert.equal(builds, 0);
  q.items.length = 0; t.e.render(); assert.equal(builds, 0);
  running = false; t.e.render(); assert.equal(builds, 1); assert(!c.searchPending); c.dispose();
});
check('Async failure cancellation and disposal cannot release startup query gate', () => {
  const t = fake(); t.c.dispose(); let running = true, cancelled = false, builds = 0;
  const q = { items: { length: 0 }, runnable: { isRunning: () => running, isCancelled: () => cancelled },
    cancel() { running = false; t.e.render(); cancelled = true; } };
  t.e.setQuery = function () { this.queue = q; }; t.e.render = () => { builds++; t.r.setData(raw); };
  const c = new NativeGraph(t.p, t.c.view, true); t.e.setQuery([]);
  t.e.render(); assert.equal(builds, 0); assert(c.searchPending);
  q.cancel(); assert.equal(builds, 0); assert(c.searchPending);
  cancelled = false; running = true; t.e.setQuery([]);
  const late = t.e.render; c.dispose(); running = false; late();
  assert.equal(builds, 0); assert.equal(c.active, false);
});
check('A pending native view stays guarded until activation or explicit close', () => {
  const mod = { exports: {} }, vm = require('node:vm');
  const load = new vm.Script('(function(require,module){' + fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8') + '\n})').runInThisContext();
  load((name) => name === 'obsidian' ? { Plugin: class {}, Notice: class {}, apiVersion: '1.14.5' }
    : name === './ui.cjs' ? {} : require(name), mod);
  const t = earlyFixture(), p = Object.create(mod.exports.prototype);
  Object.assign(p, { active: true, cfg: t.p.cfg, controllers: new Map([[t.c.view, t.c]]),
    blocked: new WeakSet(), app: { workspace: { getLeavesOfType: () => [] } }, report() {}, paint() {} });
  t.c.plugin = p;
  const protectedSetter = t.r.setData; p.scan();
  assert.equal(p.controllers.get(t.c.view), t.c); assert(t.c.active);
  assert.equal(t.r.setData, protectedSetter);
  t.c.view.onClose(); assert.equal(p.controllers.size, 0); assert.equal(t.c.active, false);
});
check('Replacing pending startup queries releases obsolete queue hooks immediately', () => {
  const t = fake(); t.c.dispose(); const queues = []; let builds = 0;
  t.e.render = () => { builds++; t.r.setData(raw); };
  t.e.setQuery = function () {
    this.queue?.cancel();
    const q = { items: { length: 1 }, running: true, cancelled: false,
      runnable: { isRunning: () => q.running, isCancelled: () => q.cancelled },
      cancel() { this.running = false; t.e.render(); this.cancelled = true; } };
    q.originalCancel = q.cancel; this.queue = q; queues.push(q);
  };
  const c = new NativeGraph(t.p, t.c.view, true), baseCleanup = c.cleanup.length;
  for (let i = 0; i < 50; i++) {
    t.e.setQuery([]); assert.equal(c.cleanup.length, baseCleanup);
    for (const old of queues.slice(0, -1)) assert.equal(old.cancel, old.originalCancel);
    assert.equal(c.startupQueue, queues.at(-1)); assert.equal(builds, 0);
  }
  const last = queues.at(-1); last.items.length = 0; last.running = false; t.e.render();
  assert.equal(builds, 1); assert.equal(last.cancel, last.originalCancel);
  assert.equal(c.startupQueue, null); assert.equal(c.startupCancel, null); c.dispose();
});
console.log(JSON.stringify({ passed: count, originalVaultTouched: false, networkUsed: false }));
