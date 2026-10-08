'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { isLockedOut, subscribeGate } from '@/lib/gate';
import { navigating } from '@/lib/historyGuard';
import { focusLandmark } from './focus';
import s from './Dialog.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, topmost last. Only the top one answers keys and holds focus. */
const stack: HTMLElement[] = [];
const isTop = (node: HTMLElement) => stack[stack.length - 1] === node && !isLockedOut();

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Rendered above the title (e.g. the leaf circle on “Mark as answered”). */
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Stack depth; layers above 0 get a lighter backdrop. */
  layer?: number;
};

const focusables = (node: HTMLElement) =>
  [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0);

/** Focus back inside the dialog: where it last was, if that's still there and usable, else the dialog itself. */
function refocus(node: HTMLElement, last: HTMLElement | null) {
  if (last && last.isConnected && node.contains(last) && !last.matches(':disabled')) {
    last.focus({ preventScroll: true });
    if (document.activeElement === last) return;
  }
  node.focus({ preventScroll: true });
}

/**
 * Modal dialog in the prototype's style: portal to <body>, dimmed backdrop (click or Escape closes),
 * focus trapped inside and restored on close, page scroll locked while open. On fine pointers the first
 * field (or an element with `data-autofocus`) gets focus; on touch the dialog itself does, so no keyboard pops up.
 *
 * Focus never falls out to <body>: if the focused control goes away or gets disabled (a failed save),
 * it comes back inside, so Escape and Tab keep working. On close it returns to whatever opened the
 * dialog, or — when that's gone (the card moved to Answered, the request was deleted) — to the page's
 * heading; closed on the way to another page (leaveTo), to that page's heading once it's on screen.
 * While the device is locked out the dialog is hidden behind the Entrance and keeps its input.
 */
export function Dialog({ open, onClose, title, icon, children, className, layer = 0 }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const last = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  const titleId = useId();
  const lockedOut = useSyncExternalStore(subscribeGate, isLockedOut, () => false);

  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // On the stack before taking focus, so the dialog underneath doesn't pull focus back to itself.
    stack.push(node);
    if (stack.length === 1) document.documentElement.style.overflow = 'hidden';
    const fine = window.matchMedia('(pointer: fine)').matches;
    const first = fine ? node.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([type=checkbox]):not([disabled]), textarea:not([disabled]), select:not([disabled])') : null;
    (first ?? node).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop(node) || e.defaultPrevented || e.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      } else if (e.key === 'Tab') {
        const items = focusables(node);
        const at = document.activeElement;
        if (!items.length) return e.preventDefault();
        const head = items[0], tail = items[items.length - 1];
        if (!node.contains(at)) {
          e.preventDefault();
          (e.shiftKey ? tail : head).focus();
        } else if (e.shiftKey && (at === head || at === node)) {
          e.preventDefault();
          tail.focus();
        } else if (!e.shiftKey && at === tail) {
          e.preventDefault();
          head.focus();
        }
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!isTop(node)) return;
      if (node.contains(e.target as Node)) last.current = e.target as HTMLElement;
      else refocus(node, last.current);
    };
    // A focused control that's removed or disabled drops focus to <body>; bring it back in.
    const onFocusOut = () => setTimeout(() => {
      const a = document.activeElement;
      if (isTop(node) && (!a || a === document.body)) refocus(node, last.current);
    }, 0);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      node.removeEventListener('focusout', onFocusOut);
      stack.splice(stack.indexOf(node), 1);
      if (!stack.length) document.documentElement.style.overflow = '';
      if (isLockedOut()) return; // the Entrance has focus; the shell restores it after unlocking
      // Back to what opened the dialog — when it's still there (and, under another dialog, inside that one).
      const restore = () => {
        const below = stack[stack.length - 1];
        if (prev && prev !== document.body && prev.isConnected && (!below || below.contains(prev))) {
          prev.focus({ preventScroll: true });
          if (document.activeElement === prev) return;
        }
        if (below) below.focus({ preventScroll: true });
        else focusLandmark();
      };
      // Closed on the way to another page (leaveTo): what opened it is about to go, so wait for the new
      // screen and land on its heading — unless something has taken focus meanwhile.
      const leaving = navigating();
      if (!leaving) return restore();
      void leaving.then(() => {
        const a = document.activeElement;
        if (!isLockedOut() && (!a || a === document.body)) restore();
      });
    };
  }, [open]);

  // After every render: a re-render that disabled or removed the focused control leaves focus on <body>.
  useEffect(() => {
    const node = ref.current;
    if (!open || !node || !isTop(node)) return;
    const a = document.activeElement;
    if (!a || a === document.body) refocus(node, last.current);
  });

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`${s.backdrop} ${layer > 0 ? s.upper : ''} ${lockedOut ? s.hidden : ''}`}
      inert={lockedOut}
      onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`dialog ${s.dialog} ${className ?? ''}`}>
        {icon}
        <div id={titleId} className={`dialog-title ${s.title}`}>{title}</div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
