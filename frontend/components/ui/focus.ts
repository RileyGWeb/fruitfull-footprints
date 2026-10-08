/**
 * Puts focus on the current screen's heading (else its <main>) — where keyboard and screen-reader users
 * land when the control they were on is gone (a card moved to Answered, a request was deleted) or
 * after “Skip to content”. The heading is made focusable (tabindex -1) on demand; it shows no ring.
 */
export function focusLandmark(opts: { scroll?: boolean } = {}): void {
  const main = document.getElementById('main') ?? document.querySelector('main');
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: !opts.scroll });
}
