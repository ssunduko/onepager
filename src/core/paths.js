import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const DIRS = {
  brand: path.join(ROOT, 'brand'),
  examples: path.join(ROOT, 'examples'),
  templates: path.join(ROOT, 'templates'),
  output: path.join(ROOT, 'output'),
};

/** Absolute file:// URL for a local path (handles spaces, Windows drive letters). */
export const fileUrl = (p) => pathToFileURL(p).href;
