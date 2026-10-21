# Graph Views maintenance

The native global Graph remains the data source and renderer. There is no custom ItemView, graph canvas, organization database or file-content writer. No dependency on another plugin is permitted. Personal roots/configuration belong only in installed data.json.

| Module | Functions and responsibility |
| --- | --- |
| projection.cjs | id validates identifiers; index builds bounded native directed/undirected adjacency; reach traverses roots with depth/folds; shortest traces real connections; branchColors colors first-reached branches; project returns a visibility/color projection preserving real edges and original identities |
| config.cjs | options validates the observed native contract; defaults is portable; normalize bounds presentation state; seed captures original native presets once; renamed follows path identity changes; clone copies plain settings |
| storage.cjs | SettingsStore storage/target/bytes validate fixed local storage, read preserves malformed inputs, temporary/cleanup own temporary files and locks, save compares loaded bytes under a cooperative lock and atomically retains previous state |
| runtime.cjs | capabilities refuses incompatible native instances; hook restores only an owned callback; NativeGraph wraps native setData/click/worker/options callbacks, projects live native data, switches presets, manages selection/folds/trace/native pins and restores native behavior on dispose |
| ui.cjs | PickNote chooses existing admitted originals; EditView holds drafts until Apply; Guide renders the shipped guide; Settings configures roots/following; ownModal closes only owned dialogs on unload; attach/paint place controls above the native canvas and display bounded status; CSS is plugin-owned and removed on unload |
| main.cjs | onload checks exact compatibility and registers scoped lifecycle events; scan skips deferred tabs and owns loaded global graph controllers; commit/saveSoon persist only settings; changeMode/applyAll/renderAll coordinate panes; onunload removes hooks/timers and restores Overview |
| build.cjs | Builds a self-contained CommonJS bundle and four portable files into a new absolute directory, then hashes them; no personal state read or dependency download |
| test.cjs | Synthetic projection/hook/storage regressions; temporary test directory is owned and removed; no installed-vault/network access |

Native internal interfaces are verified on desktop1.14.4: dataEngine getOptions/setOptions/updateSearch/render/onOptionsChange, renderer setData/onNodeClick/nodeLookup/nodes and worker postMessage forceNode protocol. Keep the exact version guard until actual native acceptance on another version. Runtime capability checks are an additional gate, not proof of cross-version compatibility.

Constructor setup rolls back all previously installed hooks if a later callback cannot be attached. Per-instance wrappers restore their previous descriptors only when still owned. Do not replace global prototypes or vault/index/cache APIs. On projection error, pass raw native data through and stop projection for that pane until reload. Mode changes use the original native options/search pipeline. No render interval is introduced; unchanged data signatures skip native setData. ResizeObserver only resizes the native canvas when its content bounds change.

Keep tests meaningful: shared-note folds, cycles, incoming links, all-visible cross-link provenance, no phantom disconnected trace, click pass-through, pins/native drag/unload, external-settings conflicts and directory swaps. Separately test actual native canvas identity, interactions, live external writes/renames, mode persistence and unload/restart. Unit tests and screenshots alone do not prove installation or human usability.

Storage protects cooperative writers and detects observed linked/swapped paths. Windows lacks complete descriptor-relative filesystem operations; this is not isolation from a malicious same-user process. It writes only fixed own settings/recovery/temporary/lock files. It never changes native graph settings files directly; native controls own their persistence.

Build with Node: `node test.cjs`; `node build.cjs /absolute/path/to/new-output`. Copy the seven built files, preserving existing data.json. For rollback disable Graph Views first; retain settings/recovery, then remove only the plugin's own enabled entry and directory. Do not disable the separate Early Filter as a graph rollback. Extending actual note-link editing later requires a separate design, conflict-safe original writes, review and undo acceptance.

## Public beta ownership and packaging

ARCXCOVAEL LLC is the publisher and maintainer. This source is MPL-2.0; retain THIRD_PARTY_NOTICES.md. Public source is exported from the private canonical project through a strict file allowlist; private repository history, maintenance evidence, settings and other products are not release inputs. The public repository is the contribution surface; reconcile accepted contributions into the canonical source before the next export.

The manifest stays numeric (0.1.1); GitHub marks the release as a prerelease and the title/docs say beta. The exact native compatibility guard remains 1.14.4. `build.cjs` emits seven portable files including license and notices. `release-check.cjs` validates public metadata, source boundaries and packaged legal files; it checks the published beta intent without reading any installed settings.

Before publishing, run `node release-check.cjs /absolute/package /absolute/public-source`. The export gate rejects unexpected files/directories, links and byte differences against the exact22-file allowlist; Git metadata is not source and is excluded. Separate publication checks must verify that Git history contains only the clean exported root and that commit author email uses the public no-reply address. Focused tests cover an exact export, added private settings and altered bytes.
