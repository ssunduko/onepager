# Examples

Reference one-pagers the agent studies for tone, density and structure (never for facts).

Each example is a folder with an `example.json` sidecar next to the finished files:

```
examples/
  acme-dental-story/
    example.json      # { title, template?, notes, files: ["onepager.pdf"] }
    onepager.pdf      # .pdf, .png, .jpg or .webp
```

- `notes` matters most: say what makes the example good so the agent knows what to imitate.
- `template` is optional and tells the agent which layout the example corresponds to.
- Folders whose name starts with `_` (like `_example-template/`) are ignored.
- Every example is sent with each request (prompt-cached), so keep the set small: 2-5 strong examples.

## Importing from Figma

`sources.json` lists Figma designs to use as references. When this folder has no examples, the Claude Code workflow (`/onepager`, the `onepager-designer` agent) imports them automatically with the `import-figma-example` skill. That skill exports each page as a PNG via the Figma MCP server and writes `example.json` with a `source` block and design notes. You can also run it yourself:

```
/import-figma-example                                  # import everything in sources.json
/import-figma-example <figma-url> figma-my-example     # import a specific design
```

Current example: `figma-sms-credit-guide/`, the 5-page SMS Credit Calculation Guide, which the `customer-guide` template is built to match.
