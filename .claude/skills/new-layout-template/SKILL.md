---
name: new-layout-template
description: Scaffold and design a new one-pager layout template under templates/ that follows the sidecar contract (template.json + template.hbs + styles.css + sample.content.json). Use when the user wants another layout, a variant of an existing one, or a template matching a reference design in examples/.
argument-hint: <template-id> [short description of the layout]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm run templates:*), Bash(npm run validate:*), Bash(npm run render:*), Bash(mkdir:*)
---

# Add a layout template

Arguments: `$ARGUMENTS`. The first argument is the new template id (kebab-case); the rest describes the layout.

## 1. Study what exists

- Read `templates/_shared/base.css` and every partial in `templates/_shared/partials/` (`brandHeader`, `cta`, `brandFooter`, `bulletList`). Reuse them rather than re-creating headers, CTAs or footers.
- Read one existing template end to end, for example `templates/two-column/`, to copy its conventions.
- Read `brand/brand.json` for the color and font tokens.
- If the user pointed at a reference in `examples/`, read it.

## 2. Create the four files in `templates/<id>/`

**`template.json`** (the sidecar). Required fields:
- `id`: must equal the folder name.
- `name`, `version` (`"1.0.0"`), `description` (what the layout looks like), `bestFor` (which source documents it suits; the agent uses this to pick a template).
- `entry: "template.hbs"`, `styles: ["styles.css"]`, `page: { "format": "Letter" | "A4", "landscape": false, "maxPages": 1 }`.
- `guidance`: word budgets per slot plus a total word budget.
- `contentSchema`: JSON Schema that is compatible with structured outputs. Every object has all keys in `required` and `"additionalProperties": false`. Use only `type`, `properties`, `items`, `enum` and `description`. Put length limits in `description`, never `maxLength`/`maxItems`. Reuse the same `cta` object shape as the other templates so the `{{> cta}}` partial works.

**`template.hbs`**: the root element must be `<main class="page">`; the fit check measures it. Data in scope: `content`, `brand`, `logos`. Use `{{> brandHeader}}` (pass `reversed=true` on dark backgrounds, `noEyebrow=true` to hide the header eyebrow), `{{> cta}}`, `{{> brandFooter page=… pages=…}}` (logo, website / phone, social icons, page number), `{{> infoCallout title=… text=…}}` and `{{> bulletList someArray}}`. Shared classes in `base.css`: `.hero-band` (Figma radial hero background), `.pill` (topic label), `h1 .accent` (blue payoff words). Put `<div class="spacer"></div>` before the CTA so the CTA and footer sit at the bottom. Helpers: `eq`, `hasItems`.

**`styles.css`**: prefix every selector with `.template-<id>`. Use `var(--color-primary|primaryDark|cta|ink|muted|navy|surface|heroTint|border|white)`, `var(--font-display)` (hero headline), `var(--font-headline)` and `var(--font-body)`. Set `--page-margin` on the template root so the shared footer lines up. Never use raw hex values; derive shades with `color-mix()`. Green (`--color-cta`) is only for the CTA button.

**Leftover space:** don't leave one empty band above the footer. Spread spare space between the content sections with a rule scoped to `:root:not(.fit-measure)`, e.g. `.page > .spacer { flex: 0 0 0 }` plus a growing content wrapper with `justify-content: space-evenly`. The renderer measures fit with `.fit-measure` on `<html>`, so free-space reporting stays honest. See the end of `templates/classic/styles.css`.

**`sample.content.json`**: `{ "template": "<id>", "sample": true, "content": { ... } }`. Use placeholder copy at the upper end of the word budgets, so the sample shows the worst-case fit.

## 3. Verify

1. Run `npm run templates`; the new id must be listed.
2. Run `npm run render -- templates/<id>/sample.content.json --out output/_samples/<id>`. It must print `Fit: OK`.
3. Read `output/_samples/<id>/sample.pdf` and check it against `.claude/skills/brand-check/SKILL.md`. Iterate on the CSS until the page is balanced and nothing is clipped.

## 4. Report

Give a short description of the layout, when the agent should pick it, and the sample PDF path. No code changes outside `templates/<id>/` should be needed. If you needed one, explain why.
