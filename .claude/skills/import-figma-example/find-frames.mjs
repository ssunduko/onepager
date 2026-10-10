#!/usr/bin/env node
// Locates the printable page frames around a Figma node.
//
// Figma links often point at a nested layer (a logo, a text box). Given the saved
// output of the Figma MCP `get_metadata` call on the *page* (canvas) and the linked
// node id, this prints the node's ancestor chain and picks the document: the nearest
// ancestor whose children are page-sized frames (A4/Letter aspect ratio), or the
// nearest page-sized ancestor itself.
//
// Usage: node find-frames.mjs <get_metadata-output-file> <nodeId>
// The file may be raw XML or the JSON array [{type, text}] that oversized tool
// results are saved as.
import fs from 'node:fs';

const [file, rawId] = process.argv.slice(2);
if (!file || !rawId) {
  console.error('Usage: node find-frames.mjs <metadata-file> <nodeId>');
  process.exit(1);
}
const targetId = rawId.replace('-', ':');

let xml = fs.readFileSync(file, 'utf8');
try {
  xml = JSON.parse(xml).map((part) => part.text).join('\n');
} catch {
  // already plain XML
}

const PAGE_RATIOS = [297 / 210, 11 / 8.5]; // A4, Letter (portrait)
const isPageSized = (n) =>
  n.w > 300 && n.h > 300 && PAGE_RATIOS.some((r) => Math.abs(n.h / n.w - r) < 0.03 || Math.abs(n.w / n.h - r) < 0.03);

// Parse into a light tree.
const root = { children: [] };
const stack = [root];
const tagRe = /<(\/?)([a-z-]+)([^>]*?)(\/?)>/g;
let m;
while ((m = tagRe.exec(xml))) {
  const [, closing, tag, attrs, selfClosing] = m;
  if (closing) {
    stack.pop();
    continue;
  }
  const attr = (name) => (attrs.match(new RegExp(` ${name}="([^"]*)"`)) || [])[1];
  const node = {
    tag,
    id: attr('id'),
    name: (attr('name') ?? '').replace(/&amp;/g, '&'),
    w: Math.round(Number(attr('width') ?? 0)),
    h: Math.round(Number(attr('height') ?? 0)),
    children: [],
    parent: stack.at(-1),
  };
  stack.at(-1).children.push(node);
  if (!selfClosing) stack.push(node);
}

const find = (node) => {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const hit = find(child);
    if (hit) return hit;
  }
  return null;
};
const target = find(root);
if (!target) {
  console.error(`Node ${targetId} not found in ${file}`);
  process.exit(1);
}

const ancestors = [];
for (let n = target; n && n.id; n = n.parent) ancestors.push(n);

console.log('Ancestor chain (linked node first):');
for (const n of ancestors) console.log(`  ${n.id}  ${n.tag}  "${n.name}"  ${n.w}x${n.h}`);

let doc = null;
let pages = [];
for (const n of ancestors) {
  const pageChildren = n.children.filter((c) => c.tag === 'frame' && isPageSized(c));
  if (pageChildren.length >= 2) {
    doc = n;
    pages = pageChildren;
    break;
  }
  if (isPageSized(n) && !pages.length) {
    doc = n.parent?.id ? n.parent : n;
    pages = [n];
    // keep looking upward in case the parent holds sibling pages
  }
}

console.log('\nDocument:', doc ? `${doc.id} "${doc.name}"` : 'not found');
console.log('Pages:');
for (const p of pages) console.log(`  ${p.id}  "${p.name}"  ${p.w}x${p.h}`);
console.log(JSON.stringify({ documentNodeId: doc?.id ?? null, pages: pages.map(({ id, name, w, h }) => ({ id, name, w, h })) }));
