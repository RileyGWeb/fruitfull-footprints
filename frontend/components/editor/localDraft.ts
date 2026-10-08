// Unsaved editor changes kept on this device (localStorage), one copy per study ('new' for
// /studies/new), so nothing typed is lost to a reload, a closed tab, a Back the guard couldn't catch,
// or the phone dropping the page in the background. The editor restores a copy with a quiet notice;
// it's removed once the study is saved (or the changes are undone or discarded), and every copy goes
// on this device's Lock. Imports are relative with '.ts' so `node --test` can run the unit tests.
import { LOCK_EVENT } from '../../lib/api.ts';
import type { SectionType } from '../../lib/types.ts';
import type { Draft, DraftSection } from './draft.ts';

const PREFIX = 'ff:editor-draft:';
const VERSION = 1;

/** `base` is the study's `updated_at` the changes were made against (null for a new study). */
export type LocalCopy = { draft: Draft; base: string | null; at: number };

export const localKey = (id: number | null) => `${PREFIX}${id ?? 'new'}`;

const TYPES = new Set<SectionType>(['text', 'scripture', 'questions', 'reflect', 'prayer']);
const FIELDS = ['ref', 'title', 'passage', 'date', 'series', 'location', 'description'] as const;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isSection = (x: unknown): x is DraftSection =>
  isObj(x) && typeof x.id === 'string' && TYPES.has(x.type as SectionType) && typeof x.head === 'string' && typeof x.body === 'string';

/** A stored copy, or null when there's none or it isn't one this version wrote. */
export function parseLocal(raw: string | null): LocalCopy | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || v.v !== VERSION || !isObj(v.draft) || typeof v.at !== 'number') return null;
  if (v.base !== null && typeof v.base !== 'string') return null;
  const d = v.draft;
  if (!FIELDS.every(f => typeof d[f] === 'string') || !Array.isArray(d.sections) || !d.sections.every(isSection)) return null;
  const draft: Draft = {
    ref: d.ref as string, title: d.title as string, passage: d.passage as string, date: d.date as string,
    series: d.series as string, location: d.location as string, description: d.description as string,
    sections: d.sections.map(({ id, type, head, body }: DraftSection) => ({ id, type, head, body })),
  };
  return { draft, base: v.base, at: v.at };
}

export const serializeLocal = (copy: LocalCopy) => JSON.stringify({ v: VERSION, ...copy });

/** localStorage, or null where it's unavailable (SSR, blocked site data, some private modes). */
function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readLocal(id: number | null): LocalCopy | null {
  try {
    return parseLocal(store()?.getItem(localKey(id)) ?? null);
  } catch {
    return null;
  }
}

/** True when the copy is stored (false: no storage, or it's full). */
export function writeLocal(id: number | null, copy: LocalCopy): boolean {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(localKey(id), serializeLocal(copy));
    return true;
  } catch {
    return false;
  }
}

export function clearLocal(id: number | null): void {
  try {
    store()?.removeItem(localKey(id));
  } catch {
    // nothing to clear
  }
}

/** Every kept copy — the device is being put away. */
export function clearAllLocal(): void {
  const s = store();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => s.removeItem(k));
  } catch {
    // nothing to clear
  }
}

let watching = false;

/**
 * From now on (for the rest of this page's life, on any screen), this device's Lock clears every kept
 * copy. The editor calls it when it opens.
 */
export function clearOnLock(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.addEventListener(LOCK_EVENT, clearAllLocal);
}
