'use client';

import { Icon } from '@/components/ui/Icon';
import { MAX_SECTION_TEXT, SECTION_KINDS, type DraftSection } from './draft';
import s from './Editor.module.css';

type Props = {
  section: DraftSection;
  index: number;
  count: number;
  /** Prefix for this card's element ids (`{idBase}-head`, `-body`, `-up`, `-down`, `-remove`). */
  idBase: string;
  error?: string;
  onChange: (patch: Partial<Pick<DraftSection, 'head' | 'body'>>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
};

/** One “Study notes” card: type tag, heading (the ref for scripture), text, move up/down, remove. */
export function SectionCard({ section, index, count, idBase, error, onChange, onMove, onRemove }: Props) {
  const kind = SECTION_KINDS[section.type];
  const errId = `${idBase}-error`;
  return (
    <div className={s.card} role="group" aria-label={`${kind.label}, ${index + 1} of ${count}`}>
      <span className={`tag ${s.tag} ${s[section.type]}`}>{kind.label}</span>
      <input
        id={`${idBase}-head`}
        className={s.head}
        value={section.head}
        onChange={e => onChange({ head: e.target.value })}
        placeholder={kind.headPh}
        aria-label={kind.headLabel}
        maxLength={MAX_SECTION_TEXT}
        autoComplete="off"
      />
      {count > 1 && (
        <div className={s.moves}>
          <button
            id={`${idBase}-up`}
            type="button"
            className={`btn btn-icon btn-ghost hit ${s.iconBtn}`}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
            aria-label="Move up"
          >
            <Icon name="up" />
          </button>
          <button
            id={`${idBase}-down`}
            type="button"
            className={`btn btn-icon btn-ghost hit ${s.iconBtn}`}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            title="Move down"
            aria-label="Move down"
          >
            <Icon name="down" />
          </button>
        </div>
      )}
      <button
        id={`${idBase}-remove`}
        type="button"
        className={`btn btn-icon btn-ghost hit ${s.iconBtn} ${s.remove}`}
        onClick={onRemove}
        title="Remove section"
        aria-label="Remove section"
      >
        <Icon name="x" />
      </button>
      <textarea
        id={`${idBase}-body`}
        className={`input ${s.body}`}
        value={section.body}
        onChange={e => onChange({ body: e.target.value })}
        placeholder={kind.bodyPh}
        aria-label={kind.bodyLabel}
        maxLength={MAX_SECTION_TEXT}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      />
      {error && <p id={errId} className={`${s.error} ${s.full}`}>{error}</p>}
    </div>
  );
}
