// Gate flags that live outside React (plain TS), read by the shell, dialogs and the history guard.
//
// - lockedOut: this device was locked from elsewhere (a 401: the password changed, or a Lock in
//   another tab) while the app was open. The app stays mounted — hidden and inert under the
//   Entrance — so a half-written study or an open dialog is still there after the password.
// - pendingLock: Lock was pressed but the server hasn't heard yet (offline). The device stays
//   locked here until the password is entered again; the POST is sent once it's back online.
//   Kept in localStorage so a reload (or another tab) doesn't reopen the app.

const PENDING_KEY = 'ff:pending-lock';

let lockedOut = false;
let pendingLock = readPending();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function readPending(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export const isLockedOut = () => lockedOut;
export const hasPendingLock = () => pendingLock;

export function setLockedOut(value: boolean): void {
  if (lockedOut === value) return;
  lockedOut = value;
  if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-ff-locked', value);
  emit();
}

export function setPendingLock(value: boolean): void {
  if (pendingLock === value) return;
  pendingLock = value;
  try {
    if (value) window.localStorage.setItem(PENDING_KEY, '1');
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Private mode / blocked storage: the flag still holds for this page.
  }
  emit();
}

let watchingStorage = false;

/** For useSyncExternalStore. Also follows the pending-lock flag across tabs. */
export function subscribeGate(listener: () => void): () => void {
  if (!watchingStorage && typeof window !== 'undefined') {
    watchingStorage = true;
    window.addEventListener('storage', e => {
      if (e.key !== PENDING_KEY) return;
      pendingLock = e.newValue === '1';
      emit();
    });
  }
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
