import puppeteer from 'puppeteer';
import { config } from '../core/config.js';
import { fileUrl } from '../core/paths.js';
import { pageSize } from './html.js';

/** Extra flags for containers: no sandbox as root, and /tmp instead of a small /dev/shm. */
export const chromeArgs = () => (config.chromeNoSandbox ? ['--no-sandbox', '--disable-dev-shm-usage'] : []);

/**
 * Wraps a single headless Chrome instance so the agent's write → render → check
 * loop doesn't relaunch the browser on every attempt.
 */
export class PdfRenderer {
  async open() {
    this.browser = await puppeteer.launch({ headless: true, args: chromeArgs() });
    return this;
  }

  async close() {
    await this.browser?.close();
  }

  /**
   * Renders an HTML file to PDF and reports whether the content fits.
   * Templates lay out each page as a fixed-size `.page` element with overflow hidden,
   * so overflow shows up as scrollHeight > clientHeight on one of them.
   * `pages[i]` gives each page's overflow ratio and its free space at the bottom (0-1).
   */
  async render({ htmlPath, pdfPath, page: pageConfig }) {
    const tab = await this.browser.newPage();
    try {
      await tab.goto(fileUrl(htmlPath), { waitUntil: 'networkidle0' });
      await tab.evaluateHandle('document.fonts.ready');

      // Measure the natural layout: templates turn off space-distributing rules under .fit-measure.
      await tab.evaluate(() => document.documentElement.classList.add('fit-measure'));
      const fit = await tab.evaluate((maxPages) => {
        const round = (n) => Number(n.toFixed(3));
        const pages = [...document.querySelectorAll('.page')].map((el) => {
          // Free space = height of the flexible spacer that pushes the footer down, if any.
          const spacer = el.querySelector(':scope > .spacer');
          return {
            overflowRatio: round(Math.max(1, el.scrollHeight / el.clientHeight)),
            freeRatio: round(spacer ? spacer.getBoundingClientRect().height / el.clientHeight : 0),
          };
        });
        const worst = Math.max(1, ...pages.map((p) => p.overflowRatio));
        return {
          pageCount: pages.length,
          maxPages,
          overflowRatio: worst,
          pages,
          fits: pages.length > 0 && pages.length <= maxPages && worst <= 1.005,
        };
      }, pageConfig.maxPages);
      await tab.evaluate(() => document.documentElement.classList.remove('fit-measure'));

      const { width, height } = pageSize(pageConfig);
      await tab.pdf({ path: pdfPath, width, height, printBackground: true, preferCSSPageSize: true });
      return fit;
    } finally {
      await tab.close();
    }
  }
}
