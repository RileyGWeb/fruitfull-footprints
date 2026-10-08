import type { KeyboardEvent } from 'react';

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Props for buttons acting as a WAI-ARIA radio group: one Tab stop (the checked option), arrow keys
 * move to the next/previous option and select it, Home/End jump to the ends. Wrap the buttons in an
 * element with role="radiogroup" and a label.
 *
 *   const radio = radioGroup(KINDS, kind, setKind);
 *   <div role="radiogroup" aria-label="Kind of date">
 *     {KINDS.map(k => <button key={k} type="button" {...radio(k)}>{KIND[k].label}</button>)}
 *   </div>
 */
export function radioGroup<T>(values: readonly T[], value: T, onChange: (value: T) => void) {
  const tabStop = values.includes(value) ? value : values[0];
  return (option: T) => ({
    role: 'radio' as const,
    'aria-checked': option === value,
    tabIndex: option === tabStop ? 0 : -1,
    onClick: () => onChange(option),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const i = values.indexOf(option);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? values.length - 1 : STEP[e.key] ? (i + STEP[e.key] + values.length) % values.length : -1;
      if (next < 0) return;
      e.preventDefault();
      onChange(values[next]);
      e.currentTarget.closest('[role=radiogroup]')?.querySelectorAll<HTMLElement>('[role=radio]')[next]?.focus();
    },
  });
}
