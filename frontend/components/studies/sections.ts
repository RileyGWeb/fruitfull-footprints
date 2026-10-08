// Study sections → what the reader renders. Relative '.ts' imports so `npm test` (node --test) can load it.
import { paragraphs } from '../../lib/studies.ts';
import type { Section } from '../../lib/types.ts';

type Base = { id: string; heading: string | null };

export type ReaderSection =
  | (Base & { type: 'text' | 'reflect' | 'prayer'; paras: string[] })
  | { id: string; type: 'scripture'; ref: string | null; paras: string[] }
  | (Base & { type: 'questions'; items: string[] });

const clean = (s: string | null | undefined) => s?.trim() || null;

/**
 * Normalises sections for reading: bodies split on blank lines, blank questions dropped, and sections
 * with nothing to show (an empty scripture block in a fresh draft, a reflection with no words) left out.
 */
export function readerSections(sections: Section[] | null | undefined): ReaderSection[] {
  const out: ReaderSection[] = [];
  for (const [i, x] of (sections ?? []).entries()) {
    const id = x.id || `s${i}`;
    const heading = clean(x.heading);
    switch (x.type) {
      case 'scripture': {
        const paras = paragraphs(x.text);
        if (paras.length) out.push({ id, type: 'scripture', ref: clean(x.ref), paras });
        break;
      }
      case 'questions': {
        const items = (x.items ?? []).map(t => t.trim()).filter(Boolean);
        if (items.length) out.push({ id, type: 'questions', heading, items });
        break;
      }
      case 'text': {
        const paras = paragraphs(x.body);
        if (heading || paras.length) out.push({ id, type: 'text', heading, paras });
        break;
      }
      case 'reflect':
      case 'prayer': {
        const paras = paragraphs(x.body);
        if (paras.length) out.push({ id, type: x.type, heading, paras });
        break;
      }
    }
  }
  return out;
}
