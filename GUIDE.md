# Graph Views beta guide

Created and maintained by ARCXCOVAEL LLC. Version 0.1.2 beta; desktop Obsidian 1.14.4 only.

## Start with your existing graph

Requires desktop Obsidian1.14.4, native Graph enabled, and Graph Views enabled. Open Graph view normally. A Graph Views toolbar appears above the **same native canvas**. Your file explorer, original notes and native graph controls remain available.

Use the mode dropdown. All open global Graph panes share mode/settings; selections and temporary path traces belong to each pane. Native Local Graph remains unchanged.

| Mode | What you see | Use it for |
| --- | --- | --- |
| Overview | Every node/link admitted by the native graph's current query/settings and vault exclusions | Explore the growing vault without a permanent hierarchy |
| Focused Writing | Your chosen note(s), their incoming/outgoing connections and neighboring branches to the selected Depth | Think and write around a subject while retaining real links to the wider vault |
| Structure | Existing Home/contents/index roots, following their outgoing links to the selected Depth; immediate branches receive colors | Explore the organization you actually linked, with cross-links and branching retained |

Structure uses the table of contents **you already express through note links**. It does not infer a new organization from folders or headings. Shared notes appear once and keep all visible cross-links. A note's displayed native label/identity is never renamed by this plugin. Generated folder indexes remain ordinary existing notes; Graph Views does not generate additional ones.

## Choose and expand a subject

1. Click **Choose root**, type a note's name/path, and choose the existing note. In Overview this starts Focused Writing; in Structure it changes the Structure root.
2. Increase **Depth** (1–12) to reveal more real connections. The status reports visible nodes/links and connections continuing outside the current view.
3. Shift-click one or more native graph nodes to select them. **Focus selection** or **Structure selection** uses those exact nodes as roots. Normal clicks still open the original note; native modifier behavior otherwise remains unchanged.
4. In Structure, select a branch and click **Fold / unfold selected**. Traversal stops there. A shared note can remain visible through another unfolded branch. **Unfold all** restores traversal.

Focused Writing can follow the note you open: enable **Settings → Graph Views → Follow active note**. Choosing a root/selection turns following off to keep that context steady. Open a note in another pane to change the active subject. To use multiple Structure roots, enter one exact existing path per line in Settings and Save preferences. A missing or filtered root is reported; no fake node is created.

## Trace and arrange the web

Shift-click exactly two nodes, then **Trace path**. The graph shows a shortest connection already present in the admitted native data, in either link direction. It does not invent a relationship. **Clear selection / trace** returns to the selected view. Depth expansion and choosing another root also leave the temporary trace.

Shift-click nodes and **Pin selected** to hold their current native layout positions. Drag a pinned node normally to change its saved position. **Release selected pins** lets native forces move it again. Pins are shared across modes and saved in this plugin's preferences, not in notes. Native dragging of unpinned nodes is unchanged.

## Edit queries without running each keystroke

1. Click **Edit view**. Compose the full search/group queries, choose colors and adjust display/force values in the dialog.
2. Click **Apply view** once. The native engine evaluates the completed queries. Cancel discards the draft.
3. Each mode remembers its own native query/groups/display/forces. Overview initially captures your existing native preferences. Switching back restores that preset.

Existing native graph controls remain usable and keep their original immediate-query behavior. Edit view is the safer place to type a query on a large vault. Structure's automatic branch colors and selection/trace colors can override query-group colors within that mode; original group definitions remain saved. Filters never grant access to a path excluded by your vault's indexing/filter policy.

## Live originals, editing and renaming

Edit, create, link, move and rename notes through Obsidian or another application normally. Native vault/metadata events refresh the graph; Graph Views projects the new native data. Root/pin/fold paths follow native file/folder rename events. It creates no copies and runs no directory crawler, background service or network requests. Graph-side editing of actual note links is future work; use the original note editor today.

## Recovery and compatibility

If a view is empty, check its root paths, Depth and Edit view query, then try Overview. A root filtered out of native data cannot appear. Overview means the currently admitted native graph, not excluded technical/cache/backup directories.

If a native integration error appears, that pane falls back to native data and reports the error. Disable Graph Views and reopen native Graph. Disabling releases this plugin's pins, removes its toolbar/hooks and restores the latest Overview preferences. Early filtering and your notes are independent.

Before upgrading Obsidian, disable Graph Views until the new version is tested. A version mismatch does not patch native graph internals. The plugin intentionally has a narrow verified version boundary; its hooks are per-instance rather than global prototype changes.

Preferences live only in this plugin's data.json, with data.json.previous as the prior successful save. Malformed, externally changed or locked preferences are refused rather than overwritten. Close Obsidian, retain both files plus any lock, inspect the conflict, and restore a validated copy if needed. Never blindly delete a lock while another instance is running. Notes and native graph data are not recovery inputs for these preferences.

To share: give a tester only the clean package's seven files, including LICENSE and THIRD_PARTY_NOTICES.md. Do not include your data.json, vault registry, notes, private exclusions or other applications' private state. Friend testing and human acceptance of layout/readability remain separate from developer checks.
