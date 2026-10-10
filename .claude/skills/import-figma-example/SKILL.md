---
name: import-figma-example
description: Import a Figma design as a reference example into examples/ (page renders + example.json sidecar) using the Figma MCP server. Use when examples/ has no example folders, when the user shares a Figma link to use as a reference or style, or when asked to refresh examples from Figma. With no argument it imports every entry in examples/sources.json.
argument-hint: "[figma-url] [example-id]"
allowed-tools: Read, Write, Edit, Glob, Bash(node .claude/skills/import-figma-example/find-frames.mjs:*), Bash(curl -sSL -o examples/*), Bash(mkdir -p examples/*), Bash(file examples/*), mcp__claude_ai_Figma__get_metadata, mcp__claude_ai_Figma__get_screenshot, mcp__claude_ai_Figma__get_design_context, mcp__claude_ai_Figma__get_variable_defs, ReadMcpResourceTool
---

# Import a Figma reference into examples/

Arguments: `$ARGUMENTS`.
- With a URL, import that design. The optional second argument is the example id (kebab-case, e.g. `figma-onboarding-guide`).
- With no arguments, import every entry in `examples/sources.json` → `figma[]` that doesn't already have a folder in `examples/`.

If the Figma MCP tools are unavailable, stop and tell the user that the Figma server needs to be connected (`/mcp`). Don't invent an example.

## 1. Resolve the document and its pages

1. Parse the URL. `fileKey` is the segment after `/design/` (for `/design/:file/branch/:branchKey/`, use `branchKey`). `node-id=2811-6260` becomes nodeId `2811:6260`.
2. Call `get_metadata` with that nodeId. Links often point at a nested layer (a logo or a text box), not at the page.
3. If the node isn't itself a page-sized frame (A4 ≈ 1:1.414, Letter ≈ 1:1.294), find the enclosing document:
   - Call `get_metadata` with only `fileKey` to list the canvases. Then call it on the canvas that contains the node (usually `0:1`). The result is often too large and gets saved to a file; note the path.
   - Run `node .claude/skills/import-figma-example/find-frames.mjs <saved-file> <nodeId>`. It prints the ancestor chain, the document frame and its page frames (ids, names, sizes) as JSON on the last line.
4. Keep at most 6 pages. If there are more, prefer the linked page plus the most structurally different ones.

## 2. Export the page renders

For each page, call `get_screenshot` with `maxDimension` set to the page's longer edge (at most 2000). Download each URL right away (they're short-lived) with
`curl -sSL -o examples/<id>/page-<NN>-<slug>.png "<url>"`, after `mkdir -p examples/<id>`. Confirm with `file examples/<id>/*.png` that every file is a PNG of the expected size.

Never leave Figma asset URLs in any file; the renders must be local.

## 3. Extract the design language

1. Read the `figma-design-to-code` guidance first (`ReadMcpResourceTool`, server `claude.ai Figma`, uri `skill://figma/figma-design-to-code/SKILL.md`). Then call `get_design_context` on the linked page (or the first page) with `skillNames: "resource:figma-design-to-code"`. Also try `get_variable_defs`.
2. Read every downloaded page render.
3. Write down:
   - **Structure:** header, hero, block types, footer, and whether there's a CTA.
   - **Voice and density:** words per page, heading style, person.
   - **Tokens:** font families and weights, sizes in pt (for a 1191px-wide A4 frame, 1px = 0.5pt), and every distinct color with its role. Get gradients and card tints from the background or panel layers if needed.

## 4. Write `examples/<id>/example.json`

```json
{
  "title": "<document name> (<type>, <format>, <N> pages)",
  "template": "<closest template id in templates/, or omit>",
  "source": {
    "type": "figma",
    "url": "<original url>",
    "fileKey": "<fileKey>",
    "documentNodeId": "<id>",
    "pageNodeIds": ["<id>", "..."],
    "importedAt": "<YYYY-MM-DD>"
  },
  "notes": "<structure, block types, voice, density, tokens: what to imitate>",
  "files": ["page-01-....png", "..."]
}
```

If you imported from a URL that isn't in `examples/sources.json`, add it there so the import can be repeated later.

## 5. Compare with the brand and the templates; don't silently change them

- Compare the extracted tokens with `brand/brand.json`. Report differences (for example, "Figma uses #2b9be0 for links; StyleGuide says #24a5df") to the user. Don't edit `brand.json` or `StyleGuide.txt` without their confirmation.
- If no existing template can reproduce the design, recommend creating one with the `new-layout-template` skill (or the `template-author` agent), and mention the example id it should match.

## 6. Report

Give the example id, the pages imported, the key design traits, any brand discrepancies, and which template best matches it.
