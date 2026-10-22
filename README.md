# Graph Views

**Public beta · created and maintained by ARCXCOVAEL LLC.**

Give Obsidian's existing graph three useful views without creating a separate graph or duplicating your notes.

| View | Purpose |
| --- | --- |
| Overview | Explore everything admitted by your native graph settings. |
| Focused Writing | Work around chosen notes and their incoming/outgoing connections. |
| Structure | Follow the real links in your contents or index notes, keeping shared branches and cross-links. |

Shift-click to select nodes, trace existing connections, fold Structure branches, and pin native node positions. Compose queries in **Edit view**, then apply them once instead of executing each keystroke.

## Compatibility

Version **0.1.2 beta** supports **desktop Obsidian 1.14.4 only**. It uses undocumented native graph internals and deliberately refuses integration on other versions. Other desktop versions, operating systems and Android/iOS are not validated. The Graph core plugin must be enabled. Native Local Graph is unchanged.

This is an independently developed community addition, not an official Obsidian product. No account, service, network access or other plugin is required.

## Install the Beta

### Community Plugins (recommended)

1. Save your work and keep an ordinary vault backup.
2. In Obsidian, open **Settings → Community plugins → Browse**.
3. Search for **Graph Views** by **ARCXCOVAEL LLC**.
4. Select **Install**, then **Enable**.
5. Open the native Graph view. The Graph Views toolbar appears above the existing canvas. Choose a root note to try Focused Writing or Structure.

You can also find Graph Views on its [Community Plugins page](https://community.obsidian.md/plugins/graph-views).

### Manual installation from GitHub

1. Save your work and close Obsidian. Keep an ordinary vault backup.
2. Download **Graph-Views-0.1.2-beta.zip** from this product repository's [Releases page](https://github.com/ARCXCOVAEL/graph-views/releases).
3. Extract its `graph-views` folder into your vault's `.obsidian/plugins/` directory.
4. Reopen Obsidian and enable **Graph Views** under Settings → Community plugins.
5. Open the native Graph view. The Graph Views toolbar appears above the existing canvas. Choose a root note to try Focused Writing or Structure.

For a manual update, replace only the seven distributed files; preserve your own `data.json`, `data.json.previous` and any lock evidence.

[Full guide and recovery](GUIDE.md) · [Changes](CHANGELOG.md) · Report a problem using this product repository's **Issues → Bug report** form

## Your files and privacy

Graph Views reads admitted native graph data and note paths to display connections. It writes only its own presentation preferences, root paths, folds and pin coordinates. It does not rewrite original notes, generate folder indexes, send telemetry, make network requests or start a background service. Existing vault exclusions remain authoritative.

Plugin settings can reveal note paths. Review diagnostics before posting them; do not upload your vault or settings file. See [Security and data handling](SECURITY.md).

## Beta limits

The three global views share mode/settings; selection and temporary traces belong to each pane. Large graphs can still be expensive. Native graph controls retain their immediate-query behavior. Graph-side editing of actual note links and mobile support are future work. Another person's installation, readability and interaction feedback are still needed.

Disable Graph Views to restore native graph behavior, retaining its settings for recovery. Keep it disabled when upgrading Obsidian until that version is explicitly verified.

## Source and license

The source for this beta is provided in this repository under the [Mozilla Public License 2.0](LICENSE). Distributed changes to covered files must meet the MPL's source-availability requirements; private modifications do not require publication. See [retained notices and dependencies](THIRD_PARTY_NOTICES.md).

Build without downloads using Node.js 22 or later: `node test.cjs`, then `node build.cjs /absolute/path/to/new-output`. See [development](DEVELOPING.md) and [contributing](CONTRIBUTING.md).
