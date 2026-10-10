import fs from 'node:fs/promises';
import path from 'node:path';
import { DIRS } from './paths.js';

const REQUIRED_FIELDS = ['id', 'name', 'description', 'entry', 'contentSchema'];

/**
 * Discovers layout templates. A template is any folder under templates/ that
 * contains a template.json sidecar; folders starting with "_" are shared assets.
 * The sidecar is the template's contract: the agent reads it to decide when to
 * use the layout and what content to write, and the renderer reads it for page setup.
 */
export async function loadTemplates(templatesDir = DIRS.templates) {
  const entries = await fs.readdir(templatesDir, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const dir = path.join(templatesDir, entry.name);
    const sidecarPath = path.join(dir, 'template.json');
    const raw = await fs.readFile(sidecarPath, 'utf8').catch(() => null);
    if (raw === null) continue;

    const sidecar = JSON.parse(raw);
    const missing = REQUIRED_FIELDS.filter((f) => !(f in sidecar));
    if (missing.length) throw new Error(`${sidecarPath} is missing: ${missing.join(', ')}`);
    if (sidecar.id !== entry.name) {
      throw new Error(`${sidecarPath}: id "${sidecar.id}" must match folder name "${entry.name}"`);
    }

    templates.push({
      ...sidecar,
      dir,
      page: { format: 'Letter', landscape: false, maxPages: 1, ...sidecar.page },
      styles: sidecar.styles ?? [],
      guidance: sidecar.guidance ?? [],
    });
  }

  return templates.sort((a, b) => a.id.localeCompare(b.id));
}

export async function getTemplate(id, templatesDir = DIRS.templates) {
  const templates = await loadTemplates(templatesDir);
  const template = templates.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Unknown template "${id}". Available: ${templates.map((t) => t.id).join(', ')}`);
  }
  return template;
}
