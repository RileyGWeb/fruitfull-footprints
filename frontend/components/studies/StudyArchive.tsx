'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { parseDay, shortDate } from '@/lib/dates';
import { archiveGroups } from '@/lib/studies';
import type { StudySummary } from '@/lib/types';
import { withQuery } from './query';
import s from './Studies.module.css';

type Props = { studies: StudySummary[]; now: Date };

/**
 * Mirrors the search into the address bar (?q=), replacing the entry so typing adds no history. Next's
 * patched replaceState keeps its router state on the entry, so nothing is fetched or re-rendered.
 */
function keepInUrl(here: string, q: string) {
  const { pathname, search, hash, href } = window.location;
  if (pathname !== here) return; // already on its way to a study
  const next = withQuery(href, q);
  if (next === pathname + search + hash) return;
  try {
    window.history.replaceState(null, '', next);
  } catch {
    // Safari rate-limits replaceState; the next change catches up.
  }
}

/** “Previous studies”: search + past published studies grouped by series on a dotted timeline. */
export function StudyArchive({ studies, now }: Props) {
  const here = usePathname();
  const urlQ = useSearchParams().get('q') ?? '';
  // The URL seeds the search (Back from a study lands here again); after that the box leads and the URL follows.
  const [q, setQ] = useState(urlQ);
  const searchId = useId();
  const all = useMemo(() => archiveGroups(studies, now), [studies, now]);
  const groups = useMemo(() => (q.trim() ? archiveGroups(studies, now, q) : all), [all, studies, now, q]);
  const hasPast = all.length > 0;
  const noMatch = hasPast && groups.length === 0 ? `Nothing matches “${q.trim()}” yet.` : '';

  useEffect(() => {
    if (q.trim() === urlQ) return;
    const t = setTimeout(() => keepInUrl(here, q), 250);
    return () => clearTimeout(t);
  }, [here, q, urlQ]);

  return (
    <section className={s.archive} aria-labelledby="previous-studies">
      <div className={s.archiveHead}>
        <h2 id="previous-studies" className={s.archiveTitle}>Previous studies</h2>
        {hasPast && (
          <div className={s.search} role="search">
            {/* A label, so a tap just outside the 42px field still lands in it (44px+ target, same look). */}
            <label className={s.searchField}>
              <span className={s.searchIcon} aria-hidden><Icon name="search" /></span>
              <input
                id={searchId}
                aria-label="Search previous studies"
                className={`input ${s.searchInput}`}
                type="search"
                placeholder="Search passages or titles"
                autoComplete="off"
                value={q}
                onChange={e => setQ(e.target.value)}
                // Leaving the box (usually for a result) writes the URL now rather than after the pause.
                onBlur={() => keepInUrl(here, q)}
                onKeyDown={e => { if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); } }}
              />
            </label>
          </div>
        )}
      </div>

      {!hasPast && <p className={s.noResults}>Once we’ve met, past studies will gather here.</p>}
      {noMatch && <p className={s.noResults} aria-hidden>{noMatch}</p>}
      {/* Always mounted (and the copy screen readers use) so the message is announced when a search stops matching. */}
      <span className="sr-only" role="status">{noMatch}</span>

      {groups.map((g, i) => (
        <div key={g.key} className={s.group}>
          <h3 className={s.groupLabel} id={`${searchId}-g${i}`}>{g.series}{g.when && ` · ${g.when}`}</h3>
          <ul className={s.rows} aria-labelledby={`${searchId}-g${i}`}>
            {g.items.map(st => (
              <li key={st.id}>
                <Link href={`/studies/${st.id}`} className={`unstyled ${s.row}`}>
                  <span className={s.rail} aria-hidden>
                    <span className={s.railLine} />
                    <span className={s.railDot} />
                    <span className={s.railLine} />
                  </span>
                  <span className={s.rowBody}>
                    {/* The spaces are dropped by flex layout but keep the link's accessible name readable. */}
                    <span className={s.rowRef}>{st.ref}</span>{' '}
                    <span className={s.rowTitle}>{st.title}</span>{' '}
                    <span className={s.rowDate}>{shortDate(parseDay(st.meeting_date))}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
