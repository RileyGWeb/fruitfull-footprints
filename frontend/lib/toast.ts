// The toast store (plain TS, no React): lib/actions.ts toasts through it, components/ui/Toast.tsx
// renders it. One toast at a time; a new one replaces whatever is on screen.

/** `success` is the prototype's sage pill with the sprouting leaf; `error` is a plain neutral pill. */
export type ToastTone = 'success' | 'error';
export type ToastState = { text: string; tone: ToastTone; key: number } | null;

/** How long each tone stays up (the ff-toast keyframes stretch to fit). Errors get longer to be read. */
export const TOAST_MS: Record<ToastTone, number> = { success: 2900, error: 4500 };

let current: ToastState = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function showToast(text: string, opts: { tone?: ToastTone } = {}): void {
  const tone = opts.tone ?? 'success';
  clearTimeout(timer);
  // A fresh key every time, so a repeated identical message still replays (and is re-announced).
  current = { text, tone, key: ++seq };
  emit();
  timer = setTimeout(() => {
    current = null;
    emit();
  }, TOAST_MS[tone]);
}

export const getToast = (): ToastState => current;

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
