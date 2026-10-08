'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useDialogs } from '@/components/dialogs';
import { BackButton } from '@/components/ui/BackButton';
import { focusLandmark } from '@/components/ui/focus';
import { Icon } from '@/components/ui/Icon';
import { useActions } from '@/lib/actions';
import { ApiError, LOCK_EVENT, errorMessage, isConflict } from '@/lib/api';
import * as ep from '@/lib/endpoints';
import { isLockedOut } from '@/lib/gate';
import { deriveSeries } from '@/lib/studies';
import { useDocumentTitle } from '@/lib/title';
import { showToast } from '@/lib/toast';
import type { SectionType, Study, StudyStatus } from '@/lib/types';
import { ConflictDialog } from './ConflictDialog';
import {
  ADD_ORDER, FIELD_ORDER, MAX_SECTIONS, SECTION_KINDS, blankSection, checkDraft, fieldErrors, fromStudy, hasContent, moveSection, newDraft,
  sameDraft, sectionsToSend, toBody, type Draft, type DraftSection, type FieldErrors,
} from './draft';
import { clearLocal, clearOnLock, readLocal, writeLocal, type LocalCopy } from './localDraft';
import { SectionCard } from './SectionCard';
import { useLeaveGuard } from './useLeaveGuard';
import s from './Editor.module.css';

type Props = {
  /** The saved study, or none for /studies/new. */
  study?: Study;
  /** Meeting date a new study starts with (YYYY-MM-DD). */
  defaultDate?: string;
  /** settings.meeting_place — the Where placeholder. */
  meetingPlace: string;
};

type Field = (typeof FIELD_ORDER)[number];
type Then = 'stay' | 'read';
type Conflict = { next: StudyStatus; then: Then; theirs: Study | null };

const HINT = {
  draft: 'Drafts only show up here on Studies. Publish whenever it’s ready — days early is great.',
  published: 'Live — changes show up for everyone when you save.',
};

/** focusNext target meaning “the page's heading”. */
const HEADING = '\u0000heading';

/**
 * The first save of a new study moves to its edit URL, which mounts a fresh editor. This carries the
 * form (including anything typed while the save was in flight) and the focused field across.
 */
let handoff: { id: number; at: number; draft: Draft; focus: { key: string; start: number | null; end: number | null } | null } | null = null;
const handoffFor = (id: number | undefined) => (handoff && handoff.id === id && Date.now() - handoff.at < 10_000 ? handoff : null);

/** Where the form starts: the handoff from a first save, else a copy kept on this device, else the saved study. */
function startFrom(study: Study | undefined, defaultDate: string) {
  const saved = study ? fromStudy(study) : newDraft(defaultDate);
  const savedAt = study?.updated_at ?? null;
  const h = handoffFor(study?.id);
  if (h) return { saved, savedAt, draft: h.draft, base: savedAt, restored: false };
  const local = readLocal(study?.id ?? null);
  if (local && !sameDraft(local.draft, saved)) return { saved, savedAt, draft: local.draft, base: study ? local.base ?? savedAt : null, restored: true };
  return { saved, savedAt, draft: saved, base: savedAt, restored: false };
}

/** The study a 409 says is there now (the server sends it along), if it did. */
const theirsFrom = (e: ApiError): Study | null => {
  const study = (e.data as { study?: Study } | null)?.study;
  return study && typeof study.id === 'number' ? study : null;
};

