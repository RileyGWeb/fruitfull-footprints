import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { LOCK_EVENT } from '../../lib/api.ts';
import { newDraft, type Draft } from './draft.ts';
import { clearAllLocal, clearLocal, clearOnLock, localKey, parseLocal, readLocal, serializeLocal, writeLocal } from './localDraft.ts';

// A small localStorage stand-in on a window that can dispatch events.
class MemoryStorage {
  items = new Map<string, string>();
  full = false;
  get length() { return this.items.size; }
  key(i: number) { return [...this.items.keys()][i] ?? null; }
  getItem(k: string) { return this.items.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.full) throw new Error('QuotaExceededError');
    this.items.set(k, v);
  }
  removeItem(k: string) { this.items.delete(k); }
}
const storage = new MemoryStorage();
const win = Object.assign(new EventTarget(), { localStorage: storage });
(globalThis as unknown as { window: unknown }).window = win;

const draft: Draft = { ...newDraft('2026-10-28'), title: 'Hold fast', description: 'Notes from the porch.' };

beforeEach(() => {
  storage.items.clear();
  storage.full = false;
});

test('a kept copy reads back as written, under the study id or “new”', () => {
  assert.equal(localKey(null), 'ff:editor-draft:new');
  assert.equal(localKey(7), 'ff:editor-draft:7');
  assert.ok(writeLocal(7, { draft, base: '2026-10-07T19:00:00.000000Z', at: 1 }));
  assert.deepEqual(readLocal(7), { draft, base: '2026-10-07T19:00:00.000000Z', at: 1 });
  assert.equal(readLocal(null), null);
  assert.ok(writeLocal(null, { draft, base: null, at: 2 }));
  assert.equal(readLocal(null)?.base, null);
});

test('parseLocal ignores anything that isn’t a copy this version wrote', () => {
  const good = serializeLocal({ draft, base: null, at: 3 });
  assert.ok(parseLocal(good));
  assert.equal(parseLocal(null), null);
  assert.equal(parseLocal('not json'), null);
  assert.equal(parseLocal(JSON.stringify({ ...JSON.parse(good), v: 2 })), null);
  assert.equal(parseLocal(JSON.stringify({ ...JSON.parse(good), base: 5 })), null);
  const badSection = { ...draft, sections: [{ id: 'a', type: 'poem', head: '', body: '' }] };
  assert.equal(parseLocal(serializeLocal({ draft: badSection as unknown as Draft, base: null, at: 1 })), null);
  const missingField = { ...draft } as Partial<Draft>;
  delete missingField.title;
  assert.equal(parseLocal(serializeLocal({ draft: missingField as Draft, base: null, at: 1 })), null);
  // Extra keys a later version might add to a section are dropped.
  const extra = { ...draft, sections: draft.sections.map(x => ({ ...x, colour: 'red' })) };
  assert.deepEqual(parseLocal(serializeLocal({ draft: extra, base: null, at: 1 }))?.draft, draft);
});

test('writeLocal reports a full (or missing) store instead of throwing', () => {
  storage.full = true;
  assert.equal(writeLocal(1, { draft, base: null, at: 1 }), false);
});

test('clearLocal removes one copy; clearAllLocal every editor copy and nothing else', () => {
  writeLocal(1, { draft, base: null, at: 1 });
  writeLocal(2, { draft, base: null, at: 1 });
  writeLocal(null, { draft, base: null, at: 1 });
  storage.setItem('ff:pending-lock', '1');
  clearLocal(1);
  assert.equal(readLocal(1), null);
  assert.ok(readLocal(2));
  clearAllLocal();
  assert.deepEqual([...storage.items.keys()], ['ff:pending-lock']);
});

test('after clearOnLock, this device’s Lock clears every kept copy', () => {
  writeLocal(4, { draft, base: null, at: 1 });
  win.dispatchEvent(new Event(LOCK_EVENT));
  assert.ok(readLocal(4), 'not watching yet');
  clearOnLock();
  clearOnLock(); // once is enough
  win.dispatchEvent(new Event(LOCK_EVENT));
  assert.equal(readLocal(4), null);
});
