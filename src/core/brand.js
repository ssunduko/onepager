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

  const resolve = (assets = {}) =>
    Object.fromEntries(Object.entries(assets).map(([key, rel]) => [key, fileUrl(path.join(brandDir, rel))]));
  const logos = resolve(brand.logos);
  const icons = resolve(brand.icons);
  const social = (brand.social ?? []).map((s) => ({ ...s, iconUrl: icons[s.icon] }));

  return { ...brand, dir: brandDir, styleGuide, logos, icons, social, css: brandCss(brand, brandDir) };
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
  const display = brand.fonts.display ?? brand.fonts.headline;
  const displayStack = [display.family, ...(display.fallback ?? []), 'sans-serif']
    .map((f) => (f === 'sans-serif' ? f : `"${f}"`))
    .join(', ');

  return [
    ...fontFaces,
    ':root {',
    ...colorTokens,
    '  --color-border: color-mix(in srgb, var(--color-primary) 14%, var(--color-white));',
    `  --font-display: ${displayStack};`,
    `  --font-display-weight: ${display.weight ?? 700};`,
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