/** 08 Edit study: details, study notes, and the sticky save / publish footer. */
export function StudyEditor({ study, defaultDate = '', meetingPlace }: Props) {
  const actions = useActions();
  const { mutate } = useSWRConfig();
  const { confirm } = useDialogs();
  const uid = useId();

  const [start] = useState(() => startFrom(study, defaultDate));
  const [draft, setDraft] = useState(start.draft);
  const [saved, setSaved] = useState(start.saved);
  /** The saved study's updated_at, and the one the form's changes were made against (they differ only for an older copy kept on this device). */
  const [savedAt, setSavedAt] = useState(start.savedAt);
  const [base, setBase] = useState(start.base);
  const [restored, setRestored] = useState(start.restored);
  const [studyId, setStudyId] = useState<number | null>(study?.id ?? null);
  const [status, setStatus] = useState<StudyStatus | null>(study?.status ?? null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const dirty = useMemo(() => !sameDraft(draft, saved), [draft, saved]);

  // The form as last rendered, for the handoff after an await.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  // — The copy kept on this device —
  // Written shortly after each change (and right away when the page is hidden, left or unmounted);
  // removed as soon as there's nothing unsaved. `dropped` is a form whose copy was cleared on Lock.
  const pending = useRef<{ id: number | null; copy: LocalCopy } | null>(null);
  const kept = useRef(false);
  const dropped = useRef<Draft | null>(null);
  const flushLocal = useCallback(() => {
    const p = pending.current;
    if (!p) return kept.current;
    pending.current = null;
    kept.current = writeLocal(p.id, p.copy);
    return kept.current;
  }, []);
  /** Saved or deleted: no copy under `id`, including one still waiting to be written. */
  const forgetLocal = (id: number | null) => {
    if (pending.current?.id === id) pending.current = null;
    clearLocal(id);
  };

  useEffect(() => {
    if (!dirty) {
      pending.current = null;
      kept.current = false;
      clearLocal(studyId);
      return;
    }
    if (draft === dropped.current) return;
    pending.current = { id: studyId, copy: { draft, base, at: Date.now() } };
    const t = setTimeout(flushLocal, 400);
    return () => clearTimeout(t);
  }, [dirty, draft, base, studyId, flushLocal]);

  useEffect(() => {
    clearOnLock(); // this device's Lock clears every kept copy…
    const onLock = () => { // …and this form doesn't write one back on its way out
      pending.current = null;
      kept.current = false;
      dropped.current = latest.current;
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushLocal();
    };
    window.addEventListener(LOCK_EVENT, onLock);
    window.addEventListener('pagehide', flushLocal);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener(LOCK_EVENT, onLock);
      window.removeEventListener('pagehide', flushLocal);
      document.removeEventListener('visibilitychange', onHide);
      flushLocal();
    };
  }, [flushLocal]);

  const leave = useLeaveGuard(dirty, { keep: flushLocal });

  // Focus to restore after the list re-renders (an added, moved or removed section; the first error).
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if (target === HEADING) focusLandmark();
    else document.getElementById(target)?.focus();
  });

  // Arriving from the first save of a new study: put focus (and the caret) back where it was.
  useEffect(() => {
    const h = handoffFor(study?.id);
    handoff = null;
    if (!h?.focus) return;
    const el = document.getElementById(`${uid}-${h.focus.key}`);
    el?.focus({ preventScroll: true });
    if (h.focus.start != null && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      try { el.setSelectionRange(h.focus.start, h.focus.end); } catch { /* inputs without a caret (date) */ }
    }
  }, [uid, study?.id]);

  // Keyboard focus scrolls clear of the stuck footer pill: its height feeds the page's scroll-padding
  // while the editor is open (Editor.module.css, html:has(.footer)), on top of the tab-bar clearance.
  const footerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--ff-editor-pill', `${footer.offsetHeight}px`));
    ro.observe(footer);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--ff-editor-pill');
    };
  }, []);

  const fid = (f: Field) => `${uid}-${f}`;
  const sid = (id: string) => `${uid}-s-${id}`;

  const clearErrors = (...keys: string[]) =>
    setErrors(e => (keys.some(k => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) : e));

  const set = (patch: Partial<Omit<Draft, 'sections'>>) => {
    setDraft(d => ({ ...d, ...patch }));
    clearErrors('form', ...Object.keys(patch).map(k => (k === 'date' ? 'meeting_date' : k)));
  };

  const setSection = (id: string, patch: Partial<DraftSection>) => {
    setDraft(d => ({ ...d, sections: d.sections.map(x => (x.id === id ? { ...x, ...patch } : x)) }));
    clearErrors('form', `section:${id}`);
  };

  const addSection = (type: SectionType) => {
    const x = blankSection(type);
    setDraft(d => ({ ...d, sections: [...d.sections, x] }));
    clearErrors('sections');
    focusNext.current = `${sid(x.id)}-head`;
  };

  const move = (id: string, dir: -1 | 1) => {
    const list = moveSection(draft.sections, id, dir);
    if (list === draft.sections) return;
    setDraft(d => ({ ...d, sections: list }));
    const at = list.findIndex(x => x.id === id);
    const stuck = dir === -1 ? at === 0 : at === list.length - 1;
    focusNext.current = `${sid(id)}-${(dir === -1) !== stuck ? 'up' : 'down'}`;
  };

  const remove = async (x: DraftSection) => {
    if (hasContent(x)) {
      const ok = await confirm({
        title: 'Remove this section?',
        body: 'What’s written in it will be removed from the study.',
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!ok) return;
    }
    const list = draft.sections, i = list.findIndex(y => y.id === x.id);
    const neighbour = list[i + 1] ?? list[i - 1];
    setDraft(d => ({ ...d, sections: d.sections.filter(y => y.id !== x.id) }));
    clearErrors(`section:${x.id}`);
    focusNext.current = neighbour ? `${sid(neighbour.id)}-head` : `${uid}-add-text`;
  };

  // Focus waits for the render, so the field is announced with its message (aria-describedby). A
  // form-wide message (no field to stand by) is announced by its alert; focus stays where it is.
  const showErrors = (e: FieldErrors) => {
    setErrors(e);
    const field = FIELD_ORDER.find(f => e[f]);
    const section = draft.sections.find(x => e[`section:${x.id}`]);
    focusNext.current = field ? fid(field) : section ? `${sid(section.id)}-body` : null;
  };

  /** Which field has focus (as an id without this editor's prefix), and where the caret is. */
  const focusState = () => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !el.id.startsWith(`${uid}-`)) return null;
    let start: number | null = null, end: number | null = null;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      try { start = el.selectionStart; end = el.selectionEnd; } catch { /* no caret */ }
    }
    return { key: el.id.slice(uid.length + 1), start, end };
  };

  /** Puts a study the server sent into the form as the saved version (after a save, or “Load their version”). */
  const takeSaved = (result: Study, sent: Draft | null) => {
    const fresh = fromStudy(result);
    setSaved(fresh);
    setDraft(cur => (sent === null || cur === sent ? fresh : cur));
    setSavedAt(result.updated_at);
    setBase(result.updated_at);
    setStatus(result.status);
    setStudyId(result.id);
    setErrors({});
    setRestored(false);
  };

  /**
   * Saves the form as `next`; then stays (a new study moves to its edit URL) or opens the reader.
   * Resolves whether it saved. `force` saves over someone else's newer version (“Keep mine”).
   */
  const save = async (next: StudyStatus, then: Then, force = false): Promise<boolean> => {
    if (busy) return false;
    const local = checkDraft(draft, next);
    if (Object.keys(local).length) {
      showErrors(local);
      return false;
    }
    const sent = draft;
    const focusBefore = focusState();
    setBusy(true);
    try {
      const body = toBody(sent, next, studyId != null && !force ? base : null);
      const result = await actions.saveStudy(body, studyId ?? undefined);
      takeSaved(result, sent);
      if (studyId == null) forgetLocal(null); // anything still unsaved is kept under the study's id from now on
      if (then === 'read') {
        // A brand-new study's editor isn't worth a Back step (it would open blank); an existing one's is.
        leave(`/studies/${result.id}`, { replace: studyId == null });
      } else if (studyId == null) {
        handoff = { id: result.id, at: Date.now(), draft: latest.current === sent ? fromStudy(result) : latest.current, focus: focusState() ?? focusBefore };
        leave(`/studies/${result.id}/edit`, { replace: true, scroll: false });
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.errors) showErrors(fieldErrors(e.errors, sectionsToSend(sent, next)));
      else if (isConflict(e) && studyId != null) {
        // actions.saveStudy leaves a conflict to us (no toast): ask what to do, showing their status.
        const theirs = theirsFrom(e) ?? await ep.getStudy(studyId).catch(() => null);
        setConflict({ next, then, theirs });
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const keepMine = () => {
    if (!conflict) return;
    setConflict(null);
    void save(conflict.next, conflict.then, true);
  };

  const loadTheirs = async () => {
    if (!conflict || studyId == null) return;
    setConflict(null);
    let theirs = conflict.theirs;
    if (!theirs) {
      try {
        theirs = await ep.getStudy(studyId);
      } catch (e) {
        showToast(errorMessage(e), { tone: 'error' });
        return;
      }
    }
    takeSaved(theirs, null);
    void mutate(ep.studyKey(theirs.id), theirs, { revalidate: false });
    void mutate(ep.SNAPSHOT_KEY);
    showToast('Their version is loaded');
  };

  const unpublish = async () => {
    if (busy) return;
    const ok = await confirm({
      title: 'Move back to drafts?',
      body: 'It won’t show on Home or in Studies for the group until you publish it again.',
      confirmLabel: 'Move to drafts',
    });
    // This button goes away with the Published state; the next step is publishing again.
    if (ok && (await save('draft', 'stay'))) focusNext.current = `${uid}-publish`;
  };

  const removeStudy = async () => {
    if (studyId == null || busy) return;
    const ok = await confirm({
      title: 'Delete this study?',
      body: 'Its notes will be gone for everyone. This can’t be undone.',
      confirmLabel: 'Delete study',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await actions.deleteStudy(studyId);
      setSaved(draft);
      forgetLocal(studyId);
      leave('/studies', { replace: true });
    } catch {
      setBusy(false);
    }
  };

  const discardRestored = async () => {
    const ok = await confirm({
      title: 'Discard your unsaved changes?',
      body: studyId == null ? 'The new study starts over, empty.' : 'The study goes back to how it was last saved.',
      confirmLabel: 'Discard',
      danger: true,
    });
    if (!ok) return;
    setDraft(saved);
    setBase(savedAt);
    setErrors({});
    setRestored(false);
    focusNext.current = HEADING; // the notice (and its button) go away
  };

  // ⌘S / Ctrl+S saves where you are (a published study stays published), wherever focus is on the page.
  const quickSave = useRef(() => {});
  useEffect(() => {
    quickSave.current = () => void save(status === 'published' ? 'published' : 'draft', 'stay');
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 's') return;
      e.preventDefault(); // never the browser's Save Page while the editor is open
      if (e.repeat || isLockedOut() || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      quickSave.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const published = status === 'published';
  const heading = status == null ? 'New study' : `${published ? 'Editing' : 'Preparing'} ${draft.ref.trim() || 'study'}`;
  // The tab title follows the saved study, not every keystroke.
  useDocumentTitle(status == null ? 'New study' : `${published ? 'Editing' : 'Preparing'} ${saved.ref.trim() || 'study'}`);

  const fieldProps = (f: Field) => ({
    id: fid(f),
    'aria-invalid': errors[f] ? true : undefined,
    'aria-describedby': errors[f] ? `${fid(f)}-error` : undefined,
  });
  const fieldError = (f: Field) => errors[f] && <p id={`${fid(f)}-error`} className={s.error}>{errors[f]}</p>;

  return (
    <div className={s.page}>
      <div className={s.top}>
        <BackButton href="/studies" label="Studies" className={`${s.back} hit`} />
        <ol className={s.steps} aria-label="Status">
          <li className={`${s.step} ${published ? '' : s.draftOn}`} aria-current={published ? undefined : 'step'}>Draft</li>
          <li className={s.dots} aria-hidden />
          <li className={`${s.step} ${published ? s.publishedOn : ''}`} aria-current={published ? 'step' : undefined}>Published</li>
        </ol>
      </div>

      <h1 className={s.h1}>{heading}</h1>

      {restored && dirty && (
        <p className={s.restored}>
          <span>Your unsaved changes were kept on this device.</span>
          <button type="button" className={`btn btn-ghost hit ${s.quiet}`} onClick={() => void discardRestored()}>Discard them</button>
        </p>
      )}

      <section className={s.details} aria-label="Study details">
        <div className="field">
          <label htmlFor={fid('ref')}>Passage</label>
          <input {...fieldProps('ref')} className={`input ${s.control}`} placeholder="Romans 9" maxLength={120} autoComplete="off"
            value={draft.ref} onChange={e => set({ ref: e.target.value })} />
          {fieldError('ref')}
        </div>
        <div className="field">
          <label htmlFor={fid('title')}>Title</label>
          <input {...fieldProps('title')} className={`input ${s.control}`} placeholder="God’s Purposes" maxLength={160} autoComplete="off"
            value={draft.title} onChange={e => set({ title: e.target.value })} />
          {fieldError('title')}
        </div>
        <div className="field">
          <label htmlFor={fid('passage')}>Primary passage</label>
          <input {...fieldProps('passage')} className={`input ${s.control}`} placeholder="Romans 9:1–24" maxLength={160} autoComplete="off"
            value={draft.passage} onChange={e => set({ passage: e.target.value })} />
          {fieldError('passage')}
        </div>
        <div className="field">
          <label htmlFor={fid('meeting_date')}>Meeting date</label>
          <input {...fieldProps('meeting_date')} className={`input ${s.control}`} type="date" required min="1900-01-01" max="2200-12-31"
            value={draft.date} onChange={e => set({ date: e.target.value })} />
          {fieldError('meeting_date')}
        </div>
        <div className="field">
          <label htmlFor={fid('series')}>Series</label>
          <input {...fieldProps('series')} className={`input ${s.control}`} placeholder={deriveSeries(draft.ref) ?? 'From the passage'} maxLength={120}
            autoComplete="off" value={draft.series} onChange={e => set({ series: e.target.value })} />
          {fieldError('series')}
        </div>
        <div className="field">
          <label htmlFor={fid('location')}>Where</label>
          <input {...fieldProps('location')} className={`input ${s.control}`} placeholder={meetingPlace || 'Our usual place'} maxLength={160}
            autoComplete="off" value={draft.location} onChange={e => set({ location: e.target.value })} />
          {fieldError('location')}
        </div>
        <div className={`field ${s.wide}`}>
          <label htmlFor={fid('description')}>Short description — shows on the home page</label>
          <textarea {...fieldProps('description')} className={`input ${s.description}`} maxLength={2000}
            value={draft.description} onChange={e => set({ description: e.target.value })} />
          {fieldError('description')}
        </div>
      </section>

      <section className={s.notes} aria-labelledby={`${uid}-notes`}>
        <h4 id={`${uid}-notes`} className={s.notesTitle}>Study notes</h4>
        {draft.sections.map((x, i) => (
          <SectionCard
            key={x.id}
            section={x}
            index={i}
            count={draft.sections.length}
            idBase={sid(x.id)}
            error={errors[`section:${x.id}`]}
            onChange={patch => setSection(x.id, patch)}
            onMove={dir => move(x.id, dir)}
            onRemove={() => void remove(x)}
          />
        ))}
        {draft.sections.length === 0 && (
          <p className={s.empty}>No notes yet. Start with a thought, a passage or a few questions.</p>
        )}
        <div className={s.addRow} role="group" aria-labelledby={`${uid}-add`}>
          <span id={`${uid}-add`} className={s.addLabel}>Add</span>
          {ADD_ORDER.map(type => (
            <button key={type} id={`${uid}-add-${type}`} type="button" className={`btn btn-secondary hit ${s.add}`}
              disabled={draft.sections.length >= MAX_SECTIONS} onClick={() => addSection(type)}>
              <Icon name="plusSm" /> {SECTION_KINDS[type].label}
            </button>
          ))}
        </div>
        {errors.sections && <p className={s.error}>{errors.sections}</p>}
      </section>

      {errors.form && <p className={s.error} role="alert">{errors.form}</p>}

      <div ref={footerRef} className={s.footer} aria-busy={busy || undefined}>
        <span className={s.hint}>{published ? HINT.published : HINT.draft}</span>
        {/* On a published study this saves in place (it stays live), like the prototype — but says so. */}
        <button type="button" id={`${uid}-save`} className={`btn btn-ghost hit ${s.save}`} aria-disabled={busy || undefined} onClick={() => void save(published ? 'published' : 'draft', 'stay')}>
          {published ? 'Save' : 'Save draft'}
        </button>
        <button type="button" id={`${uid}-publish`} className={`btn btn-primary ${s.publish}`} aria-disabled={busy || undefined} onClick={() => void save('published', 'read')}>
          {published ? 'Save changes' : 'Publish to group'}
        </button>
      </div>

      {studyId != null && (
        <div className={s.quietRow}>
          {published && (
            <button type="button" className={`btn btn-ghost hit ${s.quiet} ${s.quietNeutral}`} aria-disabled={busy || undefined} onClick={() => void unpublish()}>
              Move back to drafts
            </button>
          )}
          <button type="button" className={`btn btn-ghost hit ${s.quiet}`} aria-disabled={busy || undefined} onClick={() => void removeStudy()}>
            Delete study
          </button>
        </div>
      )}

      <ConflictDialog
        open={conflict != null}
        next={conflict?.next ?? 'draft'}
        theirStatus={conflict?.theirs?.status ?? null}
        onLoadTheirs={() => void loadTheirs()}
        onKeepMine={keepMine}
        onClose={() => setConflict(null)}
      />
    </div>
  );
}
