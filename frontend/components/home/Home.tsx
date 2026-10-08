'use client';

import { useEffect, useReducer } from 'react';
import { useSWRConfig } from 'swr';
import { Icon, ScreenState } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { greeting, today } from '@/lib/dates';
import { studyKey } from '@/lib/endpoints';
import { useSnapshot } from '@/lib/hooks';
import { useDocumentTitle } from '@/lib/title';
import type { Study } from '@/lib/types';
import { ComingUp } from './ComingUp';
import { OurGroup } from './OurGroup';
import { PrayerThisWeek } from './PrayerThisWeek';
import { Recently } from './Recently';
import { WeekCard } from './WeekCard';
import { homeView } from './view';
import s from './Home.module.css';

/** Home (“/”): this week's study, prayer, coming dates, the group and recent activity. */
export function Home() {
  useDocumentTitle('Home');
  useClock();
  const { data, error, mutate } = useSnapshot();
  const view = data ? homeView(data, today()) : null;
  useWarmStudy(view?.week.study?.id);

  return (
    <div className={s.home}>
      <div className={s.intro}>
        <h1 className={s.greeting}>{greeting()}, friends.</h1>
        <div className={s.verse}>
          <span className={s.leaf}><Icon name="leafSm" /></span>
          <p className={s.verseText}>
            “The fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control.”{' '}
            <span className={s.cite}>— Galatians 5:22–23</span>
          </p>
        </div>
      </div>

      {view ? (
        <div className={s.cols}>
          <div className={s.main}>
            <WeekCard week={view.week} />
            <PrayerThisWeek prayers={view.prayers} activeCount={view.activeCount} canAdd={view.members.length > 0} />
          </div>
          <div className={s.side}>
            <ComingUp rows={view.coming} noDates={view.noDates} />
            <OurGroup members={view.members} />
            <Recently activity={view.activity} />
          </div>
        </div>
      ) : (
        // The skeleton while loading (and while a 401 hands over to the Entrance), else “didn’t load”.
        <ScreenState error={error} what="The group" onRetry={() => void mutate()} loading={<HomeSkeleton />} level={2} />
      )}
    </div>
  );
}

/** Quiet placeholder shapes in the same layout, faded in only if loading takes a moment. */
function HomeSkeleton() {
  return (
    <div className={`${s.cols} ${s.skeleton}`} role="status" aria-busy="true" aria-label="Loading">
      <div className={s.main}>
        <div className={s.boneWeek} />
        <div className={s.boneList}>
          {[0, 1, 2].map(i => <div key={i} className={`${s.bone} ${s.bonePrayer}`} />)}
        </div>
      </div>
      <div className={s.side}>
        <div className={`${s.bone} ${s.boneDates}`} />
      </div>
    </div>
  );
}

/**
 * Re-renders Home every minute and whenever the app comes back to the foreground, so the greeting and
 * the relative dates (“in 6 days”, “3 days ago”, which study is up next) follow the clock in a tab or
 * installed app that stays open for hours or days.
 */
function useClock() {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = window.setInterval(tick, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

/** Up-next study fetches in flight, so remounting Home doesn't start a second one. */
const warming = new Set<string>();

/**
 * Prefetches the up-next study into SWR's cache, so “Read study notes” opens instantly and the
 * service worker has a copy to show offline. It goes into the cache rather than through `preload()`
 * because a preloaded response is held until the reader first asks for it, however late that is, and
 * the reader then shows that old copy and doesn't refetch. A failed preload would also come back as
 * the reader's first error. From the cache, the reader shows the copy at once and revalidates on open.
 * Skipped when the study is already cached or there's no connection.
 */
function useWarmStudy(id: number | undefined) {
  const { cache, mutate } = useSWRConfig();
  useEffect(() => {
    if (id == null || !navigator.onLine) return;
    const key = studyKey(id);
    if (cache.get(key)?.data !== undefined || warming.has(key)) return;
    warming.add(key);
    mutate(key, fetcher<Study>(key), { revalidate: false })
      .catch(() => undefined)
      .finally(() => warming.delete(key));
  }, [id, cache, mutate]);
}
