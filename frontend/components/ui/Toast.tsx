'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getToast, showToast, subscribeToast, type ToastTone } from '@/lib/toast';
import { Icon } from './Icon';
import s from './Toast.module.css';

/**
 * showToast(text) — the sage toast with the sprouting leaf, 2.9s. showToast(text, { tone: 'error' }) —
 * a plain neutral pill for failures, a little longer. A new toast replaces the one on screen.
 */
export { showToast };

export function useToast() {
  return { show: (text: string, opts?: { tone?: ToastTone }) => showToast(text, opts) };
}

/** Mounted once by <Providers>. */
export function Toaster() {
  const t = useSyncExternalStore(subscribeToast, getToast, () => null);
  const error = t?.tone === 'error';
  return (
    <>
      {/* Keyed, so the same message twice in a row is a new node and gets announced again. */}
      <div className={s.sr} role="status" aria-live="polite">{t && !error && <span key={t.key}>{t.text}</span>}</div>
      <div className={s.sr} role="alert">{t && error && <span key={t.key}>{t.text}</span>}</div>
      {t && createPortal(
        <div key={t.key} className={`${s.toast} ${error ? s.error : ''} ff-toast`} aria-hidden>
          {!error && <span className={`${s.leaf} ff-sprout`}><Icon name="leafSm" /></span>}
          {t.text}
        </div>,
        document.body,
      )}
    </>
  );
}
