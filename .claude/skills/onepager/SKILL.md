---
description: Turn a source PDF into a branded Salesmessage PDF (one page, or more when the template allows) using the layout templates in templates/. Use when the user asks to make, create or generate a one-pager, sales sheet, brief or case study from a PDF, or runs /onepager <pdf> [template-id].
argument-hint: <source.pdf> [template-id|auto]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm run templates:*), Bash(npm run validate:*), Bash(npm run render:*), Bash(mkdir:*), Skill(import-figma-example)
---

# PDF → branded one-pager

Arguments: `$ARGUMENTS`. The first argument is the source PDF; the optional second is a template id (default `auto`).

Work through the steps in order. The sidecar files are the contract, so read them; don't guess layout details.

## 1. Read the inputs

1. **Source PDF.** Read the whole file. For PDFs over 10 pages, read in `pages` ranges of up to 20 pages. Note the audience, the core promise, concrete numbers, customer names, verbatim quotes and any URL to use as the call to action.
2. **Brand.** Read `brand/brand.json` and `brand/StyleGuide.txt`.
3. **Examples.** Glob `examples/*/example.json` (skip folders starting with `_`).
   - **If there are none,** import the Figma references listed in `examples/sources.json` first by following the `import-figma-example` skill (`.claude/skills/import-figma-example/SKILL.md`). If the Figma MCP server isn't connected, tell the user and continue without examples, relying on the brand and the template guidance alone.
   - Read each sidecar and every file it lists. Take tone, density, structure and visual style from them, never facts.

## 2. Choose the layout

Run `npm run templates`. If no template id was given (or it is `auto`), pick the one whose `bestFor` best matches the source:

- `customer-guide` for customer-facing explainers, onboarding, how-to, billing or rate references and FAQs. This is the house style from the Figma example; prefer it whenever the reader is an existing customer.
- `stats-highlight` only if the source has at least 2–3 real metrics and the goal is to sell.
- `two-column` for dense, fact-heavy sales or partner material.
- `classic` for narrative product overviews.

If an example's `template` field names a template, the example shows what that template should look like when done well.

Then read `templates/<id>/template.json` in full. Its `guidance` and the `description` of every field in `contentSchema` are word budgets you must respect.

## 3. Write the content sidecar

Create `output/<name>/<name>.content.json`, where `<name>` is the source file name without its extension:

```json
{
  "template": "<id>",
  "source": "<absolute path to source PDF>",
  "model": "claude-code",
  "generatedAt": "<ISO timestamp>",
  "content": { "...": "exactly the shape of contentSchema" }
}
```

Writing rules:
- Every fact, number, name and quote must come from the source. Leave optional slots the source cannot fill as `""` or `[]`.
- Headlines are short and outcome-led. Body copy is plain and concrete. Follow the voice in `brand.json`.
- Include every `required` key and no extra keys.
- For the CTA URL, use a link from the source, or else the brand `website`.

## 4. Render and fit

Run `npm run render -- output/<name>/<name>.content.json`.

- If it prints schema errors, fix the JSON and run it again.
- The render prints `Fit: OK (N pages; free space at bottom: p1 x%, ...)` or `Fit: OVERFLOW: page 2 overflows by ~N%; ...`.
- **Extra pages are fine.** If the template allows more than one page (`page.maxPages` > 1) and important content doesn't fit, move whole sections to the next page or add a page. Do that before cutting facts a reader would miss, but never pad.
- On a single-page template, or once you're at `maxPages`, cut about N% of the words on the overflowing page: shorten body copy first, then drop the weakest bullets or items.
- Balance the pages. Every page except the last should be nearly full (free space at most ~15%), and the last page should be at least half full (free space at most ~50%). If the last page is mostly empty, pull its content back or rebalance.
- Never change CSS or fonts to make content fit. Stop once it prints `Fit: OK` with balanced pages. If it still doesn't fit after 4 rounds, report that.

## 5. Look at the result

Read the rendered `output/<name>/<name>.pdf` and check it visually against `.claude/skills/brand-check/SKILL.md`: no clipped text, balanced pages without large empty gaps, and at most one green CTA. If something is off, revise the content and render again.

## 6. Report

Reply with the template used and why, the PDF path, and any facts you deliberately left out or slots you left empty.
