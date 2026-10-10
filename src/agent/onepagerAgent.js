import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { describeBrandForAgent } from '../core/brand.js';
import { config } from '../core/config.js';
import { describeFit } from '../render/fit.js';

const MAX_PDF_BYTES = 30 * 1024 * 1024; // request limit is 32 MB including everything else

const SYSTEM_PROMPT = await fs.readFile(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompts', 'system.md'),
  'utf8',
);

export class OnePagerAgent {
  constructor({ brand, examples, client = new Anthropic(), log = () => {} }) {
    this.brand = brand;
    this.examples = examples;
    this.client = client;
    this.log = log;
  }

  /** Picks the best-fitting layout when the user asked for --template auto. */
  async selectTemplate({ pdfPath, templates }) {
    const catalog = templates
      .map((t) => `- ${t.id}: ${t.name}. ${t.description}${t.bestFor ? ` Best for: ${t.bestFor}` : ''}`)
      .join('\n');
    const schema = {
      type: 'object',
      properties: {
        template: { type: 'string', enum: templates.map((t) => t.id) },
        reason: { type: 'string', description: 'One sentence explaining the choice.' },
      },
      required: ['template', 'reason'],
      additionalProperties: false,
    };

    const { data } = await this.#call({
      effort: 'low',
      schema,
      messages: [
        {
          role: 'user',
          content: [
            await pdfBlock(pdfPath),
            { type: 'text', text: `Which layout template suits this source document best?\n\n${catalog}` },
          ],
        },
      ],
    });
    this.log(`Template "${data.template}": ${data.reason}`);
    return data.template;
  }

  /**
   * Writes content for `template`, then lets `evaluate(content)` render it and
   * report whether it fits. On overflow the agent revises in the same conversation.
   */
  async writeContent({ pdfPath, template, evaluate, maxAttempts = 3 }) {
    const messages = [
      {
        role: 'user',
        content: [...(await this.#referenceBlocks()), await pdfBlock(pdfPath), { type: 'text', text: taskPrompt(template) }],
      },
    ];

    let result;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.log(`Writing content (attempt ${attempt}/${maxAttempts})…`);
      const { message, data } = await this.#call({ effort: 'high', schema: template.contentSchema, messages });
      const fit = await evaluate(data);
      result = { content: data, fit, attempts: attempt };
      if (fit.fits) return result;

      this.log(`Layout doesn't fit: ${describeFit(fit)} Asking for a revision.`);
      messages.push(
        { role: 'assistant', content: message.content },
        {
          role: 'user',
          content:
            `The rendered layout does not fit. ${describeFit(fit)} ` +
            (template.page.maxPages > 1
              ? `You may use up to ${template.page.maxPages} pages: move content to another page before cutting important facts. `
              : '') +
            'Return the complete content object again. Shorten body copy and drop the weakest items first.',
        },
      );
    }

    this.log('Content still overflows after the last attempt; keeping the final version.');
    return result;
  }

  /** Brand + examples: identical across runs, so they sit before the cache breakpoint. */
  async #referenceBlocks() {
    const blocks = [{ type: 'text', text: `<brand>\n${describeBrandForAgent(this.brand)}\n</brand>` }];

    for (const example of this.examples) {
      blocks.push({
        type: 'text',
        text:
          `<example id="${example.id}" title="${example.title ?? example.id}"` +
          `${example.template ? ` template="${example.template}"` : ''}>\n${example.notes ?? ''}\n</example>`,
      });
      for (const file of example.files) {
        const data = (await fs.readFile(file.path)).toString('base64');
        blocks.push(
          file.mediaType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: file.mediaType, data }, title: example.title }
            : { type: 'image', source: { type: 'base64', media_type: file.mediaType, data } },
        );
      }
    }

    blocks.at(-1).cache_control = { type: 'ephemeral' };
    return blocks;
  }

  async #call({ messages, schema, effort }) {
    const request = {
      model: config.model,
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages,
    };
    if (config.fallbacks) {
      // Server-side fallback: a safety-classifier decline is retried on Anthropic's recommended model.
      request.betas = ['server-side-fallback-2026-07-01'];
      request.fallbacks = 'default';
    }

    const message = await this.client.beta.messages.stream(request).finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new Error(`Claude declined the request: ${message.stop_details?.explanation ?? 'no details'}`);
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Claude hit max_tokens before finishing the content object.');
    }

    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { message, data: JSON.parse(text) };
  }
}

async function pdfBlock(pdfPath) {
  const bytes = await fs.readFile(pdfPath);
  if (bytes.length > MAX_PDF_BYTES) {
    throw new Error(`${pdfPath} is ${(bytes.length / 1e6).toFixed(1)} MB; the API accepts PDFs up to ~30 MB.`);
  }
  return {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') },
    title: 'Source document',
  };
}

function taskPrompt(template) {
  return [
    `Write the content for the "${template.name}" layout (template id: ${template.id}).`,
    `<template_sidecar>\n${template.description}`,
    template.bestFor ? `Best for: ${template.bestFor}` : '',
    `Page: ${template.page.format}${template.page.landscape ? ' landscape' : ''}, max ${template.page.maxPages} page(s).`,
    template.guidance.length ? `Guidance:\n${template.guidance.map((g) => `- ${g}`).join('\n')}` : '',
    '</template_sidecar>',
    'Base every fact on the source document above, and match the voice and density of the examples.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
