# Onepager

A Claude agent that turns a source PDF into an on-brand one-page PDF. It follows the brand in `brand/`, imitates the reference one-pagers in `examples/`, and lays the result out using one of several interchangeable templates.

## Quick start

```bash
npm install
cp .env.example .env                    # then set ANTHROPIC_API_KEY, or use `ant auth login`

npm run generate -- input/whitepaper.pdf                      # agent picks the template
npm run generate -- input/whitepaper.pdf --template two-column
npm run templates                                             # list available layouts
npm run render -- output/whitepaper/whitepaper.content.json   # re-render, no API call
```

The output goes to `output/<name>/`:

| File | Purpose |
|---|---|
| `<name>.pdf` | The finished one-pager |
| `<name>.content.json` | Content sidecar: template id, source, model, fit result and the structured content. Edit it by hand and `render` again to tweak copy for free. |
| `<name>.html` | The rendered HTML, for debugging layouts in a browser |

## Running it inside Claude Code

The repository includes a Claude Code setup (see `CLAUDE.md`), so you can produce one-pagers without an API key or any extra code:

| Asset | Use |
|---|---|
| `/onepager input/file.pdf [template]` | Skill: the full PDF → one-pager workflow |
| `/new-layout-template my-layout "description"` | Skill: scaffold a new layout following the sidecar contract |
| `/brand-check output/x/x.pdf` | Skill: brand and truthfulness checklist |
| `/import-figma-example [figma-url] [id]` | Skill: import a Figma design into `examples/` via the Figma MCP server (runs automatically when `examples/` is empty) |
| `onepager-designer` agent | Runs the onepager workflow in its own context ("use the onepager-designer agent on input/file.pdf") |
| `template-author` agent | Designs a new layout and verifies it with a sample render |
| `brand-reviewer` agent | Read-only QA of a rendered PDF against the brand and the source facts |

In this mode Claude writes `output/<name>/<name>.content.json` itself, and `npm run render` validates it against the template schema, renders it and reports `Fit: OK` or `Fit: OVERFLOW by ~N%`.

## Running it in Claude Code on the web (claude.ai/code)

The same agents and skills run in cloud sessions once the repo is on GitHub.

