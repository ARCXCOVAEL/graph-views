# Changelog

## 0.1.8

- First stable release. Adds Windows desktop support for Obsidian 1.15.1. Retains Windows desktop compatibility with Obsidian 1.14.4, 1.14.5, and 1.15.0.
- Each listed Windows version passed 45 native checks, cold restart, and preference carryover from 0.1.7 in synthetic vaults. On 1.15.1, the settled tag filter matched Obsidian’s native graph.

## 0.1.7 beta

- Add Windows desktop Obsidian 1.15.0 to the verified compatibility allowlist. Keep support for Obsidian 1.14.4 and 1.14.5.

## 0.1.6 beta — 2026-11-02

- Reject oversized native updates in every mode, keeping the last safe display or an empty display with actionable status.
- Attach the guard before the first native Graph update and wait for the initial native query to complete before graph data construction.
- Preserve view settings during startup, release obsolete query hooks, and retain protection across interface errors and delayed view activation.
- Keep the existing node/link limits, native renderer and Up/Down depth controls. No cache, indexing service or other-plugin dependency is added.

## 0.1.5 beta — 2026-11-01

- Add a copy-and-paste AI/AOS starter prompt for existing Graph Views settings and verification.
- Publish a fresh, verified distribution of the existing Graph Views runtime.
- Preserve the adjacent Up/Down depth controls, editable readout, view modes, tracing, folding and saved positions.
- Preserve existing settings, original notes and the supported Windows desktop versions.

## 0.1.4 beta — 2026-10-31

- Add adjacent Up (↑) and Down (↓) depth buttons beside the editable depth readout.
- Up moves one level toward the root (−1); Down explores one level deeper (+1), within the existing 1–12 range.
- Disable the controls at their limits and in Overview, including before the first graph data arrives.
- Preserve the existing graph renderer, note contents, settings format and supported Windows desktop versions.

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
