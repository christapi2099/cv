# Pristine upstream baseline — do not edit

This directory is a **verbatim** copy of the Temporal Drift v2 extraction
(`wormhole/`, `README.md`, `SPEC.md`, `SPEC-v2.md`, `tests/*.js`). It exists so
`VENDOR_PATCHES.md` and CI can review the vendored effect as a diff:

```sh
git diff --no-index src/vendor/wormhole.upstream/wormhole src/vendor/wormhole
```

must show exactly the three patches documented in
`src/vendor/wormhole/VENDOR_PATCHES.md`. The layout keeps the original
`wormhole/` subdirectory because the upstream tests import
`../wormhole/config.js` and must run unchanged.

- **Built copy:** `src/vendor/wormhole/` (the only copy Vite bundles).
- **Upstream tests:** `tests/` (Node's `node:test`; Python/browser harnesses
  were left in the extraction, not copied).
- **Never edit this directory.** Patch the built copy instead and record the
  change in `VENDOR_PATCHES.md`.
