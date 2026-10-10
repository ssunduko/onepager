#!/usr/bin/env node
import './core/config.js';
import { parseArgs } from 'node:util';
import { generateOnePager, renderFromContent } from './core/pipeline.js';
import { loadTemplates } from './core/templates.js';
import { validateContentFile } from './core/validate.js';
import { describeFit } from './render/fit.js';

const USAGE = `Usage:
  onepager generate <source.pdf> [--template <id>|auto] [--out <dir>] [--examples <dir>]
  onepager render <name.content.json> [--template <id>] [--out <dir>]
  onepager validate <name.content.json> [--template <id>]
  onepager templates`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    template: { type: 'string', short: 't' },
    out: { type: 'string', short: 'o' },
    examples: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const [command, input] = positionals;

try {
  if (values.help || !command) {
    console.log(USAGE);
  } else if (command === 'templates') {
    for (const t of await loadTemplates()) console.log(`${t.id.padEnd(18)} ${t.name} — ${t.description}`);
  } else if (command === 'generate' && input) {
    const result = await generateOnePager({
      pdfPath: input,
      templateId: values.template ?? 'auto',
      outDir: values.out,
      examplesDir: values.examples,
    });
    report(result);
  } else if (command === 'validate' && input) {
    if (await checkContent(input)) console.log('Content is valid.');
  } else if (command === 'render' && input) {
    if (await checkContent(input)) {
      report(await renderFromContent({ contentPath: input, templateId: values.template, outDir: values.out }));
    }
  } else {
    console.error(USAGE);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}

async function checkContent(contentPath) {
  const { valid, errors, template } = await validateContentFile(contentPath, values.template);
  if (!valid) {
    console.error(`Content does not match the "${template}" contentSchema:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exitCode = 1;
  }
  return valid;
}

function report({ pdf, content, template, fit }) {
  console.log(`\nTemplate: ${template}`);
  console.log(`PDF:      ${pdf}`);
  console.log(`Content:  ${content}`);
  console.log(`Fit:      ${describeFit(fit)}`);
}
