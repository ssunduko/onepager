import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

// Load <project root>/.env if present. Variables already set in the shell win over the file.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

/** Empty strings count as unset, so a blank `KEY=` line in .env falls back to the default. */
const env = (name, fallback) => {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
};

export const config = {
  /** Claude model for template selection and content writing. */
  model: env('ONEPAGER_MODEL', 'claude-opus-5'),
  /** Server-side refusal fallbacks; set to "off" on Bedrock, Vertex or Foundry. */
  fallbacks: env('ONEPAGER_FALLBACKS', 'on') !== 'off',
  /**
   * Chrome's sandbox can't start as root, which is the norm in containers and cloud VMs
   * (e.g. Claude Code on the web). Disabled automatically there; force with ONEPAGER_CHROME_NO_SANDBOX=1.
   */
  chromeNoSandbox: env('ONEPAGER_CHROME_NO_SANDBOX', '') === '1' || process.getuid?.() === 0,
};
