// The Studies archive search lives in the address (/studies?q=psalm), so Back from a study returns
// to the same filtered list. Plain string work, kept apart from the component for `npm test`.

/** `href` as a same-origin path with `q` set to the trimmed search, or dropped when it's blank. Everything else is kept. */
export function withQuery(href: string, q: string): string {
  const url = new URL(href);
  const want = q.trim();
  if (want) url.searchParams.set('q', want);
  else url.searchParams.delete('q');
  return url.pathname + url.search + url.hash;
}
