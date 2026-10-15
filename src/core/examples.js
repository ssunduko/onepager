import fs from 'node:fs/promises';
import path from 'node:path';
import { DIRS } from './paths.js';

const MEDIA_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Loads reference examples. Each example is a folder under examples/ with an
 * example.json sidecar ({ title, template?, notes, files: [...] }) next to the
 * finished one-pager files (PDF or images) it describes.
 */
export async function loadExamples(examplesDir = DIRS.examples) {
  const entries = await fs.readdir(examplesDir, { withFileTypes: true }).catch(() => []);
  const examples = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const dir = path.join(examplesDir, entry.name);
    const raw = await fs.readFile(path.join(dir, 'example.json'), 'utf8').catch(() => null);
    if (raw === null) continue;

    const sidecar = JSON.parse(raw);
    const files = (sidecar.files ?? []).map((name) => {
      const mediaType = MEDIA_TYPES[path.extname(name).toLowerCase()];
      if (!mediaType) throw new Error(`examples/${entry.name}: unsupported file type "${name}"`);
      // Example files are sent to the API, so they must stay inside the example's own folder.
      const filePath = path.resolve(dir, name);
      if (path.relative(dir, filePath).startsWith('..') || path.isAbsolute(path.relative(dir, filePath))) {
        throw new Error(`examples/${entry.name}: file "${name}" is outside the example folder`);
      }
      return { path: filePath, mediaType };
    });
    examples.push({ id: entry.name, ...sidecar, files });
  }

  return examples;
}

export { MEDIA_TYPES };
