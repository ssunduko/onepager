# onepager

Turns a source PDF into a branded **one-page PDF** for Salesmessage. The brand lives in `brand/`, reference one-pagers in `examples/`, and layouts in `templates/`. Layouts are interchangeable and are described by JSON **sidecars** (see below).

There are two ways to run it, and both share the same templates and renderer:

- **Inside Claude Code**: the `onepager-designer` subagent or the `/onepager` skill. Claude reads the PDF, writes the content JSON and renders it. No API key needed.
- **Standalone**: `npm run generate -- <pdf>` runs `src/agent/onepagerAgent.js` against the Claude API (needs `ANTHROPIC_API_KEY`).

## Commands

```bash
npm run templates                                   # list layouts (id, name, description)
npm run validate -- <file>.content.json             # check content against the template's contentSchema
npm run render   -- <file>.content.json [--out dir] # validate, render HTML+PDF, report "Fit: OK (N pages; free space …)" or "Fit: OVERFLOW: page N overflows by ~X%"
npm run generate -- <source.pdf> [--template id|auto]  # standalone API agent (costs money; ask before running)
```

## Sidecar pattern (the core convention)

Every asset has a JSON sidecar next to it. Code and agents read the sidecar and never hardcode layout details.

| Asset | Sidecar | Declares |
|---|---|---|
| Layout | `templates/<id>/template.json` | `id` (= folder name), `name`, `description`, `bestFor`, `entry`, `styles`, `page`, `guidance`, `contentSchema` |
| Brand | `brand/brand.json` | colors, font files, logos, voice, visual rules (mirrors `brand/StyleGuide.txt`) |
| Example | `examples/<id>/example.json` | `title`, `template?`, `source?` (Figma origin), `notes`, `files` |
| Example sources | `examples/sources.json` | Figma links that are imported into `examples/` when it has no examples |
| Output | `output/<name>/<name>.content.json` | `{ template, source, model, generatedAt, content }`; `content` must match the template's `contentSchema` |

Folders starting with `_` (`templates/_shared`, `examples/_example-template`) are shared or scaffolding and are never treated as a template or example.

## Rules

- **Facts come only from the source PDF.** Examples set tone, density and structure, never facts. Never invent metrics, customers or quotes; leave optional slots empty (`""` / `[]`).
- **Page budget.** Every printed page is a fixed-size `<main class="page">`, and `template.json` → `page.maxPages` sets how many a layout may use. Multiple pages are fine when content doesn't fit (user decision, 2026-10-08), but don't pad: every page except the last should be nearly full, and the last at least half full. On OVERFLOW, move content to another page (if allowed) or shorten copy; never shrink fonts or edit CSS to make it fit. Multi-page templates take a `pages[]` array in their content (see `two-column`).
- **Examples come from Figma when missing.** If `examples/` has no example folders, run the `import-figma-example` skill before writing. It uses the Figma MCP server (`mcp__claude_ai_Figma__*`) to export page renders and write `example.json`. Never leave temporary Figma asset URLs in the repo, and report Figma vs. brand differences instead of silently editing `brand.json`.
- **Brand:** hero headlines in Product Sans Bold (`var(--font-display)`, falls back to Inter Bold) with the last words in blue (`h1 .accent`), section headings in Inter Bold (`var(--font-headline)`), body in Inter. Colors are the Figma values (see `brand/StyleGuide.txt`): Salesmsg Blue `#0180f4` is the accent, ink `#121517` for headings and body, gray `#667085` only for footer/meta, navy `#023359` for callouts, panels `#f0f8ff`. Green `#13cb6e` is only for a single CTA button. Use brand tokens (`var(--color-*)`, `var(--font-*)`), never raw hex values, in template CSS.
- **Schemas** (`contentSchema`) must stay compatible with Claude structured outputs: every object lists all keys in `required` and sets `"additionalProperties": false`. Put length limits in `description` or `guidance`, not in `maxLength`/`maxItems`.
- Templates spread leftover page space between sections (rules under `:root:not(.fit-measure)`). The renderer measures fit with `.fit-measure` set, so reported free space reflects the natural layout.
- Template CSS is scoped with `.template-<id>`. Shared styles live in `templates/_shared/base.css`, and shared markup in `templates/_shared/partials/*.hbs` (`brandHeader`, `cta`, `brandFooter`, `infoCallout`, `bulletList`).
- Code is Node ESM (`"type": "module"`), with no build step and no TypeScript. Match the existing style: small modules and JSDoc on exported functions.
- `input/` and `output/` are git-ignored working folders.

## Architecture docs

C4 diagrams live in `docs/c4/` in two formats (`mermaid/*.mmd`, `plantuml/*.puml`) with rendered SVGs in `docs/c4/rendered/`. When you add an agent, skill, template capability or external system, update both formats and re-render (commands in `docs/c4/README.md`).

## Cloud sessions (Claude Code on the web)

- `scripts/cloud-setup.sh` runs from the `SessionStart` hook. It installs dependencies and Chrome and renders a smoke test, and does nothing locally. If rendering fails, run `npm run check:chrome` for a diagnosis.
- Uploaded source PDFs: copy them into `input/` (git-ignored) before running the onepager workflow.
- `input/` and `output/` are empty in the repo; only their `.gitkeep` files are tracked, and everything else in them is git-ignored.
- Deliverables leave the session through the orphan `deliverables` branch, never through work branches or `main`: run `bash scripts/publish-deliverable.sh output/<name>` (it publishes that folder's `.pdf` and `.content.json` files and prints the GitHub link). That branch shares no history with `main`, so it can't be merged.
- Never `git add -f` anything under `input/` or `output/`. The `No generated files` GitHub check fails any push or PR that does.
- `.content.json` `source` paths are relative to the project root (e.g. `input/Foo.pdf`).

## Claude Code assets

- `.claude/agents/onepager-designer.md`: produces a one-pager from a PDF end to end.
- `.claude/agents/template-author.md`: designs and adds a new layout template.
- `.claude/agents/brand-reviewer.md`: read-only review of a rendered PDF against the brand.
- `.claude/skills/onepager/`: the PDF → one-pager workflow (`/onepager <pdf> [template]`).
- `.claude/skills/new-layout-template/`: scaffolds a template that follows the sidecar contract.
- `.claude/skills/brand-check/`: the brand checklist used for reviews.
- `.claude/skills/import-figma-example/`: imports a Figma design into `examples/` (page PNGs + `example.json`). `find-frames.mjs` locates the page frames around a linked node.

## Templates

`classic`, `two-column` and `stats-highlight` are sales layouts (Letter, green CTA). `customer-guide` reproduces the Figma customer-guide house style (A4, no CTA) and is composed from typed `blocks`. Its reference is `examples/figma-sms-credit-guide`.

Since 2026-10-08 the Figma design system is the brand source of truth, recorded in `StyleGuide.txt` and `brand.json`; the 2026-10-13 refresh (Figma One-Pagers file) brought the brighter blue, ink body copy, the radial hero band with pill label and two-tone headline, the info-icon callout and the logo/contact/social footer to every template. The logo is `brand/logo/salesmsg-logo-blue.svg` and icons live in `brand/icons/`. Product Sans isn't bundled (it's proprietary); install it locally or the hero headline falls back to Inter Bold. The Neue Einstellung font files in `brand/fonts/` are no longer used. Template CSS uses only `var(--color-*)` tokens; shades are derived with `color-mix()`, never new hex values.
