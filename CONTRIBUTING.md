# Contributing to Graph Views

Thank you for helping test and improve Graph Views, maintained by ARCXCOVAEL LLC.

## Test and report

Start with the tested Windows desktop Obsidian 1.14.4 or 1.14.5 and the bundled guide. Report the plugin/Obsidian versions, operating system, steps, expected behavior and actual behavior. Small synthetic note examples are more useful than a private vault. Redact note names, paths, queries and screenshots before posting. Use the repository's issue templates.

## Source changes

Use Node.js 22 or later; no dependency download is needed. Run `node test.cjs` and `node build.cjs /absolute/path/to/new-output`. Preserve native graph identity and note contents. Add focused regressions for changed behavior, explain compatibility and recovery, and send a small pull request. Do not use runtime tests that access a contributor's real vault.

Changes to covered files are submitted under MPL-2.0. Retain existing notices and identify the origin and license of external material. Submit only material you are entitled to contribute. Disclose substantial AI assistance and review generated changes yourself. Contributions do not transfer copyright ownership to ARCXCOVAEL LLC; a separate agreement would be needed for any assignment. No exclusive rights in third-party or purely machine-generated material should be asserted.

## Compatibility

Source tests alone do not establish compatibility with a new Obsidian version. Keep the exact-version runtime guard until native integration, settings preservation, rename behavior and unload/restart have been verified.
