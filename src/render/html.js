import fs from 'node:fs/promises';
import path from 'node:path';
import Handlebars from 'handlebars';
import { DIRS } from '../core/paths.js';

const PAGE_SIZES = {
  Letter: { width: '8.5in', height: '11in' },
  A4: { width: '210mm', height: '297mm' },
};

const SHARED_DIR = path.join(DIRS.templates, '_shared');

let handlebarsInstance;

/** Handlebars with shared partials (templates/_shared/partials/*.hbs) and helpers registered once. */
async function getHandlebars() {
  if (handlebarsInstance) return handlebarsInstance;
  const hb = Handlebars.create();

  const partialsDir = path.join(SHARED_DIR, 'partials');
  for (const file of await fs.readdir(partialsDir).catch(() => [])) {
    if (file.endsWith('.hbs')) {
      hb.registerPartial(path.basename(file, '.hbs'), await fs.readFile(path.join(partialsDir, file), 'utf8'));
    }
  }
  hb.registerHelper('eq', (a, b) => a === b);
  hb.registerHelper('hasItems', (list) => Array.isArray(list) && list.length > 0);
  hb.registerHelper('bareUrl', (url) => String(url ?? '').replace(/^(https?:\/\/(www\.)?|mailto:)/, '').replace(/\/$/, ''));
  hb.registerHelper('isShort', (text, max) => String(text ?? '').length <= max);
  hb.registerHelper('inc', (n) => Number(n) + 1);
  hb.registerHelper('gt', (a, b) => Number(a) > Number(b));
  hb.registerHelper('pad2', (n) => String(n).padStart(2, '0'));

  handlebarsInstance = hb;
  return hb;
}

export function pageSize(page) {
  const size = PAGE_SIZES[page.format];
  if (!size) throw new Error(`Unsupported page format "${page.format}". Use one of: ${Object.keys(PAGE_SIZES).join(', ')}`);
  return page.landscape ? { width: size.height, height: size.width } : size;
}

/** Builds the complete, self-contained HTML document for one template + content. */
export async function renderHtml({ template, brand, content }) {
  const hb = await getHandlebars();
  const body = hb.compile(await fs.readFile(path.join(template.dir, template.entry), 'utf8'))({
    content,
    brand,
    logos: brand.logos,
    template: { id: template.id, name: template.name },
  });

  const sharedCss = await fs.readFile(path.join(SHARED_DIR, 'base.css'), 'utf8');
  const templateCss = await Promise.all(template.styles.map((f) => fs.readFile(path.join(template.dir, f), 'utf8')));
  const { width, height } = pageSize(template.page);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${hb.escapeExpression(content.title ?? template.name)}</title>
<style>
${brand.css}
:root { --page-width: ${width}; --page-height: ${height}; }
@page { size: ${width} ${height}; margin: 0; }
${sharedCss}
${templateCss.join('\n')}
</style>
</head>
<body class="template-${template.id}">
${body}
</body>
</html>`;
}
