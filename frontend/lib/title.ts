// document.title: “{screen} · {group name}”. The shell sets the group name and a default label for
// the route (components/shell/nav.ts routeTitle); a screen can name itself more precisely with
// useDocumentTitle (“Rachel Owens”, “Preparing Romans 9”). Every client navigation changes the title,
// which is what Next's route announcer reads out to screen readers.
import { useEffect } from 'react';

export const DEFAULT_GROUP_NAME = 'Fruitfull Footprints';

let group = DEFAULT_GROUP_NAME;
let routeLabel: string | null = null;
let gated = false;
const claims: { label: string }[] = [];

/** “Prayer · Fruitfull Footprints”; just the group name for Home (no label). */
export function formatTitle(label: string | null | undefined, groupName: string): string {
  const name = groupName.trim() || DEFAULT_GROUP_NAME;
  const l = label?.trim();
  return l && l !== name ? `${l} · ${name}` : name;
}

function current(): string {
  return gated ? formatTitle(null, group) : formatTitle(claims[claims.length - 1]?.label ?? routeLabel, group);
}

let headWatch: MutationObserver | null = null;

function apply() {
  if (typeof document === 'undefined') return;
  const title = current();
  if (document.title !== title) document.title = title;
  // After a client navigation Next can hoist the layout's metadata <title> into <head> ahead of this
  // one, after the screen's effects have run (seen on `next dev`); document.title reads the first
  // <title>, so put ours back whenever <head> changes. Setting it again is a no-op, so this settles.
  if (!headWatch && typeof MutationObserver !== 'undefined' && document.head) {
    headWatch = new MutationObserver(() => {
      const t = current();
      if (document.title !== t) document.title = t;
    });
    headWatch.observe(document.head, { childList: true, subtree: true, characterData: true });
  }
}

/**
 * Shell only: the group name, the route's default label, and whether the Entrance is up (then the
 * title is just the group name, whatever screen is underneath).
 */
export function setShellTitle(groupName: string, label: string | null, isGated: boolean): void {
  group = groupName;
  routeLabel = label;
  gated = isGated;
  apply();
}

/**
 * Names the current screen in the tab / history / screen-reader announcement, e.g.
 * `useDocumentTitle(member?.name)` → “Rachel Owens · Fruitfull Footprints”. Pass null/undefined
 * (still loading) to keep the shell's default for the route. The newest mounted call wins.
 */
export function useDocumentTitle(label: string | null | undefined): void {
  useEffect(() => {
    if (!label?.trim()) return;
    const claim = { label };
    claims.push(claim);
    apply();
    return () => {
      claims.splice(claims.indexOf(claim), 1);
      apply();
    };
  }, [label]);
}
