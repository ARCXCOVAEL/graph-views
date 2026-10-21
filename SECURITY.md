# Security and data handling

Graph Views 0.1.1 beta supports desktop Obsidian 1.14.4 only.

It reads native graph data, file paths and its own guide/preferences. It writes only its own preferences, previous-save copy, temporary files and cooperative lock. It makes no network requests, contains no telemetry and requires no account. It does not write original notes or change vault filtering.

Like other desktop Obsidian plugins, it runs with the application's privileges; these narrow intended operations are not a security sandbox. Native internals may change after an Obsidian update. Disable Graph Views before updating to an unverified version.

Settings may contain personal paths, queries and pin locations. Do not post data.json, vault contents, credentials or unredacted logs. Preserve malformed/conflicting preferences rather than replacing them blindly. The guide explains recovery.

For a security concern, use GitHub's **Report a vulnerability** feature when available. If unavailable, open a minimal issue requesting a private reporting route without publishing exploit details or private data. No dedicated security email or response-time guarantee is advertised.
