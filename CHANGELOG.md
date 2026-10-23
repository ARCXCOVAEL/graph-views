# Changelog

## 0.1.3 beta — 2026-10-22

- Extend the explicit desktop compatibility allowlist to Obsidian 1.14.5 alongside 1.14.4.
- Keep native capability checks and the unsupported-version refusal; no automatic support for future versions is implied.
- Preserve note contents, native graph identities, plugin ID, and existing settings format.
- Refresh the native renderer when any serialized projected graph field changes, including opaque node fields, link values and top-level native data.
- Obsidian 1.14.5 updates Electron with security fixes; upgrade the installer without removing the existing vault.


## 0.1.2 — Community submission metadata

- Remove the host application name from the manifest description to satisfy the Community directory scanner.
- Publish matching numeric-version manifest and release assets for directory discovery.
- Runtime code, native graph behavior and preference schema are unchanged from 0.1.1.

## 0.1.1 — Public beta

- Publish Graph Views under ARCXCOVAEL LLC's publisher/maintainer identity.
- Add MPL-2.0 distribution terms, retained historical notices, contribution guidance and source-availability information.
- Add a clean, reproducible beta package, issue templates and release checks.
- Preserve the existing six runtime modules apart from SPDX license comments. Graph behavior, stored settings schema and installed plugin ID are unchanged.

Verified compatibility remains desktop Obsidian 1.14.4. This beta does not claim additional platform or independent tester acceptance.
