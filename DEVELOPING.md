# Graph Views maintenance

The native global Graph remains the data source and renderer. There is no custom ItemView, graph canvas, organization database or file-content writer. No dependency on another plugin is permitted. Personal roots/configuration belong only in installed data.json.

| Module | Functions and responsibility |
| --- | --- |
| projection.cjs | id validates identifiers; index builds bounded native directed/undirected adjacency; reach traverses roots with depth/folds; shortest traces real connections; branchColors colors first-reached branches; project returns a visibility/color projection preserving real edges and original identities |
| config.cjs | options validates the observed native contract; defaults is portable; normalize bounds presentation state; seed captures original native presets once; renamed follows path identity changes; clone copies plain settings |
| storage.cjs | SettingsStore storage/target/bytes validate fixed local storage, read preserves malformed inputs, temporary/cleanup own temporary files and locks, save compares loaded bytes under a cooperative lock and atomically retains previous state |
| runtime.cjs | capabilities refuses incompatible native instances; hook restores only an owned callback; NativeGraph wraps native setData/click/worker/options callbacks, projects live native data, switches presets, manages selection/folds/trace/native pins and restores owned callbacks on dispose |
| ui.cjs | PickNote chooses existing admitted originals; EditView holds drafts until Apply; Guide renders the shipped guide; Settings configures roots/following; ownModal closes only owned dialogs on unload; attach/paint place controls above the native canvas and display bounded status; CSS is plugin-owned and removed on unload |
| main.cjs | onload checks exact compatibility and registers scoped lifecycle events; the native creator guards new views before onload; scan activates pending views and skips deferred tabs; commit/saveSoon persist only settings; changeMode/applyAll/renderAll coordinate panes; onunload removes owned hooks/timers without a native refresh |
| build.cjs | Builds a self-contained CommonJS bundle and seven portable package files into a new absolute directory, then hashes them; no personal state read or dependency download |
| test.cjs | Synthetic projection/hook/storage regressions; temporary test directory is owned and removed; no installed-vault/network access |

Native internal interfaces are verified on Windows desktop Obsidian 1.14.4, 1.14.5, and 1.15.0: dataEngine getOptions/setOptions/updateSearch/render/onOptionsChange, renderer setData/onNodeClick/nodeLookup/nodes and worker postMessage forceNode protocol. Keep the exact version guard until actual native acceptance on another version. Runtime capability checks are an additional gate, not proof of cross-version compatibility.

Constructor setup rolls back all previously installed hooks if a later callback cannot be attached. Per-instance wrappers restore their previous descriptors only when still owned. Do not replace global prototypes or vault/index/cache APIs. Every incoming update is bounded before projection in every mode. Rejected updates never reach native setData: keep the last safe renderer display, or submit only an empty graph if no display has been confirmed. Drop the prior index after rejection so controls cannot reproject it; the next valid update recovers automatically and clears the pane status. A renderer failure also attempts an empty display; a failing native renderer cannot guarantee that display. Guard messages are pane-local, avoiding stale plugin-wide errors after recovery. Mode changes use the original native options/search pipeline. No render interval is introduced; unchanged data signatures skip native setData. ResizeObserver only resizes the native canvas when its content bounds change.

Keep tests meaningful: shared-note folds, cycles, incoming links, all-visible cross-link provenance, no phantom disconnected trace, click pass-through, pins/native drag/unload, external-settings conflicts and directory swaps. Separately test actual native canvas identity, interactions, live external writes/renames, mode persistence and unload/restart. Unit tests and screenshots alone do not prove installation or human usability.

Storage protects cooperative writers and detects observed linked/swapped paths. Windows lacks complete descriptor-relative filesystem operations; this is not isolation from a malicious same-user process. It writes only fixed own settings/recovery/temporary/lock files. It never changes native graph settings files directly; native controls own their persistence.

Build with Node: `node test.cjs`; `node build.cjs /absolute/path/to/new-output`. Copy the seven built files, preserving existing data.json. For rollback disable Graph Views first; retain settings/recovery, then remove only the plugin's own enabled entry and directory. Do not disable the separate Early Filter as a graph rollback. Extending actual note-link editing later requires a separate design, conflict-safe original writes, review and undo acceptance.

## Public beta ownership and packaging

ARCXCOVAEL LLC is the publisher and maintainer. This source is MPL-2.0; retain THIRD_PARTY_NOTICES.md. Public source is exported from the private canonical project through a strict file allowlist; private repository history, maintenance evidence, settings and other products are not release inputs. The public repository is the contribution surface; reconcile accepted contributions into the canonical source before the next export.

