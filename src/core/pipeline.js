import fs from 'node:fs/promises';
import path from 'node:path';
import { OnePagerAgent } from '../agent/onepagerAgent.js';
import { renderHtml } from '../render/html.js';
import { describeFit } from '../render/fit.js';
import { PdfRenderer } from '../render/pdf.js';
import { loadBrand } from './brand.js';
import { loadExamples } from './examples.js';
import { config } from './config.js';
import { DIRS, ROOT } from './paths.js';
import { getTemplate, loadTemplates } from './templates.js';

/**
 * Source PDF → (agent) template content → HTML → PDF.
 * Writes three files to outDir: <name>.pdf, <name>.html and the <name>.content.json
 * sidecar, which records the content and template so the PDF can be re-rendered later.
 */
export async function generateOnePager({ pdfPath, templateId = 'auto', outDir, examplesDir, log = console.log }) {
  const name = path.basename(pdfPath, path.extname(pdfPath));
  outDir ??= path.join(DIRS.output, name);
  await fs.mkdir(outDir, { recursive: true });

  const [brand, examples, templates] = await Promise.all([loadBrand(), loadExamples(examplesDir), loadTemplates()]);
  log(`Loaded ${templates.length} template(s), ${examples.length} example(s).`);
  if (!examples.length) {
    // The Figma MCP server is only reachable from Claude Code, so the import runs there.
    log('No examples found. Import the Figma references in examples/sources.json by running /import-figma-example in Claude Code.');
  }

  const agent = new OnePagerAgent({ brand, examples, log });
  const chosenId = templateId === 'auto' ? await agent.selectTemplate({ pdfPath, templates }) : templateId;
  const template = templates.find((t) => t.id === chosenId) ?? (await getTemplate(chosenId));

  const files = outputFiles(outDir, name);
  const renderer = await new PdfRenderer().open();
  try {
    const { content, fit, attempts } = await agent.writeContent({
      pdfPath,
      template,
      evaluate: (content) => renderTo(renderer, { template, brand, content, files }),
    });

    await writeContentSidecar(files.content, {
      template: template.id,
      source: path.relative(ROOT, path.resolve(pdfPath)).split(path.sep).join('/'),
      model: config.model,
      generatedAt: new Date().toISOString(),
      attempts,
      fit,
      content,
    });
    return { ...files, template: template.id, fit };
  } finally {
    await renderer.close();
  }
}

/** Re-renders from a .content.json sidecar without calling the API, optionally into another template. */
export async function renderFromContent({ contentPath, templateId, outDir, log = console.log }) {
  const sidecar = JSON.parse(await fs.readFile(contentPath, 'utf8'));
  const template = await getTemplate(templateId ?? sidecar.template);
  const brand = await loadBrand();

  const name = path.basename(contentPath).replace(/\.content\.json$/, '');
  outDir ??= path.dirname(contentPath);
  await fs.mkdir(outDir, { recursive: true });
  const suffix = template.id === sidecar.template ? '' : `.${template.id}`;
  const files = outputFiles(outDir, `${name}${suffix}`);

  const renderer = await new PdfRenderer().open();
  try {
    const fit = await renderTo(renderer, { template, brand, content: sidecar.content, files });
    if (!fit.fits) log(`Warning (${template.id}): ${describeFit(fit)}`);
    return { ...files, content: contentPath, template: template.id, fit };
  } finally {
    await renderer.close();
  }
}

async function renderTo(renderer, { template, brand, content, files }) {
  await fs.writeFile(files.html, await renderHtml({ template, brand, content }), 'utf8');
  return renderer.render({ htmlPath: files.html, pdfPath: files.pdf, page: template.page });
}

function outputFiles(outDir, name) {
  return {
    pdf: path.join(outDir, `${name}.pdf`),
    html: path.join(outDir, `${name}.html`),
    content: path.join(outDir, `${name}.content.json`),
  };
}

const writeContentSidecar = (file, data) => fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
