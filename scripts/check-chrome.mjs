#!/usr/bin/env node
// Verifies that Puppeteer can launch Chrome with the same flags the renderer uses.
// Exit code 0 = ready to render; 1 = not ready, with hints for the likely cause.
import puppeteer from 'puppeteer';
import { chromeArgs } from '../src/render/pdf.js';

try {
  const browser = await puppeteer.launch({ headless: true, args: chromeArgs() });
  console.log(`Chrome OK: ${await browser.version()} (${await puppeteer.executablePath()})`);
  await browser.close();
} catch (error) {
  const message = String(error?.message ?? error);
  console.error(`Chrome is not ready: ${message.split('\n')[0]}`);
  if (/Could not find Chrome|Browser was not found/i.test(message)) {
    console.error('Hint: the Chrome download failed. In claude.ai/code, set the environment\'s network access to');
    console.error('      Custom and allow storage.googleapis.com, or set PUPPETEER_EXECUTABLE_PATH to an installed Chrome.');
  } else if (/shared libraries|error while loading/i.test(message)) {
    console.error('Hint: system libraries are missing. Try: npx puppeteer browsers install chrome --install-deps');
  } else if (/sandbox/i.test(message)) {
    console.error('Hint: set ONEPAGER_CHROME_NO_SANDBOX=1.');
  }
  process.exit(1);
}