The manifest stays numeric (0.1.7); GitHub publishes numeric releases for Community Plugins updates; the title/docs retain the beta label. The native compatibility allowlist is 1.14.4, 1.14.5, and 1.15.0. `build.cjs` emits seven portable files including license and notices. `release-check.cjs` validates public metadata, source boundaries and packaged legal files; it checks the published beta intent without reading any installed settings.

Before publishing, run `node release-check.cjs /absolute/package /absolute/public-source`. The export gate rejects unexpected files/directories, links and byte differences against the exact22-file allowlist; Git metadata is not source and is excluded. Separate publication checks must verify that Git history contains only the clean exported root and that commit author email uses the public no-reply address. Focused tests cover an exact export, added private settings and altered bytes.

The native acceptance receipts cover Windows only; other operating systems remain unvalidated. The version allowlist does not establish another platform's compatibility.

## Readable source

Maintain the readable `.cjs` modules, with two-space indentation and the
repository's 100-column layout target. Preserve literals and original MPL notices.
The packaged `main.js` is generated from those modules; do not maintain it as
an independent source copy. `release-check.cjs` verifies the exact source export
and checks that a package matches a fresh build from that source.

The current synthetic baseline contains 65 checks. Run `node test.cjs` before
building a fresh package. Formatting, source review, package verification and
actual native interaction acceptance are separate results. Readability cleanup
does not change the plugin ID, native renderer, existing links or license.

## Oversized-input safety correction (source preparation)

The existing 100,000-node and 500,000-input-link limits apply before depth, folding or Structure projection. A blocked update leaves actionable toolbar status: narrow Edit view / Search query or native exclusions, then Apply view. No bypass state or fallback of rejected raw input is permitted. This adds no cache, session retention, indexing service or other-plugin acceleration.

Unload releases owned pins and callbacks independently, even if worker, UI or error reporting fails. It keeps the current display and does not set native options, update search or request a full native render: delayed engine work could otherwise execute after the guard is removed. A saved wrapper called after disposal does nothing. Subsequent host-owned updates after unload use native behavior and are outside this plugin guard. This intentionally replaces the former full-Overview refresh on unload.

Run node test.cjs for source regressions, including actual node/admitted-link/dangling-link boundaries, repeated rejection, valid recovery, projection/renderer/presentation failures and unload cleanup. Exact-source Station review, synthetic checks, installed state, native verification and publication are separate evidence. Local metadata is not release authority; public 0.1.5 remains the recorded release baseline. No install or publication follows from these tests.

The input-link budget counts every raw entry, including a link whose target is missing from the native node set. Admitted edge counts and visual projections still include only actual links between admitted nodes. This closes an unbounded dangling-link processing path without changing the numeric limits.

Limit checks walk own keys incrementally and stop at the first excess entry; they do not explicitly materialize unbounded Object.keys arrays. JavaScript engine enumeration internals remain host-owned. Control-triggered reprojection revalidates the current native object because native data may be mutated in place. This uses the existing projection index only; it adds no index service or retained graph copy.

Projection independently applies the same raw-link budget while reading visible nodes. It walks own links incrementally and reads each node link collection once, so accessor-backed data changing after validation cannot bypass the processing bound. Rejection still preserves the renderer display and supports a later valid update.

## First native render

The supported native global-graph creator is wrapped through its existing registry entry. The same instance-local input guard attaches after construction and before native onload. Native engine construction of graph data waits for its first existing native query to reach a stopped, empty, uncancelled state; startup setOptions cannot build an unfiltered graph before that query. No native prototype, vault, cache or indexing API is replaced. Startup native option notifications cannot overwrite saved mode presets; normal preference capture starts when scan finishes attaching the interface. Query errors keep startup rendering closed and a later valid query recovers.

A creator guard failure refuses the new view and destroys only a confirmed newly created, unreturned renderer. Factory descriptors and instance hooks are restored only while owned. A later interface/options failure keeps the input guard active. This does not protect host-owned rendering after the plugin is unloaded. Native acceptance must separately cover first input, saved graph restoration, both supported versions and settings preservation. Processing limits remain 100,000 nodes and 500,000 raw links.

Only the current startup query has an owned cancellation hook. Superseded or completed queue hooks are released immediately, avoiding retention of canceled queues and their file references. Prepared views keep their guard during delayed activation; their native close path independently disposes the controller.
