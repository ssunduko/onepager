import fs from 'node:fs/promises';
import path from 'node:path';
import { DIRS, fileUrl } from './paths.js';

/**
 * Loads brand/brand.json (the brand sidecar) and resolves every asset path
 * to an absolute file:// URL so templates can reference them directly.
 */
export async function loadBrand(brandDir = DIRS.brand) {
  const brand = JSON.parse(await fs.readFile(path.join(brandDir, 'brand.json'), 'utf8'));
  const styleGuide = await fs.readFile(path.join(brandDir, 'StyleGuide.txt'), 'utf8').catch(() => '');

  const logos = Object.fromEntries(
    Object.entries(brand.logos ?? {}).map(([key, rel]) => [key, fileUrl(path.join(brandDir, rel))]),
  );

  return { ...brand, dir: brandDir, styleGuide, logos, css: brandCss(brand, brandDir) };
}

/** @font-face rules plus :root design tokens shared by every template. */
function brandCss(brand, brandDir) {
  const fontFaces = Object.values(brand.fonts).flatMap(({ family, faces }) =>
    faces.map(
      ({ weight, file }) =>
        `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: normal; ` +
        `src: url("${fileUrl(path.join(brandDir, file))}"); }`,
    ),
  );
  const colorTokens = Object.entries(brand.colors).map(([name, value]) => `  --color-${name}: ${value};`);

  return [
    ...fontFaces,
    ':root {',
    ...colorTokens,
    `  --font-headline: "${brand.fonts.headline.family}", "Inter", sans-serif;`,
    `  --font-headline-weight: ${brand.fonts.headline.weight ?? 700};`,
    `  --font-body: "${brand.fonts.body.family}", system-ui, sans-serif;`,
    '}',
  ].join('\n');
}

/** Compact brand description handed to the agent. */
export function describeBrandForAgent(brand) {
  return [
    `Brand: ${brand.name} (${brand.website})`,
    `Style guide:\n${brand.styleGuide.trim()}`,
    `Palette: ${Object.entries(brand.colors).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `Voice:\n${brand.voice.map((v) => `- ${v}`).join('\n')}`,
    `Visual rules:\n${brand.rules.map((r) => `- ${r}`).join('\n')}`,
  ].join('\n\n');
}