1. **Push the repo** to GitHub and open it at [claude.ai/code](https://claude.ai/code).
2. **Environment setup.** `.claude/settings.json` has a `SessionStart` hook that runs `scripts/cloud-setup.sh`: `npm ci`, Chrome for Testing, and a smoke-test render. It only does work in cloud sessions. To have it cached before sessions start, also set the environment's *Setup script* to the command below. The setup phase runs outside the repo directory and before a session exists, so the command locates the script itself, forces it to run, and never blocks the session if setup fails (the error then shows up in the session).

   ```bash
   f=$(find / -path '*/scripts/cloud-setup.sh' -not -path '*/node_modules/*' -print -quit 2>/dev/null || true); if [ -n "$f" ]; then ONEPAGER_FORCE_SETUP=1 bash "$f" || echo "onepager: setup failed (see above), continuing"; else echo "onepager: repo not found yet; the SessionStart hook will run setup"; fi
   ```
3. **Network access.** The default *Trusted* level covers npm. If the setup log says the Chrome download failed, switch the environment to *Custom* and allow `storage.googleapis.com`. Chrome runs without its sandbox automatically when the session is root.
4. **Source PDFs.** `input/` is not in git. Upload the PDF into the session; Claude copies it to `input/`.
5. **Getting results back.** `input/` and `output/` are empty in the repo (only `.gitkeep` is tracked). To hand a document back, Claude force-adds just its deliverable (`git add -f output/<name>/<name>.pdf` and its `.content.json`) on its work branch, and you download the PDF from that branch or pull request. Nothing generated lands on `main` unless you merge it.
6. **Figma import** works if the Figma connector is enabled for your claude.ai account.

Check rendering any time with `npm run check:chrome`.

## How it works

```
source.pdf ──► OnePagerAgent ──► content JSON ──► Handlebars ──► HTML ──► Puppeteer ──► PDF
                 ▲    ▲   ▲                                                  │
   brand.json ───┘    │   └── template.json (schema + guidance)              │
   examples/*/example.json                       fit check (overflow?) ◄─────┘
                                                 └─► revise in the same conversation (max 3 attempts)
```

1. **Template selection.** With `--template auto` (the default), a low-effort call reads the source and picks a template from the catalog built from every `template.json`.
2. **Writing.** The agent receives the brand, the examples (prompt-cached), the source PDF and the chosen template's sidecar. It returns JSON that is schema-constrained to that template's `contentSchema` (structured outputs).
3. **Fit loop.** The content is rendered. If the fixed-size `.page` overflows, the agent is told by how much and revises.

Architecture diagrams (C4 context, container, component and dynamic views, in Mermaid and PlantUML) are in [docs/c4](docs/c4/README.md).

## The sidecar pattern

Each asset carries a JSON sidecar that describes it to the code and to the agent. The agent and renderer never hardcode anything about a specific layout.

| Asset | Sidecar | What it declares |
|---|---|---|
| Layout template | `templates/<id>/template.json` | name, when to use it (`description`, `bestFor`), page setup, writing `guidance`, and the `contentSchema` the agent must fill |
| Brand | `brand/brand.json` | colors, font files, logos, voice and visual rules (mirrors `StyleGuide.txt`) |
| Example | `examples/<id>/example.json` | title, related template, notes on what makes it good, files |
| Output | `output/<name>/<name>.content.json` | everything needed to reproduce the PDF without the API |

### Adding a layout template

1. Create `templates/my-layout/` (the folder name is the template id).
2. Add `template.json` with `id`, `name`, `description`, `bestFor`, `entry`, `styles`, `page`, `guidance` and `contentSchema`. Copy an existing one as a starting point.
   - Structured outputs need every object to list all keys in `required` and set `"additionalProperties": false`. Express optional slots as "empty string / empty list", and put length limits in `description` and `guidance`.
3. Add `template.hbs`. It renders with `content`, `brand` and `logos` in scope, and wraps each sheet in `<main class="page">` so the fit check can measure it. The shared partials are `{{> brandHeader}}`, `{{> cta}}`, `{{> brandFooter}}` and `{{> bulletList items}}`.
4. Add `styles.css`, scoped with `.template-my-layout`. Brand tokens are available as `--color-*`, `--font-headline` and `--font-body`.
5. Add a `sample.content.json`, then preview it with `npm run render -- templates/my-layout/sample.content.json --out output/_samples/my-layout`.

It is picked up automatically, and no code changes are needed.

## Layout

```
CLAUDE.md               project memory for Claude Code (conventions, commands, rules)
.claude/
  agents/               onepager-designer · template-author · brand-reviewer
  skills/               onepager · new-layout-template · brand-check · import-figma-example
  settings.json         pre-approved render/validate commands; asks before the paid generate
brand/                  brand assets + brand.json sidecar
examples/               reference one-pagers, each with example.json
templates/
  _shared/              base.css + Handlebars partials used by every layout
  classic/              template.json · template.hbs · styles.css · sample.content.json
  two-column/
  stats-highlight/
  customer-guide/        built from the Figma customer-guide design (A4, typed blocks)
src/
  agent/                OnePagerAgent (Claude calls, fit/revise loop) + prompts/system.md
  core/                 sidecar loaders (brand, templates, examples) + pipeline
  render/               html.js (Handlebars) · pdf.js (Puppeteer + fit check)
  cli.js
input/ output/          working folders (git-ignored)
```

## Configuration

Settings come from environment variables. Copy `.env.example` to `.env` (git-ignored); `src/core/config.js` loads it automatically, and anything already set in your shell takes precedence. Only `npm run generate` needs credentials.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (unset) | Claude API key. Leave unset if you use `ant auth login` or another credential the SDK resolves; an empty value would shadow them. |
| `ANTHROPIC_BASE_URL` | API default | Optional proxy or gateway URL |
| `ONEPAGER_MODEL` | `claude-opus-5` | Model for template selection and content writing |
| `ONEPAGER_FALLBACKS` | `on` | Server-side refusal fallbacks; set `off` on Bedrock, Vertex or Foundry |
| `PUPPETEER_EXECUTABLE_PATH` | bundled Chrome | Use an installed Chrome/Chromium for rendering |
