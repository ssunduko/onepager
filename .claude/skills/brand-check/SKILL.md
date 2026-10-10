---
name: brand-check
description: Checklist for reviewing a rendered one-pager PDF (or a layout template) against the Salesmessage brand and the page-budget rules (multi-page layouts are allowed up to the template's maxPages). Use when asked to review, QA or brand-check a one-pager, or as the final step of the onepager and new-layout-template workflows.
argument-hint: <path to rendered .pdf> [path to .content.json]
allowed-tools: Read, Glob, Grep
---

# Brand check

Arguments: `$ARGUMENTS`. Read the PDF. If a `.content.json` sits next to it (or was passed in), read that too, along with the source PDF it names in `source`.

Ground truth: `brand/brand.json` and `brand/StyleGuide.txt`.

## Checklist

**Layout and fit**
- [ ] Within the template's page budget (`page.maxPages`), with no text clipped at the bottom or edges. On multi-page layouts, each page carries its page number and a section never splits across pages.
- [ ] The page is balanced: no empty band bigger than about 20% of the page height above the CTA. If there is one, the copy is too thin for this layout, so suggest adding content or a different template.
- [ ] Clear hierarchy: one H1, consistent section headings, readable body (nothing smaller than about 7.5pt).

**Brand**
- [ ] The logo is present and undistorted. Use the reversed (white) logo only on blue backgrounds.
- [ ] Typography: Inter everywhere. Headlines are Inter Bold and body text is Inter Regular (per `StyleGuide.txt`). Check the font names in the PDF; no other families should appear.
- [ ] Color: Figma palette only (`brand/StyleGuide.txt`). Salesmsg Blue `#24a5df` is the accent, headings are `#171c28`, body is `#525d6e`, panels are `#eaf6fd`. Green `#13cb6e` appears only on a single CTA button (sales templates) or as the `#e8f6ec` contrast-card tint.
- [ ] If an example in `examples/` uses the same template, the page should look like the same family: header, hero band, block styles and spacing.
- [ ] The company is called "Salesmessage".

**Copy**
- [ ] Outcome-led title; short sentences; active voice; no jargon or filler.
- [ ] Respects the template's word budgets (`templates/<id>/template.json` → `guidance`).
- [ ] Sales templates have exactly one call to action with a plausible URL. `customer-guide` pages have no sales CTA; the footer carries the website and support email.

**Truthfulness** (only when the source is available)
- [ ] Every number, customer name and quote appears in the source PDF. Quotes are verbatim.
- [ ] No claims are stronger than the source supports.

## Output

List each failed item as `severity (blocker / fix / nit) — what is wrong — where — suggested fix`, ordered by severity. If everything passes, say so in one line. Don't edit files during a check.
