# Diagrams

Rendered architecture diagrams embedded in [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).
Each `.mmd` is the source; each `.png` is a committed white-background render (all < 150 KB).

| Source | Render | Shows |
| --- | --- | --- |
| `runtime-overview.mmd` | `runtime-overview.png` | C4-ish runtime: build-time inputs → Vercel static output → browser runtime (theme script, bridge, vendored element, sound). |
| `build-pipeline.mmd` | `build-pipeline.png` | `pnpm build` + CI sequence, the pristine-tree gate, CI-only CV PDF render, deploy. |
| `content-pipeline.mmd` | `content-pipeline.png` | Seed / Ghost / snapshot sources converging on one mapper, `finalize()` and the page consumers. |
| `ghost-cutover.mmd` | `ghost-cutover.png` | Ghost mode state machine: seed → live → snapshot, with the cold-start throw and revert. |

## Re-render

mermaid-cli needs Chromium. Use a Playwright browser and pass it through a puppeteer config:

```sh
chromium="$(find ~/.cache/ms-playwright -name chrome -type f | head -1)"
printf '{ "executablePath": "%s" }\n' "$chromium" > /tmp/puppeteer.json

npx -y @mermaid-js/mermaid-cli \
  -i docs/diagrams/ghost-cutover.mmd \
  -o docs/diagrams/ghost-cutover.png \
  -p /tmp/puppeteer.json -b white --size 1800
```

mermaid-cli 12 uses `--size` (max width/height in px) instead of `-w`. Keep the background
white (`-b white`) and the `theme: 'base'` init block in each `.mmd`, or the committed PNGs will
drift in style from one another. Edit the `.mmd`, re-render, and commit both files together.
