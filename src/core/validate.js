import fs from 'node:fs/promises';
import Ajv from 'ajv';
import { getTemplate } from './templates.js';

/**
 * Checks a .content.json sidecar ({ template, content }) against the
 * contentSchema declared in that template's template.json sidecar.
 */
export async function validateContentFile(contentPath, templateId) {
  const sidecar = JSON.parse(await fs.readFile(contentPath, 'utf8'));
  const template = await getTemplate(templateId ?? sidecar.template);
  const validate = new Ajv({ allErrors: true, strict: false }).compile(template.contentSchema);

  const valid = validate(sidecar.content);
  const errors = (validate.errors ?? []).map(
    (e) =>
      `content${e.instancePath} ${e.message}` +
      (e.params?.additionalProperty ? `: "${e.params.additionalProperty}"` : ''),
  );
  return { valid, errors, template: template.id };
}
