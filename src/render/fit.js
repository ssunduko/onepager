const pct = (ratio) => Math.round(ratio * 100);

/**
 * One-line, human- and agent-readable summary of a fit result from PdfRenderer.render().
 * Overflowing pages are named so the writer knows where to cut or what to move to the next page.
 */
export function describeFit(fit) {
  const pages = fit.pages ?? [];
  const problems = [];
  if (fit.pageCount > fit.maxPages) problems.push(`${fit.pageCount} pages, but the template allows at most ${fit.maxPages}`);
  pages.forEach((p, i) => {
    if (p.overflowRatio > 1.005) problems.push(`page ${i + 1} overflows by ~${pct(p.overflowRatio - 1)}%`);
  });

  if (problems.length) {
    return `OVERFLOW: ${problems.join('; ')}. Shorten copy or move content to another page.`;
  }
  const free = pages.map((p, i) => `p${i + 1} ${pct(p.freeRatio)}%`).join(', ');
  return `OK (${fit.pageCount} page${fit.pageCount === 1 ? '' : 's'}; free space at bottom: ${free})`;
}
